# AGENTS.md — Café com BPO

## Project at a Glance

Community platform for Brazilian financial BPO operators. Public site + pricing calculator + authenticated member area.

**Monorepo structure**: `apps/backend` (FastAPI / Python 3.12) + `apps/frontend` (React 18 + TS / Vite 5). Database: PostgreSQL 16. Infra: Docker Compose with Nginx gateway.

## Developer Commands

### Frontend (`apps/frontend/`)

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` (port 3000, defined in `.env` CORS) |
| Typecheck | `npm run typecheck` (strict mode, noUnusedLocals/Parameters on) |
| Lint | `npm run lint` (zero warnings allowed) |
| Test | `npm run test` (Vitest, jsdom, globals on) |
| Build | `npm run build` (typecheck + build) |

### Backend (`apps/backend/`)

| Action | Command |
|--------|---------|
| Dev server | `uvicorn src.main:create_app --factory --host 0.0.0.0 --port 8000` |
| Lint | `ruff check .` |
| Format | `ruff format .` |
| Test | `pytest` (uses SQLite in-memory via conftest patching) |
| Migration (create) | `alembic revision --autogenerate -m "description"` |
| Migration (apply) | `alembic upgrade head` |

### Full stack

| Action | Command |
|--------|---------|
| Start production stack | `docker compose up` (runs from repo root, reads `.env`) — web = build estático nginx, sem mailpit/pgadmin |
| Start dev stack (hot-reload + mailpit + pgadmin) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` |
| CI order | Backend: `ruff check → ruff format --check → pytest` / Frontend: `lint → typecheck → test` |

## Architecture Facts

### Backend module pattern
Every module at `apps/backend/src/modules/{name}/` follows: `models.py` → `schemas.py` → `repository.py` → `service.py` → `router.py`. Register routers in `src/main.py:create_app()`.

### Backend quirks
- **App factory pattern**: `uvicorn src.main:create_app --factory` — do NOT import `main` directly for dev, use `--factory`.
- **Test DB patching**: `tests/conftest.py` patches `src.core.database.engine` and `SessionLocal` at import time with SQLite `:memory:` + `StaticPool`. This is why tests work without PostgreSQL.
- **No `pyproject.toml`**: Backend uses plain `requirements.txt` with pip (no uv, no poetry, no hatch). Dev/test deps (pytest, ruff) live in `requirements-dev.txt` and are NOT installed in the production image.
- **Dashboard module has no models**: It's an aggregation layer that queries other modules' models directly.
- **Pricing has a DDD domain engine**: `modules/pricing/domain/engine.py` is framework-agnostic dataclasses; the service layer translates between API and domain.
- **Static avatar serving**: `storage/avatars/` is mounted at `/avatars` in `main.py`.
- **SSE real-time**: `task_manager/broadcast.py` (`BroadcastManager` singleton) uses PostgreSQL LISTEN/NOTIFY to push task phase changes and team management changes to connected clients via `GET /tasks/events`. Triggers: `trg_notify_task_update` (task_updates), `trg_notify_invitation_routines`/`trg_notify_team_members`/`trg_notify_team_invitations` (team_updates). In SQLite (tests), the listener is skipped. Nginx requires `proxy_buffering off` for SSE.
- **Always**: Code using TDD method.
- **Always**: Update `lineage.md` in in root directory whenever the database structure changes.
- **Always**: Update `docs/tree_files.md` whenever you create, rename, move or delete a file/function — it is the catalog of every file with its functions and purpose.
- **Always**: Business rules in `docs/regras_negocio.md` MUST NOT be violated by any implementation. Before changing anything that touches a documented business rule, ALWAYS ask the product owner if the rule is still correct. Update that file whenever a business rule is created or changes.


### Frontend quirks
- **Portuguese route names**: `/painel` (dashboard), `/cadastro` (register), `/orcamentos` (proposals), `/tarefas` (tasks), `/forum` (network). Routes defined in `src/router.tsx`.
- **Protected routes**: All `/painel/*` routes are wrapped with `ProtectedRoute` → `PanelLayout`.
- **API client**: Axios-based at `src/api/client.ts`, hooks in `src/api/hooks/`.
- **Zod v4** for validation (not v3).
- **No `@/` path alias**: imports are relative.
- **Always**: Follow the system design we created. If a component is missing, create it first, then implement it.
- **Always**: Update design-system route whenever you create a new component.

### Docker / Infra
- **Nginx gateway** (`infra/nginx/`) proxies all traffic. Ports 80 for web, backend exposed internally on 8000.
- **Ollama** included in compose for AI features. 
- **pgAdmin** runs on compose (credentials in `.env`).
- **Deployment**: push to `main` → CI passes → Docker images to GHCR → webhook triggers Hostinger deploy.

### Env loading
- **Root `.env`**: Used by `docker compose` (infra-level vars like `POSTGRES_USER`, `DATABASE_URL` with `@db` host).
- **Backend `.env`** (not committed): Used by `pydantic-settings` for local dev. Copy root `.env` and adjust `DATABASE_URL` to `postgresql+psycopg://...@localhost:...` when running outside Docker.

## Testing Notes

- **Backend**: `pytest` from `apps/backend/`. Tests use an in-memory SQLite DB auto-created in `conftest.py`. No external services needed for unit/integration tests.
- **Frontend**: `npm run test` from `apps/frontend/`. Vitest with jsdom. Test setup at `test/setup.ts`.
- **CI env vars for backend tests**: `DATABASE_URL=sqlite:///:memory:`, `JWT_SECRET=test-secret-key-at-least-32-chars-long`, `MODE=test`, dummy OAuth creds.

## Adding Features

### New backend module
1. Create `apps/backend/src/modules/{name}/` with models, schemas, repository, service, router
2. Add models import to `src/core/database.py` Base if not auto-discovered
3. `alembic revision --autogenerate -m "add {name}"`
4. `alembic upgrade head`
5. Register router in `src/main.py:create_app()`

### New frontend feature
1. Components in `src/components/{feature}/`
2. API hooks in `src/api/hooks/`
3. Zod schemas in `src/schemas/`
4. Page in `src/pages/panel/{Feature}Page.tsx`
5. Route in `src/router.tsx` under `/painel` (protected)

## Code Style

- **Backend**: Ruff for lint + format. No separate formatter config found — uses Ruff defaults.
- **Frontend**: ESLint (TypeScript + React recommended) with `react-refresh` plugin. `@typescript-eslint/no-explicit-any` is turned off.
- **Commits**: Conventional commits (feat:, fix:, chore:, etc.)

## Key Reference Files

- `MODULES.md` — Full module documentation and dependency graph
- `docs/tree_files.md` — Catalog of every file with its functions and purpose (keep updated)
- `docs/regras_negocio.md` — Business rules catalog (MUST NOT be violated; confirm with product owner before changing)
- `docs/architecture.md` — Architectural patterns and decisions (keep updated when patterns change)
- `docker-compose.yml` — Service definitions and env vars
- `.github/workflows/main.yml` — CI/CD pipeline
- `apps/backend/entrypoint.sh` — Docker startup: `alembic upgrade head` then uvicorn
- `ìneage.md` - all tables from Database
