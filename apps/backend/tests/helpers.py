"""Utilitários compartilhados dos testes.

O endpoint público /auth/register foi removido (registro desativado):
usuários de teste são criados diretamente no banco via UserRepository.
"""

from datetime import datetime, timezone
from unittest import mock
from uuid import uuid4

from src.core.database import SessionLocal
from src.core.security import PasswordService
from src.modules.auth.models import User
from src.modules.auth.repository import UserRepository
from src.modules.task_manager.assignments import service as assignments_service

TEST_PASSWORD = "StrongPassword123!"


def valid_pricing_input(
    tax_rate: float = 0,
    commission_rate: float = 0,
    margin: float = 0,
    term_discount: float = 0,
) -> dict:
    """`input_payload` de precificação válido (Metodologia v4).

    Reproduz o formato que o formulário do simulador envia, já que o preço
    gravado no orçamento é recalculado pelo servidor a partir deste payload.
    Com os valores padrão o total é R$ 25,00 (9600 / (2*160*60) = 0,50 por
    minuto, 10 minutos × 5 execuções, sem margem e sem alíquota).
    """
    return {
        "operation": {
            "total_cost": 9600,
            "people_count": 2,
            "hours_per_month": 160,
            "tax_rate": tax_rate,
            "commission_rate": commission_rate,
        },
        "services": [
            {
                "name": "Atendimento",
                "type": "time",
                "minutes_per_execution": 10,
                "monthly_quantity": 5,
                "fixed_value": 0,
                "active": True,
            }
        ],
        "desired_profit_margin": margin,
        "term_discount": term_discount,
    }


def pricing_input_for_service_cost(
    service_cost: float,
    *,
    margin: float = 0,
    term_discount: float = 0,
) -> dict:
    """`input_payload` com um único serviço de valor fixo que custa `service_cost`.

    Sem margem, alíquota ou desconto, o preço final é igual ao custo informado —
    assim o teste declara o total do orçamento diretamente. Com margem e/ou
    desconto, o preço final passa a ser o valor com mark-up, e o custo dos
    serviços continua disponível em `breakdown.total_service_cost`.
    """
    payload = valid_pricing_input(margin=margin, term_discount=term_discount)
    payload["services"] = [
        {
            "name": "BPO Financeiro",
            "type": "fixed",
            "minutes_per_execution": 0,
            "monthly_quantity": 1,
            "fixed_value": service_cost,
            "active": True,
        }
    ]
    return payload


def pricing_input_for_total(total: float) -> dict:
    """Atalho: `input_payload` cujo preço final é exatamente `total`."""
    return pricing_input_for_service_cost(total)


def valid_proposal_payload(client_name: str = "Cliente do Teste", **overrides) -> dict:
    """Corpo de `POST /proposals/` com precificação válida e o resultado omitido.

    O resultado não é enviado porque o preço é sempre recalculado pelo backend.
    """
    payload = {
        "client_name": client_name,
        "input_payload": valid_pricing_input(),
    }
    payload.update(overrides)
    return payload


def auth_header(client, email: str) -> dict:
    """Cria o usuário de teste, faz login e devolve o header de autorização."""
    register_user(payload={"email": email, "password": TEST_PASSWORD})
    resp = client.post(
        "/auth/login", data={"username": email, "password": TEST_PASSWORD}
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def unique_email(prefix: str) -> str:
    return f"{prefix}_{uuid4()}@cafe.com"


def freeze_assignments_clock(weekday: datetime | None = None):
    """Congela o relógio da geração inicial de tasks num dia útil fixo.

    O `POST /tasks/client-templates/` gera os primeiros cards usando
    `datetime.now()` real (assignments/service.py `_generate_for_activities`).
    Rotinas "daily" só criam cards em dias úteis (`weekday() < 5`), então a
    geração falhava nos fins de semana — o resultado variava conforme o dia em
    que o CI rodava. Congelar numa segunda-feira (default) torna os testes
    determinísticos independentemente da data de execução.
    """
    fixed = weekday or datetime(2026, 7, 20, 12, 0, 0, tzinfo=timezone.utc)

    class _FixedClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed if tz is None else fixed.astimezone(tz)

    return mock.patch.object(assignments_service, "datetime", _FixedClock)


def create_test_user(
    email: str,
    password: str = "StrongPassword123!",
    name: str | None = "Test User",
    company: str | None = None,
    role: str = "user",
) -> User:
    """Cria usuário direto no banco e retorna a instância (email normalizado)."""
    session = SessionLocal()
    try:
        user = UserRepository(session).create_user(
            email=email.lower(),
            password_hash=PasswordService.hash_password(password),
            name=name,
            company=company,
            role=role,
            terms_accepted=True,
        )
        session.commit()
        return user
    finally:
        session.close()


def register_user(payload: dict) -> User:
    """Substituto direto de `client.post('/auth/register', json=payload)`."""
    return create_test_user(
        email=payload["email"],
        password=payload.get("password", ""),
        name=payload.get("name"),
        company=payload.get("company"),
    )
