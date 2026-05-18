# Café com BPO - Module Documentation

> **Purpose**: This document maps all modules/components in the project for maintenance and development reference.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Backend Modules](#backend-modules)
3. [Frontend Modules](#frontend-modules)
4. [Shared Infrastructure](#shared-infrastructure)
5. [Module Dependencies](#module-dependencies)
6. [Development Guidelines](#development-guidelines)

---

## Project Overview

**Café com BPO** is a community platform for financial BPO operators with:
- Public site for positioning and member acquisition
- Pricing calculator as a lead magnet
- Authenticated member area with community features

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI (Python 3.12), SQLAlchemy 2.0, Pydantic v2 |
| **Frontend** | React 18 + TypeScript, Vite 5, TanStack Query |
| **Database** | PostgreSQL 16 |
| **Infrastructure** | Docker, Nginx, GitHub Actions |

---

## Backend Modules

### Module Structure Pattern

Each backend module follows the Service-Repository pattern:

```
modules/{module_name}/
├── models.py       # SQLAlchemy ORM models
├── schemas.py      # Pydantic request/response schemas
├── repository.py   # Data access layer
├── service.py      # Business logic layer
├── router.py       # HTTP route handlers
└── [storage_service.py]  # Optional: external storage integration
```

---

### 1. Auth Module

**Path**: `apps/backend/src/modules/auth/`

| File | Responsibility |
|------|----------------|
| `models.py` | User, PasswordResetToken models |
| `schemas.py` | LoginRequest, RegisterRequest, TokenResponse, ProfileUpdate |
| `repository.py` | User CRUD, password reset token operations |
| `service.py` | Authentication logic, JWT handling, OAuth (Google) |
| `router.py` | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/forgot-password`, `/auth/reset-password` |
| `storage_service.py` | Avatar upload to Cloudinary |

**Dependencies**: core/security.py, core/config.py, oauth.py

**Key Features**:
- JWT authentication (HS256)
- Google OAuth integration
- Password hashing with bcrypt
- Avatar upload via Cloudinary

---

### 2. Pricing Module

**Path**: `apps/backend/src/modules/pricing/`

**Architecture**: Domain-Driven Design (DDD) pattern

| File | Responsibility |
|------|----------------|
| `models.py` | PricingScenario (database model for saved scenarios) |
| `schemas.py` | PricingInput, PricingResult, ScenarioCRUD schemas |
| `repository.py` | Pricing scenario storage and retrieval |
| `service.py` | Translation layer between API and domain engine |
| `router.py` | `/pricing/calculate`, `/pricing/scenarios`, `/pricing/compare` |
| `domain/engine.py` | Core calculation engine (dataclasses, agnostic to web framework) |

**Dependencies**: core/database.py

**Key Features**:
- Domain-driven calculation engine (separate from web layer)
- Saved pricing scenarios per user
- Scenario comparison
- Clear separation: API (schemas/router) → Service → Domain Engine

---

### 3. Proposals Module

**Path**: `apps/backend/src/modules/proposals/`

| File | Responsibility |
|------|----------------|
| `models.py` | Proposal, ProposalItem models |
| `schemas.py` | ProposalCreate, ProposalResponse, ProposalSend schemas |
| `repository.py` | Proposal CRUD operations |
| `service.py` | Proposal generation, PDF creation, email/WhatsApp sending |
| `router.py` | `/proposals`, `/proposals/:id`, `/proposals/:id/send-email`, `/proposals/:id/send-whatsapp` |

**Dependencies**: pricing module, auth module, PDF generation libs

**Key Features**:
- Proposal generation from pricing scenarios
- PDF export
- Email and WhatsApp sharing

---

### 4. Clients Module

**Path**: `apps/backend/src/modules/clients/`

| File | Responsibility |
|------|----------------|
| `models.py` | Client model |
| `schemas.py` | ClientCreate, ClientUpdate, ClientResponse |
| `repository.py` | Client CRUD operations |
| `service.py` | Client business logic |
| `router.py` | `/clients`, `/clients/:id` |

**Dependencies**: auth module (user ownership)

---

### 5. Dashboard Module (Aggregation)

**Path**: `apps/backend/src/modules/dashboard/`

**Type**: Aggregation Module (queries other modules directly, no own models/repository)

| File | Responsibility |
|------|----------------|
| `schemas.py` | DashboardSummary, UrgentTaskResponse, ActivityResponse |
| `service.py` | Dashboard data compilation (queries other modules) |
| `router.py` | `/dashboard/summary` |

**Dependencies**: tasks, clients, network modules (direct model access)

**Key Features**:
- Summary statistics (pending tasks, unread notifications)
- Urgent tasks (deadline within 3 days)
- Recent activity feed from notifications
- Note: This is an aggregation module that queries other modules directly

---

### 6. Gallery Module

**Path**: `apps/backend/src/modules/gallery/`

| File | Responsibility |
|------|----------------|
| `models.py` | GalleryItem model |
| `schemas.py` | GalleryItemCreate, GalleryItemResponse |
| `repository.py` | Gallery item CRUD |
| `service.py` | Media management |
| `router.py` | `/gallery`, `/gallery/:id` |
| `storage_service.py` | Image upload to Cloudinary |

**Dependencies**: auth module, Cloudinary

---

### 7. Network Module

**Path**: `apps/backend/src/modules/network/`

| File | Responsibility |
|------|----------------|
| `models.py` | Connection, NetworkRequest models |
| `schemas.py` | ConnectionCreate, NetworkRequestResponse |
| `repository.py` | Network connection operations |
| `service.py` | Connection business logic |
| `router.py` | `/network/connections`, `/network/requests` |

**Dependencies**: auth module

---

### 8. Tasks Module

**Path**: `apps/backend/src/modules/tasks/`

| File | Responsibility |
|------|----------------|
| `models.py` | Task, Routine, ProcessType models |
| `schemas.py` | TaskCreate, TaskUpdate, RoutineCreate schemas |
| `repository.py` | Task and routine CRUD |
| `service.py` | Task scheduling, recurrence logic |
| `router.py` | `/tasks`, `/tasks/:id`, `/routines`, `/routines/:id` |

**Dependencies**: auth module

**Key Features**:
- Task management
- Dynamic, recurring, and fixed routines
- Process type categorization

---

## Frontend Modules

### Component Structure Pattern

```
src/
├── components/       # Reusable UI components by feature
│   ├── auth/        # Authentication components
│   ├── panel/       # Panel layout components
│   ├── pricing/     # Calculator components
│   ├── proposal/    # Proposal components
│   ├── tasks/       # Task management components
│   ├── pdf/         # PDF generation components
│   └── ui/          # Generic UI primitives
├── pages/            # Page-level components
│   └── panel/       # Protected panel pages
├── api/              # API client layer
│   ├── hooks/       # TanStack Query hooks
│   └── endpoints/   # API endpoint definitions
├── lib/              # Utility functions
├── schemas/          # Zod validation schemas
└── context/          # React contexts
```

---

### 1. Auth Components

**Path**: `apps/frontend/src/components/auth/`

| Component | Responsibility |
|-----------|----------------|
| `LoginForm.tsx` | Email/password login form |
| `RegisterForm.tsx` | User registration form |
| `ForgotPasswordForm.tsx` | Email input for password reset |
| `ResetPasswordForm.tsx` | New password input form |
| `GoogleOAuthButton.tsx` | Google OAuth login button |

**Related Pages**: `LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`

**API Hooks**: `useLogin`, `useRegister`, `useForgotPassword`, `useResetPassword`

---

### 2. Panel Components

**Path**: `apps/frontend/src/components/panel/`

| Component | Responsibility |
|-----------|----------------|
| `PanelLayout.tsx` | Main layout with sidebar and navbar |
| `Sidebar.tsx` | Navigation sidebar |
| `Navbar.tsx` | Top navigation bar |
| `UserInfo.tsx` | User avatar and info display |

**Usage**: Wraps all protected `/painel/*` routes

---

### 3. Pricing Components

**Path**: `apps/frontend/src/components/pricing/`

| Component | Responsibility |
|-----------|----------------|
| `PricingCalculator.tsx` | Main calculator form |
| `PricingResults.tsx` | Calculation results display |
| `ScenarioSaver.tsx` | Save scenario form |
| `ScenarioList.tsx` | List of saved scenarios |

**API Hooks**: `usePricingCalculation`, `useSaveScenario`, `useScenarios`

**Lib**: `pricingEngine.ts` - Client-side calculation logic

---

### 4. Proposal Components

**Path**: `apps/frontend/src/components/proposal/`

| Component | Responsibility |
|-----------|----------------|
| `ProposalPreview.tsx` | Proposal preview display |
| `ProposalForm.tsx` | Proposal creation/editing form |
| `ProposalList.tsx` | List of user's proposals |
| `SendProposalModal.tsx` | Modal for email/WhatsApp sending |

**API Hooks**: `useProposals`, `useCreateProposal`, `useSendProposal`

**PDF**: `useGeneratePDF.ts` - PDF generation hook

---

### 5. Tasks Components

**Path**: `apps/frontend/src/components/tasks/`

| Component | Responsibility |
|-----------|----------------|
| `TaskList.tsx` | List of tasks with filters |
| `TaskForm.tsx` | Create/edit task form |
| `RoutineList.tsx` | List of routines |
| `RoutineForm.tsx` | Create/edit routine form |
| `ProcessTypeSelector.tsx` | Dynamic/Recurring/Fixed selector |

**API Hooks**: `useTasks`, `useTask`, `useRoutines`, `useCreateTask`

---

### 6. PDF Components

**Path**: `apps/frontend/src/components/pdf/`

| Component | Responsibility |
|-----------|----------------|
| `ProposalPDFDocument.tsx` | PDF document structure (react-pdf) |
| `PDFViewer.tsx` | In-browser PDF preview |
| `PDFDownloadButton.tsx` | Download trigger button |

---

### 7. UI Components

**Path**: `apps/frontend/src/components/ui/`

| Component | Responsibility |
|-----------|----------------|
| `Button.tsx` | Reusable button with variants |
| `Input.tsx` | Form input with validation display |
| `Modal.tsx` | Reusable modal dialog |
| `LoadingSpinner.tsx` | Loading state indicator |
| `ErrorBoundary.tsx` | React error boundary |
| `ProtectedRoute.tsx` | Route guard for auth |

**Design System**: Follows Apple-inspired design (see `docs/DESIGN.md`)

---

## Shared Infrastructure

### Backend Core

**Path**: `apps/backend/src/core/`

| File | Responsibility |
|------|----------------|
| `config.py` | Pydantic Settings for environment variables |
| `database.py` | SQLAlchemy engine and session management |
| `security.py` | JWT creation/validation, password hashing |
| `logger.py` | Loguru-based structured logging |

### OAuth

**Path**: `apps/backend/src/oauth.py`

Orchestrates OAuth providers (currently Google only)

### Frontend Providers

**Path**: `apps/frontend/src/providers/`

| Provider | Responsibility |
|----------|----------------|
| `AuthProvider.tsx` | Authentication state management |
| `QueryProvider.tsx` | TanStack Query configuration |

---

## Module Dependencies

### Backend Dependency Graph

```
auth ───────────┐
                 ├─→ pricing
clients ─────────┤
                 ├─→ proposals → pricing
dashboard ──────┤─→ clients
                 ├─→ proposals
                 ├─→ tasks
gallery ─────────┘
network ────────→ auth
tasks ──────────→ auth
```

### Frontend Dependency Graph

```
pages/LoginPage ──────→ components/auth
pages/PanelPages ─────→ components/panel
                       ├─→ components/pricing
                       ├─→ components/proposal
                       ├─→ components/tasks
                       └─→ components/gallery

api/hooks ───────────→ context/AuthContext
                     └─→ schemas/ (Zod validation)
```

---

## Development Guidelines

### Adding a New Backend Module

1. Create directory: `apps/backend/src/modules/{module_name}/`
2. Create files: `models.py`, `schemas.py`, `repository.py`, `service.py`, `router.py`
3. Define SQLAlchemy models in `models.py`
4. Run Alembic migration: `alembic revision --autogenerate -m "add {module_name} models"`
5. Define Pydantic schemas in `schemas.py`
6. Implement repository in `repository.py`
7. Implement business logic in `service.py`
8. Define routes in `router.py` with dependency injection
9. Register router in `main.py`: `app.include_router({module_name}_router)`

### Adding a New Frontend Feature

1. Create components in `src/components/{feature}/`
2. Create API hooks in `src/api/hooks/use{Feature}.ts`
3. Create Zod schemas in `src/schemas/{feature}.ts`
4. Create page in `src/pages/panel/{Feature}Page.tsx`
5. Add route in `src/router.tsx`
6. Wrap protected pages with `PanelLayout` and `ProtectedRoute`

### Testing Checklist

- [ ] Backend: pytest tests in `apps/backend/tests/`
- [ ] Frontend: Vitest tests in `__tests__/` directories
- [ ] Integration: Test API endpoints with TestClient
- [ ] E2E: Test full user flows

### Code Style

- **Backend**: Ruff for linting/formatting
- **Frontend**: ESLint + Prettier
- **Commits**: Follow conventional commits (feat:, fix:, chore:, etc.)

---

## Module Status

| Module | Backend | Frontend | Tests | Status |
|--------|---------|----------|-------|--------|
| Auth | ✅ | ✅ | 🔄 | Active |
| Pricing | ✅ | ✅ | 🔄 | Active |
| Proposals | ✅ | ✅ | 🔄 | Active |
| Clients | ✅ | 🔄 | 🔄 | In Progress |
| Dashboard | ✅ | 🔄 | 🔄 | In Progress |
| Gallery | ✅ | 🔄 | 🔄 | In Progress |
| Network | ✅ | 🔄 | 🔄 | In Progress |
| Tasks | ✅ | 🔄 | 🔄 | In Progress |

Legend: ✅ Complete | 🔄 In Progress | ⏳ Pending

---

## Maintenance Notes

### Common Tasks

1. **Adding a field to a model**:
   - Update `models.py` → Run migration → Update `schemas.py` → Update tests

2. **Adding a new API endpoint**:
   - Add to `router.py` → Add service method → Add tests

3. **Adding a new page**:
   - Create component → Add route → Add API hooks → Add tests

### Troubleshooting

- **Database issues**: Check `alembic_version` table, run `alembic upgrade head`
- **Auth issues**: Verify JWT secret in env, check token expiry
- **CORS issues**: Verify `CORS_ORIGINS` in settings
- **OAuth issues**: Check callback URLs in Google Console

---

**Last Updated**: 2026-04-29
**Maintainers**: Check `implementations/action-plan.md` for current priorities
