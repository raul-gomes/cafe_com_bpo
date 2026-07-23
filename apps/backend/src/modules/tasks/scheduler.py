"""
Scheduler Module — Rocketry-based task generation from routine templates.

Replaces the previous cron-based scheduler endpoints with an in-process
Rocketry scheduler that runs daily at 00:00 UTC and generates tasks based
on each active ClientTemplateAssignment's recurrence rules.

4 rules:
  - Daily   (Mon–Thu 00:00 UTC): generates next day's tasks for daily templates
  - Weekly  (Sun 00:00 UTC): generates all weekly tasks for the week + Monday's daily
  - Monthly (last business day of month 00:00 UTC): generates monthly tasks
  - Yearly  (last business day of Dec 00:00 UTC): generates yearly tasks
"""

import calendar
import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID
import uuid as uuid_lib

from rocketry import Rocketry
from rocketry.conds import cron
from rocketry.tasks import FuncTask

from src.core.database import SessionLocal
from src.core.utils import next_business_day
from src.core.logger import log
from src.modules.tasks.repository import TaskRepository
from src.modules.tasks.models import ActivityTemplate, TemplateActivity
from src.modules.tasks.schemas import TaskCreate

# Silence Rocketry internal debug spam
logging.getLogger("rocketry").setLevel(logging.WARNING)
logging.getLogger("rocketry.session").setLevel(logging.WARNING)
logging.getLogger("rocketry.core").setLevel(logging.WARNING)


# ================================================================
# Standalone helper functions (extracted from service.py)
# ================================================================


def get_effective_due_day(
    activity: TemplateActivity, tmpl: Optional[ActivityTemplate] = None
) -> Optional[int]:
    """Resolve effective due_day: activity level > template level."""
    if activity.due_day is not None:
        return activity.due_day
    if tmpl is not None and tmpl.due_day is not None:
        return tmpl.due_day
    return None


def get_weekly_deadlines_for_year_month(
    weekday_mask: str,
    year: int,
    month: int,
    min_day: int = 1,
    max_day: Optional[int] = None,
) -> list[datetime]:
    """Generate deadlines for marked weekdays in a given year/month.
    Returns deadlines at 18:00 UTC, adjusted to next business day.
    weekday_mask frontend format: 1=Seg, 2=Ter, ..., 5=Sex, 6=Sáb, 7=Dom
    """
    if not weekday_mask:
        return []
    marked_days = [int(d.strip()) - 1 for d in weekday_mask.split(",") if d.strip()]
    if max_day is None:
        max_day = calendar.monthrange(year, month)[1]

    deadlines: list[datetime] = []
    for day in range(min_day, max_day + 1):
        candidate = datetime(year, month, day, tzinfo=timezone.utc)
        if candidate.weekday() not in marked_days:
            continue
        deadline = candidate.replace(hour=18, minute=0, second=0, microsecond=0)
        deadlines.append(next_business_day(deadline))
    return deadlines


def get_weekly_deadlines_for_month(tmpl: ActivityTemplate) -> list[datetime]:
    """Generate deadlines for all remaining marked weekdays in the current month."""
    now = datetime.now(timezone.utc)
    min_day = now.day
    return get_weekly_deadlines_for_year_month(
        tmpl.weekday_mask,
        now.year,
        now.month,
        min_day=min_day,
    )


def calculate_activity_deadline(
    activity: TemplateActivity,
    start_date: Optional[datetime] = None,
    tmpl: Optional[ActivityTemplate] = None,
) -> datetime:
    """Calculate the next deadline for an activity.
    Priority: due_days -> due_days_from_start -> due_day.
    """
    now = datetime.now(timezone.utc)
    base = start_date if start_date else now

    # due_days mode (days after start)
    if activity.due_days is not None:
        deadline = base + timedelta(days=activity.due_days)
        deadline = deadline.replace(hour=18, minute=0, second=0, microsecond=0)
        return next_business_day(deadline)

    # due_days_from_start mode (template-level, for "once")
    if tmpl is not None and tmpl.due_days_from_start is not None:
        deadline = base + timedelta(days=tmpl.due_days_from_start)
        deadline = deadline.replace(hour=18, minute=0, second=0, microsecond=0)
        return next_business_day(deadline)

    # due_day mode (day of month)
    effective_due_day = get_effective_due_day(activity, tmpl)
    if effective_due_day is None:
        effective_due_day = now.day

    year = base.year
    month = base.month
    max_day = calendar.monthrange(year, month)[1]
    day = min(effective_due_day, max_day)

    deadline = base.replace(day=day, hour=18, minute=0, second=0, microsecond=0)

    # If deadline has already passed, advance to next month
    if deadline.date() < now.date():
        month += 1
        if month > 12:
            month = 1
            year += 1
        max_day = calendar.monthrange(year, month)[1]
        day = min(effective_due_day, max_day)
        deadline = datetime(
            year=year,
            month=month,
            day=day,
            hour=18,
            minute=0,
            second=0,
            microsecond=0,
            tzinfo=timezone.utc,
        )

    return deadline


