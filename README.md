# ☕ Café com BPO

**Plataforma comunitária para operadores de BPO financeiro no Brasil.**  
Site público + calculadora de precificação + área de membros autenticada.

---

## 🏗️ Stack

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | FastAPI (Python 3.12), SQLAlchemy 2.0, Pydantic v2 |
| **Frontend** | React 18 + TypeScript, Vite 5, TanStack Query |
| **Database** | PostgreSQL 16 |
| **Infra** | Docker Compose, Nginx, GitHub Actions |

---

## 🚀 Início Rápido

```bash
# 1. Clone e entre no diretório
git clone https://github.com/raul-gomes/cafe_com_bpo.git
cd cafe_com_bpo

# 2. Copie o arquivo de ambiente
cp .env.example .env

# 3. Suba todos os serviços
docker compose up --build

# Acesse:
# → http://localhost          (site completo)
# → http://localhost/api/health (health check da API)
```

---

## 📁 Estrutura do Projeto

```
cafe_com_bpo/
├── apps/
│   ├── backend/              # API FastAPI
│   │   ├── src/
│   │   │   ├── core/         # Config, database, security, logger
│   │   │   ├── modules/      # Módulos de negócio (ver abaixo)
│   │   │   └── main.py       # App factory
│   │   └── tests/            # Testes pytest
│   └── frontend/             # App React
│       ├── src/
│       │   ├── api/          # Cliente Axios + hooks TanStack Query
│       │   ├── components/   # Componentes reutilizáveis
│       │   ├── pages/        # Páginas (públicas + painel)
│       │   └── schemas/      # Validação Zod
│       └── test/             # Testes Vitest
├── infra/                    # Infraestrutura (Nginx)
├── .github/workflows/        # CI/CD pipeline
└── docker-compose.yml        # Orquestração dos serviços
```

---

## 🧩 Módulos do Backend

Cada módulo segue o padrão: `models.py` → `schemas.py` → `repository.py` → `service.py` → `router.py`

| Módulo | Endpoints | Descrição |
|--------|-----------|----------|
| **Auth** | `/auth/*` | Registro, login, JWT, OAuth Google, avatar |
| **Pricing** | `/pricing/*` | Calculadora de precificação com engine DDD |
| **Proposals** | `/proposals/*` | Geração de propostas, PDF, email/WhatsApp |
| **Clients** | `/clients/*` | CRUD de clientes (empresas) |
| **Dashboard** | `/dashboard/*` | Agregação de dados (summary, tarefas urgentes) |
| **Gallery** | `/gallery/*` | Upload e gestão de arquivos |
| **Network** | `/network/*` | Fórum da comunidade (posts, comentários) |
| **Tasks** | `/tasks/*` | Gestão de tarefas, templates, SLA |
| **Notifications** | `/notifications/*` | Notificações do sistema |
| **Payments** | `/payments/*` | Integração com Asaas |
| **Companies** | `/companies/*` | Dados das empresas do usuário |

---

## 🧪 Testes

```bash
# Backend (pytest com SQLite em memória)
cd apps/backend && pytest

# Frontend (Vitest)
cd apps/frontend && npm run test

# Lint e formatação
cd apps/backend && ruff check . && ruff format --check .
cd apps/frontend && npm run lint && npm run typecheck
```

---

## 🐳 Serviços Docker

| Serviço | Função | Acesso |
|---------|--------|-------|
| **gateway** | Nginx reverse proxy | `localhost:80` |
| **api** | FastAPI (backend) | Interno porta 8000 |
| **web** | React (frontend) | Interno porta 80 |
| **db** | PostgreSQL 16 | `localhost:5432` |
| **pgadmin** | Admin do banco | `/pgadmin` via gateway |
| **ollama** | LLM local (Qwen 2.5) | `/ollama` via gateway |

---

## 🔄 CI/CD

O pipeline (`main.yml`) roda em **todos os pushes**:

```
push → Backend CI (ruff → pytest) + Frontend CI (lint → typecheck → test)
         ↓
      Gate: ci-passed
         ↓  (apenas push na main)
      Build Docker → Push GHCR → Webhook Hostinger
```

---

## 📚 Documentação Complementar

- `AGENTS.md` — Comandos de desenvolvimento e convenções
- `MODULES.md` — Documentação detalhada dos módulos e dependências
- `docker-compose.yml` — Definição dos serviços
- `.github/workflows/main.yml` — Pipeline CI/CD

---

## 🤝 Contribuindo

1. Crie uma branch a partir de `main`: `git checkout -b feat/sua-feature`
2. Faça suas alterações
3. Garanta que os testes passem: `pytest && npm run test`
4. Abra um Pull Request para `main`

---

<p align="center">Feito com ☕ pela comunidade Café com BPO</p>
