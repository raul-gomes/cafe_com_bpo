"""EmailScheduler — Rocketry-based in-process worker for the email queue.

Intervalo configurável via ``EMAIL_WORKER_INTERVAL_SECONDS`` (default 15s).
Cada ciclo chama ``run_once()`` do EmailWorker (devolve registros presos em
'processing' e processa um lote), protegido contra exceções para não derrubar
o ciclo.

Segue o mesmo padrão do ``task_manager/scheduler.py``.
"""

import logging
import threading

from rocketry import Rocketry
from rocketry.conds import every
from rocketry.tasks import FuncTask

from src.core.config import get_settings
from src.core.database import SessionLocal
from src.core.logger import log
from src.modules.emails.worker import EmailWorker

# Silence Rocketry internal debug spam
logging.getLogger("rocketry").setLevel(logging.WARNING)
logging.getLogger("rocketry.session").setLevel(logging.WARNING)
logging.getLogger("rocketry.core").setLevel(logging.WARNING)


class EmailScheduler:
    """Executa o EmailWorker periodicamente em thread própria."""

    def __init__(self):
        self.app: Rocketry | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        interval_seconds = get_settings().email_worker_interval_seconds
        self.app = Rocketry()

        def run_cycle():
            try:
                db = SessionLocal()
                try:
                    worker = EmailWorker(db)
                    stats = worker.run_once()
                    if stats["processed"]:
                        log.info(f"📬 Email worker cycle: {stats}")
                except Exception as e:
                    log.error(f"📬 Email worker cycle error: {e}")
                finally:
                    db.close()
            except Exception as e:
                log.error(f"Email worker fatal: {e}")

        task = FuncTask(
            func=run_cycle,
            name="email_worker",
            start_cond=every(f"{interval_seconds} seconds"),
            execution="thread",
        )
        self.app.session.add_task(task)

        self._thread = threading.Thread(
            target=self.app.run, daemon=True, name="rocketry-email-worker"
        )
        self._thread.start()
        log.info(f"📧 Email worker started (every {interval_seconds}s)")

    def stop(self) -> None:
        if self.app:
            try:
                self.app.session.shut_down()
                log.info("🛑 Email worker shut down")
            except Exception as e:
                log.warning(f"Email worker shutdown warning: {e}")


email_scheduler_instance: EmailScheduler = EmailScheduler()
