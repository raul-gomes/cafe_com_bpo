"""Fill a local database with fictitious data, so every screen can be tested.

Development only (refuses to run when MODE=production). Everything goes
through the HTTP API, the same way the screens write, so the data respects the
real rules (company sync, pricing on the server, routines generating tasks).

Usage, inside the API container:

    python -m src.devtools.seed_demo owner@email [--api http://127.0.0.1:8000]

The owner is the account that will see the businesses (companies, proposals,
routines, tasks). Four fictitious members are created for the community
(forum, projects, profiles). Running it twice does nothing the second time:
the "demo_seed" site setting marks the database as seeded.
"""

import argparse
import base64
import secrets
import sys
from datetime import UTC, datetime, timedelta

import httpx

from src.core.config import get_settings
from src.core.database import SessionLocal
from src.core.security import PasswordService, TokenService
from src.main import create_app
from src.modules.auth.models import User
from src.modules.auth.repository import UserRepository
from src.modules.platform.models import SiteSetting

SEED_MARK = "demo_seed"
DEMO_DOMAIN = "demo.cafecombpo.com.br"

MEMBERS = [
    (
        "Marina Alves",
        "BPO financeiro para clínicas e consultórios, há 4 anos.",
        "Conciliação bancária",
    ),
    (
        "Rafael Costa",
        "Saí da contabilidade para montar meu BPO. Foco em comércio.",
        "Fluxo de caixa",
    ),
    (
        "Juliana Prado",
        "Atendo agências e prestadores de serviço, 12 clientes.",
        "Contas a pagar",
    ),
    (
        "Diego Martins",
        "Começando agora: primeiro cliente fechado no mês passado.",
        "Precificação",
    ),
]

COMPANIES = [
    {
        "name": "Padaria Pão Dourado",
        "cnpj": "11222333000181",
        "phone": "11987650001",
        "email": "financeiro@paodourado.exemplo.com.br",
        "segment": "Alimentação",
        "description": "Padaria de bairro com duas lojas e delivery. Muitos pagamentos pequenos e diários.",
        "city": "São Paulo",
        "state": "SP",
        "color": "#C27C0E",
    },
    {
        "name": "Clínica Sorriso Vivo",
        "cnpj": "22333444000172",
        "phone": "11987650002",
        "email": "adm@sorrisovivo.exemplo.com.br",
        "segment": "Saúde",
        "description": "Clínica odontológica, 6 dentistas. Repasses por profissional e convênios.",
        "city": "Campinas",
        "state": "SP",
        "color": "#2F7D6D",
    },
    {
        "name": "TechNova Soluções",
        "cnpj": "33444555000163",
        "phone": "11987650003",
        "email": "contato@technova.exemplo.com.br",
        "segment": "Tecnologia",
        "description": "Software house com contratos recorrentes. Faturamento por projeto e por hora.",
        "city": "São Paulo",
        "state": "SP",
        "color": "#4157A8",
    },
]

PROSPECTS = [
    {
        "name": "Mercado Bom Preço",
        "segment": "Varejo",
        "phone": "11987650010",
        "description": "Indicação do Rafael. Quer terceirizar contas a pagar e conciliação.",
        "representante_nome": "Carlos Mendes",
        "representante_email": "carlos@bompreco.exemplo.com.br",
        "city": "Guarulhos",
        "state": "SP",
    },
    {
        "name": "Studio Pilates Equilíbrio",
        "segment": "Saúde e bem-estar",
        "phone": "11987650011",
        "description": "Veio pelo Instagram. Três unidades, controle financeiro em planilha.",
        "representante_nome": "Ana Ribeiro",
        "representante_email": "ana@equilibrio.exemplo.com.br",
        "city": "São Paulo",
        "state": "SP",
    },
]

