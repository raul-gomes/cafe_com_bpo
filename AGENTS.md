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
| Test | `npm run test` (Vitest watch) — CI runs it once: `npx vitest run` |
| Build | `npm run build` (typecheck + build) |

### Backend (`apps/backend/`)

| Action | Command |
|--------|---------|
| Dev server | `uvicorn src.main:create_app --factory --host 0.0.0.0 --port 8000` |
| Lint | `ruff check .` |
| Format | `ruff format .` |
| Test | `pytest` (uses SQLite in-memory via conftest patching; does **not** run `tests/integration/`) |
| Integration tests | `pytest -m integration` (calls real APIs; needs credentials in `.env`) |
| Migration (create) | `alembic revision --autogenerate -m "description"` |
| Migration (apply) | `alembic upgrade head` |

### Full stack

| Action | Command |
|--------|---------|
| Start production stack | `docker compose up` (runs from repo root, reads `.env`) — web = static nginx build, no mailpit/pgadmin |
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
- **Always**: Update `docs/lineage.md` whenever the database structure changes (local-only, not versioned).
- **Always**: Update `docs/tree_files.md` whenever you create, rename, move or delete a file/function — it is the catalog of every file with its functions and purpose.
- **Always**: Business rules in `docs/regras_negocio.md` MUST NOT be violated by any implementation. Before changing anything that touches a documented business rule, ALWAYS ask the product owner if the rule is still correct. Update that file whenever a business rule is created or changes.


### Frontend quirks
- **Portuguese route names (legacy, being retired)**: `/painel` (dashboard), `/cadastro` (register), `/orcamentos` (proposals), `/tarefas` (tasks), `/forum` (network). Routes defined in `src/router.tsx`. Per §7 (code language), new routes/paths are English; translating these URLs is a coordinated breaking change (frontend + backend + docs) to be planned, not done ad hoc.
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

- **Backend**: `pytest` from `apps/backend/`. Tests use an in-memory SQLite DB auto-created in `conftest.py`. The default run is hermetic: `addopts = -m "not integration"` in `pytest.ini` deselects `tests/integration/`.
- **Integration tests**: files under `tests/integration/` carry `pytestmark = pytest.mark.integration` and only run with `pytest -m integration` (real Cloudinary/Resend, credentials in `.env`). The default suite must never touch the network — with dummy credentials the provider rejects the call and CI goes red.
- **Frontend**: `npm run test` from `apps/frontend/` (Vitest **watch**); the CI-equivalent single run is `npx vitest run`. Vitest with jsdom, setup at `test/setup.ts`.
- **Package installs**: always `npm ci` (CI and `apps/frontend/Dockerfile`), never `npm install --legacy-peer-deps`/`--force`.
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

- **Backend**: Ruff for lint + format, configured in `apps/backend/ruff.toml` (line-length 88 + explicit `ignore` list — read it before adding any `# noqa`).
- **Frontend**: ESLint (TypeScript + React recommended) with `react-refresh` plugin. `@typescript-eslint/no-explicit-any` is turned off.
- **Commits**: Conventional commits (feat:, fix:, chore:, etc.), one concern per commit.
- **Code language**: English (see §7 under Mandatory Practices) — identifiers (including **variable and parameter names**), comments, docstrings, log messages, commit messages and tests.
- **Docstrings + type hints**: every function/method declares its signature (`params` and return) and explains what it does — no undocumented function is merged (see §2 under Mandatory Practices).

## Mandatory Practices (Security, Quality, Testing)

These rules are **not optional**. Each one exists because breaking it already caused a real problem in this repo (a security finding, a red CI, or a cascade of flaky tests). Read them **before** writing code, and treat a violation as a defect to fix before committing.

### 1. Security — never introduce a new vulnerability

- **Never trust input.** Anything coming from a client is untrusted: body, query, path, headers, multipart, SSE payloads, and any DB column previously written by a user.
  - Rich/HTML content (forum posts, comments, descriptions) MUST pass through the bleach allowlist in `src/modules/network/repository.py` before being persisted. Plain text MUST NOT be assembled into HTML/JS by string concatenation.
  - Frontend: never use `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` or `document.write` with data from the API — render text nodes.
  - Validate at the boundary: Pydantic schemas (backend) + Zod v4 (frontend). Never assume the client validated anything.
- **Authorization belongs in the service/repository layer.** Every read/write touching member, team or tenant data MUST verify ownership/role/permission there — not only in the router, and never based on a client-sent `user_id`, `role` or `is_admin`. A missing check is a vulnerability, not a TODO.
- **Never leak secrets or internals.** No tokens, passwords, API keys, `JWT_SECRET`, OAuth credentials, third-party personal data or internal ids in logs, error responses, SSE/websocket messages, or the repository. Never commit `.env` or credentials. API errors return a safe message; details go to the log.
- **No SQL built by string formatting.** Use SQLAlchemy expressions/ORM or bound parameters. Interpolate identifiers only behind a strict allowlist.
- **Uploads**: validate content type and size server-side, never trust the client filename (path traversal), store outside any web-served root.
- **Never weaken a control to make something work**: do not disable auth, CORS, rate limiting (`slowapi`), SSE origin checks, or `MODE`-based security. Env fallbacks must default to the **secure** value and fail loudly on invalid input — never silently more permissive (a settings fallback that reset `MODE` is what caused a suite-wide 429 cascade).
- **New runtime dependency** → add to `apps/backend/requirements.txt` (test-only → `requirements-dev.txt`) **in the same commit**, and prove it with `docker compose build api` + an import check in the container. An import missing from requirements is a broken deploy.
- **Security-sensitive changes** (auth, permissions, input rendering, SSE payloads, crypto, file handling) require a regression test that fails without the fix.