def should_generate_today(
    tmpl: ActivityTemplate,
    activity: TemplateActivity,
) -> Optional[datetime]:
    """Check if a task should be generated today for the given template+activity.
    Returns the deadline datetime if it should generate, None otherwise.

    NOTE: This function is preserved for backward compatibility with service.py.
    The scheduler class uses its own 4-rule logic instead.
    """
    now = datetime.now(timezone.utc)

    if tmpl.recurrence == "once":
        return None

    if tmpl.recurrence == "daily":
        if now.weekday() < 5:  # Mon-Fri
            deadline = now.replace(hour=18, minute=0, second=0, microsecond=0)
            return next_business_day(deadline)
        return None

    if tmpl.recurrence == "weekly":
        if not tmpl.weekday_mask:
            return None
        weekdays = [int(d.strip()) for d in tmpl.weekday_mask.split(",") if d.strip()]
        if now.weekday() in weekdays:
            deadline = now.replace(hour=18, minute=0, second=0, microsecond=0)
            return next_business_day(deadline)
        return None

    if tmpl.recurrence == "monthly":
        effective_due_day = get_effective_due_day(activity, tmpl)
        if effective_due_day is None:
            return None
        max_day = calendar.monthrange(now.year, now.month)[1]
        day = min(effective_due_day, max_day)
        if now.day == day:
            deadline = now.replace(hour=18, minute=0, second=0, microsecond=0)
            return next_business_day(deadline)
        return None

    if tmpl.recurrence in ("yearly", "annual"):
        if tmpl.due_month and now.month == tmpl.due_month:
            effective_due_day = get_effective_due_day(activity, tmpl)
            if effective_due_day is None:
                return None
            max_day = calendar.monthrange(now.year, now.month)[1]
            day = min(effective_due_day, max_day)
            if now.day == day:
                deadline = now.replace(hour=18, minute=0, second=0, microsecond=0)
                return next_business_day(deadline)
        return None

    return None


# ================================================================
# UUID5-based routine instance id helpers
# ================================================================

# Namespace DNS para UUID5
_ROUTINE_NS = uuid_lib.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def build_routine_instance_id(
    assignment_id: UUID, activity_name: str, period_key: str
) -> uuid_lib.UUID:
    """Generate a deterministic UUID5 for a routine task instance."""
    return uuid_lib.uuid5(_ROUTINE_NS, f"{assignment_id}:{activity_name}:{period_key}")


def last_business_day(year: int, month: int) -> int:
    """Return the last business day (Mon-Fri) of the given month."""
    last = calendar.monthrange(year, month)[1]
    d = datetime(year, month, last, tzinfo=timezone.utc)
    while d.weekday() >= 5:  # Saturday=5, Sunday=6
        last -= 1
        d = datetime(year, month, last, tzinfo=timezone.utc)
    return last


def is_last_business_day_of_month(dt: datetime) -> bool:
    """Check if dt is the last business day of its month."""
    return dt.day == last_business_day(dt.year, dt.month)


def is_last_business_day_of_year(dt: datetime) -> bool:
    """Check if dt is the last business day of December."""
    return dt.month == 12 and is_last_business_day_of_month(dt)


def next_weekday(weekday: int, after: Optional[datetime] = None) -> datetime:
    """Return the next occurrence of `weekday` (0=Mon, 6=Sun) on or after `after`."""
    if after is None:
        after = datetime.now(timezone.utc)
    days_ahead = weekday - after.weekday()
    if days_ahead < 0:
        days_ahead += 7
    result = after + timedelta(days=days_ahead)
    return result.replace(hour=0, minute=0, second=0, microsecond=0)


# ================================================================
# Pre-generation helper (preserved for backward compat with service.py)
# ================================================================