CONTACTS = [
    (
        "Sérgio Lima (dono)",
        "11987651001",
        "sergio@paodourado.exemplo.com.br",
        "Padaria Pão Dourado",
    ),
    (
        "Dra. Paula Nunes",
        "11987651002",
        "paula@sorrisovivo.exemplo.com.br",
        "Clínica Sorriso Vivo",
    ),
    (
        "Bruno Teixeira (CFO)",
        "11987651003",
        "bruno@technova.exemplo.com.br",
        "TechNova Soluções",
    ),
    (
        "Carlos Mendes",
        "11987651010",
        "carlos@bompreco.exemplo.com.br",
        "Mercado Bom Preço",
    ),
]


def _services(*items: tuple[str, int, int]) -> list[dict]:
    """Builds the services list of a pricing form.

    Args:
        *items: (name, minutes per execution, executions per month).

    Returns:
        The services, all time-based and active.
    """
    return [
        {
            "active": True,
            "name": name,
            "type": "time",
            "minutes_per_execution": minutes,
            "monthly_quantity": quantity,
            "fixed_value": 0,
        }
        for name, minutes, quantity in items
    ]


def _pricing(
    cost: float, services: list[dict], margin: float, discount: float = 0
) -> dict:
    """Builds a pricing form (same shape as the calculator screen).

    Args:
        cost: Monthly cost of the operation.
        services: Services offered.
        margin: Desired profit margin (0.5 = 50%).
        discount: Term discount (0.05 = 5%).

    Returns:
        The input payload.
    """
    return {
        "operation": {
            "total_cost": cost,
            "people_count": 2,
            "hours_per_month": 160,
            "tax_rate": 6,
            "commission_rate": 0,
        },
        "services": services,
        "desired_profit_margin": margin,
        "term_discount": discount,
    }


# 1x1 transparent PNG and a tiny PDF, for the gallery.
PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
PDF_MIN = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>"
    b"endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
)


class Seeder:
    """Talks to the API as several users and reports what it created."""

    def __init__(self, api: str):
        """Opens the HTTP client.

        Args:
            api: Base URL of the API.
        """
        self.http = httpx.Client(base_url=api, timeout=60)
        self.created: dict[str, int] = {}
        self.failures: list[str] = []

    def call(
        self, token: str, method: str, path: str, label: str, **kwargs
    ) -> dict | list | None:
        """Calls the API; a failure is reported and the seed goes on.

        Args:
            token: Bearer token of the acting user.
            method: HTTP method.
            path: API path.
            label: What is being created (for the summary).
            **kwargs: Passed to httpx (json, files, params).

        Returns:
            The JSON answer, or `None` on failure.
        """
        resp = self.http.request(
            method, path, headers={"Authorization": f"Bearer {token}"}, **kwargs
        )
        if resp.status_code >= 400:
            self.failures.append(f"{label}: {resp.status_code} {resp.text[:200]}")
            return None
        self.created[label] = self.created.get(label, 0) + 1
        return resp.json() if resp.content else {}


def _token(user: User) -> str:
    """Signs an access token for a user (no password needed locally).

    Args:
        user: The user.

    Returns:
        The token.
    """
    return TokenService.create_access_token(str(user.id), user.email)


def _members(session) -> list[User]:
    """Creates (or reuses) the fictitious community members.

    Args:
        session: Database session.

    Returns:
        The members, with name, bio and WhatsApp filled.
    """
    repo = UserRepository(session)
    members = []
    for index, (name, bio, _skill) in enumerate(MEMBERS, start=1):
        email = f"{name.split()[0].lower()}@{DEMO_DOMAIN}"
        user = session.query(User).filter(User.email == email).one_or_none()
        if user is None:
            user = repo.create_user(
                email=email,
                password_hash=PasswordService.hash_password(secrets.token_urlsafe(24)),
                name=name,
                terms_accepted=True,
            )
        user.biografia = bio
        user.whatsapp = f"1198765{index:04d}"
        user.company_name = f"{name.split()[0]} BPO Financeiro"
        members.append(user)
    session.commit()
    return members