### 2. Code quality — CI green is part of "done"

- Before every commit, run the CI order for the area you touched:
  - Backend: `ruff check .` → `ruff format --check .` → `pytest`
  - Frontend: `npm run lint` → `npm run typecheck` → `npm run test`
- **Zero lint errors, zero format diff, zero warnings** is the only acceptable state — and never add new debt. Fix pre-existing violations in the files you touch rather than widening ignores.
- **Autofix loops**: re-run after each `--fix`; a rule conversion (e.g. `Union` → `|`) makes import sorting (I001) fire on the *next* pass. Iterate until the tool reports 0 remaining.
- Never silence lint with `# noqa`, `# type: ignore`, or a wider `ignore` list without an explicit, documented reason.
- **No debug leftovers**: no `print()`, `breakpoint()`, committed probe fixtures, `.only`, `xdescribe`/`skipif` hacks, or temporary files. Grep your own diff before committing.
- No commented-out code, no `except Exception: pass`, no silent fallbacks. Log with context or re-raise.
- **Docstrings + type hints on every function/method** — public and private (helpers, builders, renderers included). Parameters and return values are typed; the docstring states what the function does (and *why* when the reason is not obvious). A schema or repository method without a docstring is a review blocker.
- Commit only the files belonging to the change; never commit generated junk or root-owned files.

### 3. Tests must be deterministic and isolated

- **TDD always**: write the failing test first, watch it fail for the right reason, then implement.
- **Determinism**: no test may depend on wall-clock time, the current weekday, randomness, set/dict ordering, machine locale, or real network. Freeze the clock through helpers in `tests/helpers.py` instead of relying on `datetime.now()`; when a rule is calendar-dependent, pin it (e.g. a fixed Monday). Never use `time.sleep` to synchronize.
- **Isolation**: any fixture that mutates global state (env vars, `settings` cache, DB session, current user) must be **function-scoped** and restore the previous state on teardown (`settings.cache_clear()`). A session-scoped fixture that pops an env var leaks into every later test and produces silent cascades — this exact bug made the entire suite fail with 429s after the integration folder ran.
- **No background threads in tests**: schedulers, workers and listeners must be skipped in `mode=test` (see the guard in `src/main.py`). A test that needs a manual trigger calls the explicit endpoint, never a live loop.
- **One regression test per bug fix**: reproduce the failure in isolation, add the test, confirm it fails without the fix, fix, confirm it passes.
- Before declaring done: run the **full** suite, not only the file you touched.

### 4. Environment hygiene (container, migrations, docs)

- **Never write into the repo from inside the container as root** — bind-mounted dirs (`src/`, `tests/`, `alembic/`) would become root-owned and break the host developer. Fix a copy under `/tmp` in the container and apply a unified patch on the host with `git apply`.
- The production image intentionally has no pytest/ruff; after a rebuild, reinstall `requirements-dev.txt` in the dev container before running checks.
- Migrations: generate with `alembic revision --autogenerate`, then `alembic upgrade head`. Lint fixes on historical migrations must be annotation/whitespace-only — never change the behavior of an already-applied migration.
- Keep the catalogs in sync: `docs/lineage.md` (schema), `docs/tree_files.md` (files/functions), `docs/regras_negocio.md` (business rules — ask the product owner first), `docs/architecture.md` (patterns), and the design-system route (new components).

### 5. Dependencies and CI configuration

- **Integration tests are opt-in.** Anything that calls a real external service (Cloudinary, Resend, …) MUST be marked `pytest.mark.integration` and live under `tests/integration/`. The default `pytest` run excludes the marker; only `pytest -m integration` with real credentials runs them. A fix here is still a change: write a regression test (e.g. `tests/test_pytest_config.py` fails without `addopts = -m "not integration"`).
- **`npm ci` is the single install path.** CI, `apps/frontend/Dockerfile` and local verification all install with `npm ci` against the committed lockfile. Never use `npm install --legacy-peer-deps`, `--force` or `--omit=peer` to make a tree install — resolve the conflict in `package.json`/lockfile. Masking it in the Dockerfile is what hid a Storybook 10 × Vitest 1 peer conflict and kept CI red for days.
- **Version the dependency tree together.** A Storybook addon, ESLint plugin or test tool added must be compatible with the pinned majors (`vitest`, `vite`, `react`, `eslint`). If a tool is unused (no story with `play`, tests run by plain `vitest`), remove it instead of force-resolving.
- **New/updated frontend dependency** → update `package.json` **and** `package-lock.json` in the same commit, prove `npm ci` resolves, and run `docker compose build web`. Using a Node built-in in TS requires declaring `@types/node`.
- **CI/config fixes need a regression test too** (e.g. `test/DependencyResolution.test.ts` runs `npm ci --dry-run --offline` with a cold cache and fails if the lock is unresolvable). Reproduce the exact CI step locally before declaring done.