def _pre_generate_for_assignment(
    repo,
    assignment,
    tmpl,
    activities,
    first_phase,
) -> int:
    """Pre-generate tasks for next month (weekly, monthly, yearly recurrences).
    Returns count of generated tasks. Does NOT commit.

    NOTE: This function is preserved for backward compatibility with service.py.
    The scheduler class uses its own 4-rule logic.
    """
    now = datetime.now(timezone.utc)
    if now.month == 12:
        next_year = now.year + 1
        next_month = 1
    else:
        next_year = now.year
        next_month = now.month + 1

    deadlines: list[datetime] = []

    if tmpl.recurrence == "weekly":
        deadlines = get_weekly_deadlines_for_year_month(
            tmpl.weekday_mask,
            next_year,
            next_month,
        )

    elif tmpl.recurrence == "monthly":
        effective_due_day = None
        if activities and activities[0].due_day is not None:
            effective_due_day = activities[0].due_day
        elif tmpl.due_day is not None:
            effective_due_day = tmpl.due_day
        if effective_due_day is not None:
            max_day = calendar.monthrange(next_year, next_month)[1]
            day = min(effective_due_day, max_day)
            deadline = datetime(
                next_year,
                next_month,
                day,
                18,
                0,
                0,
                tzinfo=timezone.utc,
            )
            deadlines = [next_business_day(deadline)]

    elif tmpl.recurrence in ("yearly", "annual"):
        due_month = tmpl.due_month
        if due_month is not None and due_month == next_month:
            effective_due_day = None
            if activities and activities[0].due_day is not None:
                effective_due_day = activities[0].due_day
            elif tmpl.due_day is not None:
                effective_due_day = tmpl.due_day
            if effective_due_day is not None:
                max_day = calendar.monthrange(next_year, next_month)[1]
                day = min(effective_due_day, max_day)
                deadline = datetime(
                    next_year,
                    next_month,
                    day,
                    18,
                    0,
                    0,
                    tzinfo=timezone.utc,
                )
                deadlines = [next_business_day(deadline)]

    generated = 0
    for act in activities:
        for dl in deadlines:
            if repo.has_pending_task(assignment.id, act.name, dl):
                continue
            task_data = TaskCreate(
                title=act.name,
                description=act.description,
                client_id=assignment.client_id,
                status="todo",
                priority="medium",
                process_type=tmpl.process_type,
                deadline=dl,
                time_estimate_minutes=act.estimated_minutes,
                template_id=tmpl.id,
                assignment_id=assignment.id,
            )
            task = repo.create(task_data, assignment.user_id)
            if first_phase:
                task.phase_id = first_phase.id
            generated += 1

    return generated


def should_pre_generate_next_month() -> bool:
    """Check if today is the 27th (or next business day after 27th on weekends).

    NOTE: Preserved for backward compatibility. The scheduler class uses
    the 4-rule logic instead.
    """
    now = datetime.now(timezone.utc)
    candidate = now.replace(day=27, hour=0, minute=0, second=0, microsecond=0)
    if candidate.weekday() >= 5:
        days_to_monday = 7 - candidate.weekday()
        candidate = candidate + timedelta(days=days_to_monday)
    return now.date() == candidate.date()


# ================================================================
# TaskScheduler — Rocketry integration (4-rule design)
# ================================================================