def seed(owner_email: str, api: str) -> int:
    """Seeds the database.

    Args:
        owner_email: Account that owns the businesses.
        api: Base URL of the API.

    Returns:
        Process exit code.
    """
    if get_settings().mode == "production":
        print("Recusado: este script só roda fora de produção.")
        return 1

    session = SessionLocal()
    if session.get(SiteSetting, SEED_MARK):
        print("Este banco já tem os dados de demonstração. Nada a fazer.")
        return 0
    owner = session.query(User).filter(User.email == owner_email.lower()).one_or_none()
    if owner is None:
        print(f"Conta {owner_email} não encontrada.")
        return 1
    owner.biografia = owner.biografia or "Idealizador do Café com BPO."
    session.commit()
    members = _members(session)
    owner_token = _token(owner)
    member_tokens = [_token(m) for m in members]

    s = Seeder(api)
    today = datetime.now(UTC).date()

    # ── Captar: companies, contacts, prospects, proposals, contract ──
    clients = [
        s.call(owner_token, "POST", "/clients/", "empresa", json=c) for c in COMPANIES
    ]
    clients = [c for c in clients if c]
    for name, phone, email, company in CONTACTS:
        s.call(
            owner_token,
            "POST",
            "/contacts/",
            "contato",
            json={"nome": name, "telefone": phone, "email": email, "empresa": company},
        )
    prospects = [
        s.call(owner_token, "POST", "/prospects/", "prospecção", json=p)
        for p in PROSPECTS
    ]
    prospects = [p for p in prospects if p]

    proposal_inputs = [
        (
            COMPANIES[0]["name"],
            _pricing(
                14000,
                _services(
                    ("Contas a pagar", 15, 120),
                    ("Conciliação bancária", 30, 22),
                    ("Relatório gerencial", 120, 1),
                ),
                0.45,
            ),
        ),
        (
            COMPANIES[1]["name"],
            _pricing(
                14000,
                _services(
                    ("Repasse aos dentistas", 20, 24),
                    ("Faturamento de convênios", 25, 60),
                    ("Conciliação de cartões", 30, 22),
                ),
                0.5,
                0.05,
            ),
        ),
        (
            COMPANIES[2]["name"],
            _pricing(
                14000,
                _services(
                    ("Emissão de notas", 10, 40),
                    ("Contas a receber", 15, 50),
                    ("DRE mensal", 180, 1),
                ),
                0.55,
            ),
        ),
    ]
    proposals = []
    for (client_name, payload), client in zip(proposal_inputs, clients, strict=False):
        proposals.append(
            s.call(
                owner_token,
                "POST",
                "/proposals/",
                "orçamento",
                json={
                    "client_name": client_name,
                    "input_payload": payload,
                    "company_id": client["id"],
                },
            )
        )
    if prospects:
        s.call(
            owner_token,
            "POST",
            "/proposals/",
            "orçamento",
            json={
                "client_name": prospects[0]["name"],
                "company_id": prospects[0]["id"],
                "input_payload": _pricing(
                    14000,
                    _services(
                        ("Contas a pagar", 15, 200), ("Conciliação bancária", 30, 22)
                    ),
                    0.4,
                ),
            },
        )
    # The first proposal was shared and approved by the client; the second is waiting.
    for proposal, decision in zip(proposals[:2], ("approved", None), strict=False):
        if not proposal:
            continue
        link = s.call(
            owner_token,
            "POST",
            f"/proposals/{proposal['id']}/share-link",
            "link de orçamento",
        )
        share_hash = (link or {}).get("share_hash") or (link or {}).get("hash")
        if decision and share_hash:
            s.http.post(
                f"/proposals/public/{share_hash}/decision",
                json={"decision": decision, "observation": "Pode começar no dia 1º."},
            )
    if clients and proposals and proposals[0]:
        s.call(
            owner_token,
            "POST",
            "/contracts/generate",
            "contrato",
            json={"company_id": clients[0]["id"], "proposal_id": proposals[0]["id"]},
        )

    # ── Operacional: routine types, routines with activities, assignments, tasks ──
    phases = s.call(owner_token, "GET", "/tasks/phases/", "fases (leitura)") or []
    phase_by_order = sorted(phases, key=lambda p: p.get("order", 0))
    routine_type = s.call(
        owner_token,
        "POST",
        "/tasks/routine-types/",
        "tipo de rotina",
        json={"name": "Financeiro mensal", "color": "#C27C0E"},
    )
    routines = [
        (
            "Fechamento mensal",
            "monthly",
            [
                ("Conciliar extratos", 60, 3),
                ("Conferir contas a pagar do mês", 45, 5),
                ("Enviar relatório gerencial", 30, 8),
            ],
        ),
        (
            "Rotina semanal de pagamentos",
            "weekly",
            [
                ("Agendar pagamentos da semana", 40, None),
                ("Conferir comprovantes", 20, None),
            ],
        ),
    ]
    templates = []
    for name, recurrence, activities in routines:
        tmpl = s.call(
            owner_token,
            "POST",
            "/tasks/templates/",
            "rotina",
            json={
                "name": name,
                "recurrence": recurrence,
                "weekdays": ["monday"] if recurrence == "weekly" else [],
                "due_day": 5 if recurrence == "monthly" else None,
                "routine_type_id": (routine_type or {}).get("id"),
                "is_active": True,
            },
        )
        if not tmpl:
            continue
        templates.append(tmpl)
        for order, (activity, minutes, due_day) in enumerate(activities):
            s.call(
                owner_token,
                "POST",
                f"/tasks/templates/{tmpl['id']}/activities/",
                "atividade de rotina",
                json={
                    "name": activity,
                    "estimated_minutes": minutes,
                    "due_day": due_day,
                    "order": order,
                    "priority": "medium",
                },
            )
    for client in clients:
        for tmpl in templates:
            s.call(
                owner_token,
                "POST",
                "/tasks/client-templates/",
                "rotina aplicada a empresa",
                json={
                    "client_id": client["id"],
                    "template_id": tmpl["id"],
                    "start_date": today.isoformat(),
                },
            )
        s.call(
            owner_token,
            "POST",
            "/tasks/sla/",
            "SLA",
            json={
                "client_id": client["id"],
                "process_type": "financeiro",
                "sla_days": 2,
                "warning_threshold": 0.8,
            },
        )

    loose_tasks = [
        ("Cobrar boletos vencidos", "high", -2, 30),
        ("Reunião de alinhamento com o cliente", "medium", 1, 60),
        ("Cadastrar novos fornecedores", "low", 3, 20),
        ("Revisar DRE do trimestre", "high", 6, 120),
        ("Organizar notas fiscais de entrada", "medium", 0, 45),
    ]
    for index, (title, priority, days, minutes) in enumerate(loose_tasks):
        client = clients[index % len(clients)] if clients else None
        if not client:
            break
        phase = (
            phase_by_order[min(index % 3, len(phase_by_order) - 1)]
            if phase_by_order
            else None
        )
        deadline = datetime.combine(
            today + timedelta(days=days), datetime.min.time(), tzinfo=UTC
        ).replace(hour=18)
        s.call(
            owner_token,
            "POST",
            "/tasks/",
            "tarefa",
            json={
                "title": title,
                "client_id": client["id"],
                "priority": priority,
                "deadline": deadline.isoformat(),
                "time_estimate_minutes": minutes,
                "phase_id": phase["id"] if phase else None,
                "description": "Tarefa fictícia criada para testes.",
            },
        )
    s.call(
        owner_token, "POST", "/tasks/scheduler/run", "geração de tarefas das rotinas"
    )

    # Three members get a courtesy (full access) so they can create projects and
    # comment on profiles; Diego stays on the free plan, to test the locks.
    for member in members[:3]:
        listed = (
            s.call(
                owner_token,
                "GET",
                "/admin/users",
                "usuários (leitura)",
                params={"search": member.email},
            )
            or []
        )
        if listed:
            s.call(
                owner_token,
                "POST",
                f"/admin/users/{listed[0]['id']}/courtesy",
                "cortesia",
                json={"days": 90, "reason": "Membro fictício (dados de teste)"},
            )

    # ── Comunidade: skills, forum, comments, projects, applications, profile comments ──
    for token, (_n, _b, skill) in zip(member_tokens, MEMBERS, strict=True):
        s.call(token, "POST", "/network/me/skills", "habilidade", json={"name": skill})
    s.call(
        owner_token,
        "POST",
        "/network/me/skills",
        "habilidade",
        json={"name": "Precificação"},
    )
    posts = [
        (
            member_tokens[0],
            "Como vocês cobram a conciliação de cartões?",
            "Tenho cliente com 4 maquininhas e o tempo dobrou. Cobrar por volume ou por hora?",
            ["precificação", "conciliação"],
        ),
        (
            member_tokens[1],
            "Planilha ou sistema para contas a pagar?",
            "Saindo da planilha agora. O que vocês usam no dia a dia e por quê?",
            ["ferramentas"],
        ),
        (
            owner_token,
            "Café aberto: tema da próxima quarta",
            "Vamos falar de rotina mensal: como não perder prazo no fechamento. Tragam suas dúvidas!",
            ["café", "rotinas"],
        ),
        (
            member_tokens[3],
            "Primeiro cliente: o que não pode faltar no contrato?",
            "Fechei meu primeiro cliente e quero começar certo. Dicas?",
            ["contratos", "começando"],
        ),
    ]
    created_posts = [
        s.call(
            token,
            "POST",
            "/network/posts",
            "post no fórum",
            json={"title": t, "message": m, "tags": tags},
        )
        for token, t, m, tags in posts
    ]
    replies = [
        (
            0,
            member_tokens[2],
            "Cobro por faixa de transações. Fica mais justo e o cliente entende.",
        ),
        (
            0,
            owner_token,
            "Use a Precificação do Café: coloca o tempo real e ela mostra o preço justo.",
        ),
        (1, member_tokens[0], "Sistema, sem dúvida. A planilha não avisa vencimento."),
        (
            3,
            member_tokens[1],
            "Escopo bem definido e prazo de envio dos documentos pelo cliente.",
        ),
        (
            3,
            owner_token,
            "E multa por atraso no envio dos documentos. Salva o seu mês.",
        ),
    ]
    for post_index, token, message in replies:
        post = created_posts[post_index]
        if post:
            s.call(
                token,
                "POST",
                f"/network/posts/{post['id']}/comments",
                "comentário no fórum",
                json={"message": message},
            )
    project = s.call(
        member_tokens[2],
        "POST",
        "/network/projects",
        "projeto",
        json={
            "title": "Parceria para atender rede de farmácias",
            "description": "Cliente com 8 lojas. Procuro alguém para dividir a conciliação e o contas a pagar.",
            "skills": ["Conciliação bancária", "Contas a pagar"],
            "team_size": 2,
            "remote_type": "remote",
            "invites": [],
        },
    )
    s.call(
        owner_token,
        "POST",
        "/network/projects",
        "projeto",
        json={
            "title": "Mentoria em grupo: precificação",
            "description": "Encontros quinzenais para revisar preços dos participantes com a calculadora.",
            "skills": ["Precificação"],
            "team_size": 4,
            "remote_type": "remote",
            "invites": [],
        },
    )
    if project:
        s.call(
            owner_token,
            "POST",
            f"/network/projects/{project['id']}/apply",
            "candidatura em projeto",
            json={"message": "Tenho agenda às terças e quintas. Topo!"},
        )
        s.call(
            member_tokens[0],
            "POST",
            f"/network/projects/{project['id']}/apply",
            "candidatura em projeto",
            json={"message": "Já atendo farmácia, posso ajudar."},
        )
    s.call(
        member_tokens[0],
        "POST",
        f"/network/members/{owner.id}/comments",
        "comentário no perfil",
        json={"message": "Obrigada pela dica de precificação no café!"},
    )

    # ── Galeria ──
    s.call(
        owner_token,
        "POST",
        "/gallery/upload",
        "arquivo na galeria",
        files={"file": ("modelo-relatorio-gerencial.pdf", PDF_MIN, "application/pdf")},
    )
    s.call(
        owner_token,
        "POST",
        "/gallery/common/upload",
        "arquivo comum na galeria",
        files={"file": ("checklist-onboarding.pdf", PDF_MIN, "application/pdf")},
    )
    s.call(
        owner_token,
        "POST",
        "/gallery/upload",
        "arquivo na galeria",
        files={"file": ("logo-cliente.png", PNG_1PX, "image/png")},
    )

    # ── Admin: lessons, announcement, site, café confirmations, courtesy, beta signups ──
    lessons = [
        (
            "primeiros-passos",
            "Conhecendo o painel e os módulos",
            "Onde fica cada coisa e como trocar de módulo.",
            1,
            True,
        ),
        (
            "primeiros-passos",
            "Cadastrando o primeiro cliente",
            "A ficha da empresa e o que vale registrar desde o início.",
            2,
            True,
        ),
        (
            "bpo-primeiros-passos",
            "Aula de abertura",
            "Rascunho: cole o link do YouTube em Admin › Aulas.",
            1,
            False,
        ),
    ]
    for section, title, summary, position, published in lessons:
        s.call(
            owner_token,
            "POST",
            "/admin/lessons",
            "aula",
            json={
                "section": section,
                "title": title,
                "summary": summary,
                "position": position,
                "is_published": published,
            },
        )
    s.call(
        owner_token,
        "POST",
        "/admin/announcements",
        "mensagem da equipe",
        json={
            "title": "Bem-vindo à versão de testes",
            "message": "Tudo aqui é fictício: empresas, orçamentos e membros. Explore à vontade e use “Reportar erro” no menu para mandar o que encontrar.",
            "audience": "all",
            "show_on_home": True,
        },
    )
    for name, email, phone in (
        ("Patrícia Gomes", "patricia@exemplo.com.br", None),
        ("Leonardo Dias", None, "11987652222"),
    ):
        s.http.post("/cafes/rsvps", json={"name": name, "email": email, "phone": phone})
        s.created["presença no café"] = s.created.get("presença no café", 0) + 1
    for name, email, profile, client_range in (
        ("Fernanda Rocha", "fernanda@exemplo.com.br", "growing", "6-15"),
        ("Gustavo Henrique", "gustavo@exemplo.com.br", "starting", "1-5"),
        (
            "Escritório Contábil Aurora",
            "contato@aurora.exemplo.com.br",
            "accounting_office",
            "30+",
        ),
    ):
        resp = s.http.post(
            "/beta/signups",
            json={
                "name": name,
                "email": email,
                "whatsapp": "11987653333",
                "profile": profile,
                "client_range": client_range,
                "challenge": "Organizar a rotina e parar de perder prazo.",
                "source": "home",
                "lgpd_consent": True,
            },
        )
        if resp.status_code < 400:
            s.created["inscrição beta"] = s.created.get("inscrição beta", 0) + 1

    session.add(
        SiteSetting(
            key=SEED_MARK,
            value={"seeded_at": datetime.now(UTC).isoformat(), "owner": owner.email},
            updated_by="seed_demo",
        )
    )
    session.commit()
    session.close()

    print("Criado:")
    for label, count in s.created.items():
        print(f"  {count:>3}  {label}")
    if s.failures:
        print("\nFalhas (o resto foi criado normalmente):")
        for failure in s.failures:
            print("  -", failure)
    return 0


def main(argv: list[str] | None = None) -> int:
    """Command line entry point.

    Args:
        argv: Arguments (defaults to sys.argv).

    Returns:
        Process exit code.
    """
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("owner_email")
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    args = parser.parse_args(argv)
    create_app()  # registers every model, so the ORM can resolve relationships
    return seed(args.owner_email, args.api)


if __name__ == "__main__":
    sys.exit(main())