### 6. API contract — payload only what the frontend needs

Every endpoint returns a **purpose-built response schema**. Rule: **a field only exists in a payload if a page or hook reads it** — nothing returned "just in case".

- Response models are hand-written DTOs, never `Base`/ORM as `response_model`, never `model_dump()` of the ORM, never `__dict__` spread. Field names are part of the contract.
- Internal columns that change nothing on screen stay out (`created_at`/`updated_at`, `is_active`, `deleted_at`, `user_id`, `company_id`, `MODE`, internal FKs, counters only the server computes). Ask "what does the screen show?" — if nothing renders it, it does not ship.
- Error responses return a safe message; internals go to the log (see §1).
- The frontend consumes the contract through a **purpose-built Zod schema** (never `any`); a field removed from the backend is removed from the page/hook and Zod in the same change.
- Retrofit rule: when you touch an endpoint/schema, strip unused fields **in the same commit**, with a regression test asserting the exact payload keys (frontend tests confirm nothing depended on them). Backwards-compatible removal is preferred; rename-only churn is avoided.

### 7. Code language — everything in English

The codebase is written in **English** (international/portfolio standard). From now on, English is the only language for code:

- **identifiers**: file, module, class, function, method, **variable**, parameter, constant and attribute names (`snake_case` in Python, `camelCase` in TypeScript) — no `representante_nome`, `origem`, `data_empresa` as a local name;
- route paths, query params and enum/status values of the API;
- comments and docstrings;
- log messages and commit messages;
- test names, assertions and fixtures.

**The one boundary — payload field names.** A request/response field name is a **contract shared with the frontend**: translating one (`representante_nome` → `representative_name`, `tem_pessoa` → `has_contact`, `origem` → `origin`) is a coordinated change — Pydantic schema, Zod schema, pages/hooks and tests in the **same commit**, with the product owner's OK when the value is product vocabulary (see below). Never rename a field backend-only and never leave the two sides half-renamed.

Things that stay in **Brazilian Portuguese** (product language — the platform serves Brazilian BPOs):
- UI copy rendered to the user (labels, toasts, page text, e-mail bodies). Changing UI language is a product decision — ask the product owner;
- API `detail` messages shown directly in toasts, when they are knowingly product-facing text (not internals);
- business vocabularies already displayed verbatim by the UI (e.g. `origem` values `livre/prospecto/cliente`, status `conquistado/em_negociacao/perdido`, route names `/painel`, `/orcamentos`…) until the product owner renames them — a rename is a coordinated frontend + backend + docs change, never a refactor side effect.

Retrofit policy: you translate **when you touch a file** — never a big-bang rename. A translated file keeps CI green in the same commit and updates `docs/tree_files.md` when functions are renamed. Historical SQL migrations are never edited (see §4) — their content stays as committed.

## Definition of Done

- [ ] Test written first, fails without the fix; full suite green
- [ ] `ruff check .` + `ruff format --check .` clean (backend) / `npm run lint` + `npm run typecheck` clean (frontend)
- [ ] No untrusted input reaches HTML/JS; authorization checked in the service layer; no secret in code, logs or payloads
- [ ] Integration tests marked `integration` and excluded from the default suite; no test hits the network
- [ ] Dependencies installed with `npm ci` (no `--legacy-peer-deps`), `package.json` + lockfile in sync, validated with `docker compose build web` / `build api`
- [ ] New dependencies declared in requirements and validated with an image build
- [ ] No debug leftovers, no commented-out code, no lint-silencing hacks
- [ ] Every function/method documented with a docstring and type-hinted (params + return)
- [ ] `docs/lineage.md` / `docs/tree_files.md` / `docs/regras_negocio.md` / `docs/architecture.md` updated when applicable
- [ ] Business rules untouched, or explicitly confirmed with the product owner
- [ ] Conventional commit, containing only the files of that change

## Key Reference Files

- `MODULES.md` — Full module documentation and dependency graph
- `docs/tree_files.md` — Catalog of every file with its functions and purpose (keep updated)
- `docs/regras_negocio.md` — Business rules catalog (MUST NOT be violated; confirm with product owner before changing)
- `docs/architecture.md` — Architectural patterns and decisions (keep updated when patterns change)
- `docker-compose.yml` — Service definitions and env vars
- `.github/workflows/main.yml` — CI/CD pipeline
- `apps/backend/entrypoint.sh` — Docker startup: `alembic upgrade head` then uvicorn
- `docs/lineage.md` — All database tables (local-only, not versioned)