class TaskScheduler:
    """Manages Rocketry-based daily task generation with 4 rules.

    A single FuncTask runs daily at 00:00 UTC and auto-detects which
    rules to apply based on the current date:
      - Sunday       → weekly rule (batch weekly + Monday daily)
      - Monday–Thu   → daily rule (next business day)
      - Last biz day → monthly rule
      - Last biz Dec → yearly rule
    Multiple rules can fire on the same day (e.g. last biz day of Dec
    on a Thursday fires yearly + daily).
    """

    def __init__(self):
        self.app: Optional[Rocketry] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        """Start Rocketry with a single daily FuncTask at 00:00 UTC."""
        self.app = Rocketry()

        def daily_run():
            try:
                self.run_daily_check()
            except Exception as e:
                log.error(f"Rocketry daily run error: {e}")

        task = FuncTask(
            func=daily_run,
            name="daily_scheduler",
            start_cond=cron("0 0 * * *"),
            execution="thread",
        )
        self.app.session.add_task(task)

        self._thread = threading.Thread(
            target=self.app.run, daemon=True, name="rocketry-scheduler"
        )
        self._thread.start()
        log.info("🚀 Rocketry scheduler started (daily at 00:00 UTC)")

    def stop(self) -> None:
        """Gracefully shut down Rocketry."""
        if self.app:
            try:
                self.app.session.shut_down()
                log.info("🛑 Rocketry scheduler shut down")
            except Exception as e:
                log.warning(f"Rocketry shutdown warning: {e}")

    def sync_assignments(self) -> None:
        """No-op: assignments are queried from DB on each run (no per-assignment tasks)."""
        pass

    # ── Core: run_daily_check ──

    def run_daily_check(
        self, now: Optional[datetime] = None, mode: Optional[str] = None
    ) -> dict:
        """Run scheduler logic — determine which rules to apply and generate tasks.

        Args:
            now: Override ``now`` datetime (for testing).  Defaults to UTC now.
            mode: Force a specific rule (``"daily"``, ``"weekly"`` | ``"monthly"`` |
                  ``"yearly"``, or ``"all"`` for auto-detect).  If ``None``, auto-detect.

        Returns a summary dict with keys: ``assignments_processed``,
        ``tasks_generated``, ``tasks_skipped``, ``errors``.
        """
        current = now if now is not None else datetime.now(timezone.utc)
        log.info(
            f"⏰ Scheduler check starting (now={current.isoformat()}, mode={mode})..."
        )

        apply_daily = False
        apply_weekly = False
        apply_monthly = False
        apply_yearly = False

        if mode == "daily":
            apply_daily = True
        elif mode == "weekly":
            apply_weekly = True
        elif mode == "monthly":
            apply_monthly = True
        elif mode == "yearly":
            apply_yearly = True
        elif mode is None or mode == "all":
            # ── Auto-detect ──
            if current.weekday() == 6:  # Sunday
                apply_weekly = True
            elif 0 <= current.weekday() <= 3:  # Mon–Thu
                apply_daily = True
            # Friday (4) and Saturday (5) → no daily/weekly

            if is_last_business_day_of_month(current):
                apply_monthly = True
                if current.month == 12:
                    apply_yearly = True

        log.debug(
            f"Rules: daily={apply_daily} weekly={apply_weekly} "
            f"monthly={apply_monthly} yearly={apply_yearly}"
        )

        # ── DB work ──
        db = SessionLocal()
        try:
            repo = TaskRepository(db)
            assignments = repo.get_active_assignments()
            total_generated = 0
            total_skipped = 0
            processed = 0
            errors: list[str] = []

            for assignment in assignments:
                tmpl = repo.get_template_by_id(
                    assignment.template_id, assignment.user_id
                )
                if not tmpl or not tmpl.is_active:
                    continue

                activities = repo.get_activities_by_template(tmpl.id)
                if not activities:
                    continue

                phases = repo.get_phases_by_user(assignment.user_id)
                first_phase = phases[0] if phases else None

                generated = 0
                skipped = 0

                # Build list of (activity, deadline, period_key) candidates
                candidates: list[tuple[TemplateActivity, datetime, str]] = []

                # ── Weekly rule: generate for all marked weekdays this week ──
                if apply_weekly and tmpl.recurrence == "weekly":
                    self._add_weekly_candidates(
                        current,
                        assignment,
                        tmpl,
                        activities,
                        candidates,
                    )

                # ── Weekly rule: also generate Monday's daily tasks ──
                if apply_weekly and tmpl.recurrence == "daily":
                    self._add_weekly_monday_daily(
                        current,
                        assignment,
                        activities,
                        candidates,
                    )

                # ── Daily rule: generate for next business day ──
                if apply_daily and tmpl.recurrence == "daily":
                    self._add_daily_candidates(
                        current,
                        assignment,
                        activities,
                        candidates,
                    )

                # ── Monthly rule ──
                if apply_monthly and tmpl.recurrence == "monthly":
                    self._add_monthly_candidates(
                        current,
                        assignment,
                        tmpl,
                        activities,
                        candidates,
                    )

                # ── Yearly rule ──
                if apply_yearly and tmpl.recurrence in ("yearly", "annual"):
                    self._add_yearly_candidates(
                        current,
                        assignment,
                        tmpl,
                        activities,
                        candidates,
                    )

                # ── Create tasks (with dedup via routine_instance_id) ──
                for act, deadline, period_key in candidates:
                    instance_id = build_routine_instance_id(
                        assignment.id,
                        act.name,
                        period_key,
                    )
                    if repo.task_exists_by_instance_id(instance_id):
                        skipped += 1
                        continue

                    task_data = TaskCreate(
                        title=act.name,
                        description=act.description,
                        client_id=assignment.client_id,
                        status="todo",
                        priority="medium",
                        process_type=tmpl.process_type,
                        deadline=deadline,
                        time_estimate_minutes=act.estimated_minutes,
                        template_id=tmpl.id,
                        assignment_id=assignment.id,
                        routine_instance_id=instance_id,
                    )
                    task = repo.create(task_data, assignment.user_id)
                    if first_phase:
                        task.phase_id = first_phase.id
                    generated += 1

                if generated or skipped:
                    db.commit()
                    repo.update_assignment_last_generated(assignment.id)
                    log.info(
                        f"  ├ {generated} generated + {skipped} skipped "
                        f"for assignment {assignment.id} ({tmpl.name})"
                    )

                total_generated += generated
                total_skipped += skipped
                processed += 1

            log.info(
                f"✅ Scheduler done: {processed} assignments, "
                f"{total_generated} generated, {total_skipped} skipped"
            )

            return {
                "assignments_processed": processed,
                "tasks_generated": total_generated,
                "tasks_skipped": total_skipped,
                "errors": errors,
            }

        except Exception as e:
            log.error(f"Scheduler error: {e}")
            db.rollback()
            return {
                "assignments_processed": 0,
                "tasks_generated": 0,
                "tasks_skipped": 0,
                "errors": [str(e)],
            }
        finally:
            db.close()

    # ── Candidate builders ──

    @staticmethod
    def _add_weekly_candidates(
        current: datetime,
        assignment,
        tmpl: ActivityTemplate,
        activities: list[TemplateActivity],
        candidates: list[tuple[TemplateActivity, datetime, str]],
    ) -> None:
        """Build candidates for weekly rule: all marked weekdays in the week ahead."""
        if not tmpl.weekday_mask:
            return
        marked_days = [
            int(d.strip()) - 1 for d in tmpl.weekday_mask.split(",") if d.strip()
        ]
        # current is Sunday (weekday=6), so week runs from Mon(+1) to Sun(+7)
        for wd in marked_days:
            # wd: 0=Mon … 6=Sun
            target_day = current + timedelta(days=wd + 1)
            deadline = target_day.replace(hour=18, minute=0, second=0, microsecond=0)
            deadline = next_business_day(deadline)
            period_key = target_day.strftime("%Y-%m-%d")
            for act in activities:
                candidates.append((act, deadline, period_key))

    @staticmethod
    def _add_weekly_monday_daily(
        current: datetime,
        assignment,
        activities: list[TemplateActivity],
        candidates: list[tuple[TemplateActivity, datetime, str]],
    ) -> None:
        """Build candidates for Monday's daily tasks (triggered by Sunday weekly rule)."""
        monday = current + timedelta(days=1)  # Sunday → Monday
        deadline = monday.replace(hour=18, minute=0, second=0, microsecond=0)
        deadline = next_business_day(deadline)
        period_key = monday.strftime("%Y-%m-%d")
        for act in activities:
            candidates.append((act, deadline, period_key))

    @staticmethod
    def _add_daily_candidates(
        current: datetime,
        assignment,
        activities: list[TemplateActivity],
        candidates: list[tuple[TemplateActivity, datetime, str]],
    ) -> None:
        """Build candidates for daily rule: next business day."""
        next_day = current + timedelta(days=1)
        deadline = next_day.replace(hour=18, minute=0, second=0, microsecond=0)
        deadline = next_business_day(deadline)
        period_key = deadline.strftime("%Y-%m-%d")
        for act in activities:
            candidates.append((act, deadline, period_key))

    @staticmethod
    def _add_monthly_candidates(
        current: datetime,
        assignment,
        tmpl: ActivityTemplate,
        activities: list[TemplateActivity],
        candidates: list[tuple[TemplateActivity, datetime, str]],
    ) -> None:
        """Build candidates for monthly rule: current month."""
        effective_due_day = None
        if activities:
            effective_due_day = get_effective_due_day(activities[0], tmpl)
        if effective_due_day is None:
            effective_due_day = 1
        max_day = calendar.monthrange(current.year, current.month)[1]
        day = min(effective_due_day, max_day)
        deadline = datetime(
            current.year,
            current.month,
            day,
            18,
            0,
            0,
            tzinfo=timezone.utc,
        )
        deadline = next_business_day(deadline)
        period_key = f"{current.year}-{current.month:02d}"
        for act in activities:
            candidates.append((act, deadline, period_key))

    @staticmethod
    def _add_yearly_candidates(
        current: datetime,
        assignment,
        tmpl: ActivityTemplate,
        activities: list[TemplateActivity],
        candidates: list[tuple[TemplateActivity, datetime, str]],
    ) -> None:
        """Build candidates for yearly rule: current year."""
        due_month = tmpl.due_month or 12
        effective_due_day = None
        if activities:
            effective_due_day = get_effective_due_day(activities[0], tmpl)
        if effective_due_day is None:
            effective_due_day = 1
        max_day = calendar.monthrange(current.year, due_month)[1]
        day = min(effective_due_day, max_day)
        deadline = datetime(
            current.year,
            due_month,
            day,
            18,
            0,
            0,
            tzinfo=timezone.utc,
        )
        deadline = next_business_day(deadline)
        period_key = str(current.year)
        for act in activities:
            candidates.append((act, deadline, period_key))
