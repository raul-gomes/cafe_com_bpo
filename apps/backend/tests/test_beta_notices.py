"""Beta expiry notices (D12, §17.6).

The rule: a beta user hears about the end of the program 30 days and 7 days
before `expires_at`, each notice at most once per user and per type — the job
runs daily, so a re-run must not become spam.

Two deliberate interpretations are pinned here:

- **Inside the 7-day window only the late notice goes out.** A user the job
  reaches for the first time with 5 days left gets the 7-day notice, never a
  back-to-back pair ("30 days" arriving when there are 5 left is a lie).
- **Admins get nothing.** D11 means an admin never loses anything when the beta
  ends, so the warning would be false for them — the same reason the panel
  banner (state precedence) can never show for an admin.

Every call passes an explicit `now`, so the suite never reads the wall clock
(working agreement §3).
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from src.core.database import SessionLocal
from src.modules.auth.models import User
from src.modules.emails.models import EmailDelivery
from src.modules.emails.templates import render_template
from src.modules.subscriptions.beta_notice import run_beta_notices
from src.modules.subscriptions.models import BetaAccess

NOW = datetime(2026, 10, 5, 12, 0, tzinfo=UTC)


def _seed_beta(db_session, *, days_to_expiry: int, role: str = "user") -> User:
    """Creates a running beta grant that expires `days_to_expiry` after `NOW`.

    Args:
        db_session: Test database session.
        days_to_expiry: Calendar days between `NOW` and `expires_at`. Negative
            values create an already-expired grant.
        role: Role of the beta user.

    Returns:
        The persisted user.
    """
    user = User(
        id=uuid4(),
        email=f"beta_{uuid4().hex[:12]}@cafe.com",
        password_hash="never-checked-here",
        name="Beta Person",
        role=role,
    )
    db_session.add(user)
    db_session.flush()
    db_session.add(
        BetaAccess(
            id=uuid4(),
            user_id=user.id,
            expires_at=NOW + timedelta(days=days_to_expiry),
            source="launch_beta",
        )
    )
    db_session.commit()
    return user


def _deliveries() -> list[dict]:
    """Reads the e-mail queue with a fresh session (the job commits on its own).

    Returns:
        One plain dict per `email_deliveries` row, safe to read after close.
    """
    with SessionLocal() as session:
        rows = session.query(EmailDelivery).all()
        return [
            {
                "kind": row.kind,
                "template": row.template,
                "recipient": row.recipient,
                "key": row.idempotency_key,
                "payload": dict(row.payload or {}),
                "status": row.status,
            }
            for row in rows
        ]


def test_notice_30d_is_queued_for_a_beta_ending_in_30_days(db_session):
    """The nominal window queues the 30-day notice with a stable dedupe key."""
    user = _seed_beta(db_session, days_to_expiry=30)

    result = run_beta_notices(now=NOW)

    deliveries = _deliveries()
    assert result.enqueued == 1
    assert result.skipped == 0
    assert len(deliveries) == 1
    assert deliveries[0]["kind"] == "beta_notice"
    assert deliveries[0]["template"] == "beta_notice_30d"
    assert deliveries[0]["recipient"] == user.email
    assert deliveries[0]["key"] == f"beta_notice:{user.id}:30d"
    assert deliveries[0]["status"] == "pending"


def test_notice_7d_wins_when_the_end_is_close(db_session):
    """Inside 7 days only the late notice goes out — never both, never late."""
    user = _seed_beta(db_session, days_to_expiry=7)

    result = run_beta_notices(now=NOW)

    deliveries = _deliveries()
    assert result.enqueued == 1
    assert [item["template"] for item in deliveries] == ["beta_notice_7d"]
    assert deliveries[0]["key"] == f"beta_notice:{user.id}:7d"


def test_beta_with_8_days_left_still_gets_the_30d_notice(db_session):
    """The day after the 7-day boundary the earlier notice is still the right one."""
    _seed_beta(db_session, days_to_expiry=8)

    result = run_beta_notices(now=NOW)

    deliveries = _deliveries()
    assert result.enqueued == 1
    assert deliveries[0]["template"] == "beta_notice_30d"


def test_beta_outside_the_window_is_left_alone(db_session):
    """31 days out is not "30 days before" — silence until the window opens."""
    _seed_beta(db_session, days_to_expiry=31)

    result = run_beta_notices(now=NOW)

    assert result.enqueued == 0
    assert result.skipped == 0
    assert _deliveries() == []


def test_expired_beta_gets_nothing(db_session):
    """The notice is a warning with time left to act; after expiry it is noise."""
    _seed_beta(db_session, days_to_expiry=-1)

    result = run_beta_notices(now=NOW)

    assert result.enqueued == 0
    assert _deliveries() == []


def test_rerun_does_not_queue_the_same_notice_twice(db_session):
    """§17.6: one e-mail per user and per type, no matter how often the job runs."""
    _seed_beta(db_session, days_to_expiry=30)

    first = run_beta_notices(now=NOW)
    second = run_beta_notices(now=NOW + timedelta(days=1))

    assert first.enqueued == 1
    assert second.enqueued == 0
    assert second.skipped == 1
    assert len(_deliveries()) == 1


def test_crossing_into_the_7d_window_queues_the_second_notice_once(db_session):
    """Both notices exist over time — each exactly once, keyed by its own type."""
    user = _seed_beta(db_session, days_to_expiry=30)

    assert run_beta_notices(now=NOW).enqueued == 1
    assert run_beta_notices(now=NOW + timedelta(days=24)).enqueued == 1
    assert run_beta_notices(now=NOW + timedelta(days=25)).enqueued == 0

    keys = sorted(item["key"] for item in _deliveries())
    assert keys == [f"beta_notice:{user.id}:30d", f"beta_notice:{user.id}:7d"]


def test_admins_get_no_notice(db_session):
    """D11: an admin never loses access, so the warning would be a lie."""
    _seed_beta(db_session, days_to_expiry=10, role="admin")

    result = run_beta_notices(now=NOW)

    assert result.enqueued == 0
    assert _deliveries() == []


def test_queued_notice_renders_with_the_expiry_date(db_session):
    """The template is registered and the payload carries what the body prints."""
    _seed_beta(db_session, days_to_expiry=30)

    run_beta_notices(now=NOW)

    delivery = _deliveries()[0]
    subject, text, html = render_template(delivery["template"], delivery["payload"])
    assert "30 dias" in subject
    assert "04/11/2026" in text
    assert "04/11/2026" in html
    assert "$" not in text
