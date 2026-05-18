# Spec – Café com BPO Platform

## 1. Project Overview

**Café com BPO** is a community platform for financial BPO (Business Process Outsourcing) operators who reject "get-rich-quick" formulas and seek practical, honest discussions about operations and pricing.

The platform transforms a static site into a full-featured application with three pillars:
- **Public site** – positioning, institutional content, and member acquisition.
- **Public pricing calculator** – open tool used as a value generator and lead magnet.
- **Authenticated member area** – community hub, content library, and advanced tools (including a full-featured pricing calculator with saved scenarios).

## 2. Architecture

### 2.1 Repository Structure

```
cafe_com_bpo/
├── apps/
│   ├── backend/          # FastAPI application (Python 3.12)
│   └── frontend/         # React + TypeScript application (Vite)
├── packages/
│   └── shared/           # Shared libraries (types, business rules, helpers)
├── infra/
│   └── nginx/            # Reverse proxy / gateway configuration
├── agent_skills/          # AI agent skill definitions
├── docs/                  # PRDs, design specs, implementation plans
├── spec/                  # Project specifications
├── docker-compose.yml     # Multi-service orchestration
└── .github/workflows/     # CI/CD pipeline
```

### 2.2 Docker Services

| Service  | Image/Build          | Purpose                                        |
|----------|----------------------|------------------------------------------------|
| `db`     | postgres:16-alpine   | Relational database with persistent volume     |
| `api`    | ./apps/backend       | FastAPI backend (port 8000, exposed via proxy) |
| `web`    | ./apps/frontend      | React frontend built for production            |
| `pgadmin`| dpage/pgadmin4       | Database administration interface              |
| `ollama` | ollama/ollama:latest | Local AI model inference                       |
| `gateway`| ./infra/nginx        | Nginx reverse proxy routing / and /api         |

### 2.3 CI/CD Pipeline

- **CI – Backend**: Python 3.12, Ruff linting, Pytest
- **CI – Frontend**: Node.js 22, ESLint, TypeScript typecheck, Vitest
- **CD – Build**: Docker images pushed to GHCR (`ghcr.io/<repo>/api` and `ghcr.io/<repo>/web`)
- **CD – Deploy**: Webhook-triggered deployment to Hostinger VPS

## 3. Tech Stack

### 3.1 Backend

| Layer        | Technology                           |
|--------------|--------------------------------------|
| Framework    | FastAPI                              |
| Validation   | Pydantic                             |
| ORM          | SQLAlchemy                           |
| Migrations   | Alembic                              |
| Database     | PostgreSQL 16                        |
| Auth         | JWT (HS256), OAuth (Google, Microsoft) |
| Password     | Passlib / pwdlib                     |
| Testing      | pytest, httpx, TestClient            |
| Logging      | Custom logger module                 |
| File Upload  | Cloudinary, OneDrive (avatar storage)|

### 3.2 Frontend

| Layer        | Technology                           |
|--------------|--------------------------------------|
| Framework    | React 18                             |
| Language     | TypeScript                           |
| Build        | Vite 5                               |
| Routing      | React Router v6                      |
| Forms        | React Hook Form + Zod                |
| Data Fetching| TanStack Query (React Query v5)      |
| HTTP Client  | Axios                                |
| PDF Rendering| @react-pdf/renderer                  |
| Drag & Drop  | @hello-pangea/dnd                    |
| Icons        | Lucide React                         |
| Testing      | Vitest, React Testing Library        |

### 3.3 Infrastructure

| Component    | Technology                           |
|--------------|--------------------------------------|
| Container    | Docker, Docker Compose               |
| Proxy        | Nginx                                |
| Hosting      | Hostinger VPS                        |
| CI/CD        | GitHub Actions                       |
| Container Registry | GitHub Container Registry (GHCR) |

## 4. Backend Modules

### 4.1 Module Directory

```
apps/backend/src/
├── main.py              # Application factory (create_app)
├── core/
│   ├── config.py        # Settings, environment validation
│   ├── database.py      # SQLAlchemy engine & session
│   ├── security.py      # JWT, password hashing utilities
│   └── logger.py        # Structured logging
├── modules/
│   ├── auth/            # Authentication & user management
│   ├── clients/         # Client CRUD & relationships
│   ├── dashboard/       # Dashboard data & analytics
│   ├── gallery/         # Media/gallery management
│   ├── network/         # Network/connection features
│   ├── pricing/         # Pricing calculator engine & API
│   ├── proposals/       # Proposal generation & management
│   └── tasks/           # Task management
├── oauth.py             # OAuth provider orchestration
└── services.py          # Shared service layer
```

### 4.2 Key Backend Components

| Component              | Description                                           |
|------------------------|-------------------------------------------------------|
| `Settings`             | Centralized environment configuration (Pydantic)      |
| `create_app()`         | FastAPI application factory with middleware & routers  |
| `User` / `PricingScenario` | ORM models for users and saved pricing scenarios  |
| `UserRepository` / `PricingScenarioRepository` | Repository pattern for data access |
| `PricingCalculator`    | Domain service for pricing calculations               |
| `PricingService`       | Application service translating schemas to domain     |
| `PasswordService`      | Password hashing and verification                     |
| `TokenService`         | JWT token creation and validation                     |
| `AuthService`          | Registration, authentication orchestration            |
| `OAuthStateService`    | CSRF protection for OAuth flows                       |
| `GoogleOAuthProvider`  | Google OAuth integration                              |
| `MicrosoftOAuthProvider` | Microsoft OAuth integration                         |

### 4.3 API Endpoints (by module)

| Module       | Prefix        | Purpose                              |
|--------------|---------------|--------------------------------------|
| Health       | `/health`     | Application health check             |
| Pricing      | `/pricing`    | Calculator endpoint, reports         |
| Auth         | `/auth`       | Register, login, OAuth, profile      |
| Clients      | `/clients`    | Client CRUD operations               |
| Proposals    | `/proposals`  | Proposal generation & management     |
| Gallery      | `/gallery`    | Media upload & retrieval             |
| Network      | `/network`    | Network/connection features          |
| Tasks        | `/tasks`      | Task CRUD operations                 |
| Dashboard    | `/dashboard`  | Dashboard data & analytics           |
| Avatars      | `/avatars`    | Static file serving (user avatars)   |

## 5. Frontend Structure

### 5.1 Directory Layout

```
apps/frontend/src/
├── main.tsx             # Entry point
├── App.tsx              # Root component with providers
├── router.tsx           # Route definitions (public & private)
├── api/                 # API client (Axios-based)
├── components/
│   ├── auth/            # Login, registration forms
│   ├── dashboard/       # Dashboard widgets
│   ├── panel/           # Member panel components
│   ├── pdf/             # PDF report generation
│   ├── pricing/         # Calculator form & results
│   ├── proposal/        # Proposal preview components
│   ├── tasks/           # Task management UI
│   └── ui/              # Reusable UI primitives
├── context/             # React contexts (Auth, etc.)
├── forms/               # Form-specific components & styles
├── lib/                 # Utility functions
├── pages/
│   ├── HomePage.tsx     # Landing page
│   ├── LoginPage.tsx    # Authentication page
│   ├── CadastroPage.tsx # Registration page
│   ├── DashboardPage.tsx# Member dashboard
│   ├── SimulatorPage.tsx# Pricing calculator
│   ├── ProposalPreviewPage.tsx
│   └── UnderConstructionPage.tsx
├── providers/           # Global providers (Auth, Query)
└── schemas/             # Zod validation schemas
```

### 5.2 Key Frontend Components

| Component        | Description                                      |
|------------------|--------------------------------------------------|
| `AppProviders`   | Aggregates QueryClient, Router, Auth providers   |
| `AuthProvider`   | React context for authentication state           |
| `useAuth()`      | Custom hook exposing login, logout, user state   |
| `ProtectedRoute` | Route guard for authenticated-only pages         |
| `apiClient`      | Axios wrapper with token injection & error handling |
| `LoginForm`      | Email/password login form with Zod validation    |
| `PricingForm`    | Multi-step calculator form with dynamic services |
| `PricingResultView` | Displays calculation breakdown & final price  |
| `ScenarioList` / `ScenarioCard` | Saved pricing scenarios UI        |

### 5.3 Pages & Routes

| Route                     | Access      | Description                        |
|---------------------------|-------------|------------------------------------|
| `/`                       | Public      | Landing/home page                  |
| `/login`                  | Public      | Authentication (login/register)    |
| `/calculadora-de-precificacao` | Public | Pricing calculator (no login required) |
| `/dashboard`              | Protected   | Member dashboard                   |
| `/ferramentas`            | Protected   | Tools directory (calculator, etc.) |
| `/conteudos`              | Protected   | Content library                    |
| `/comunidade`             | Protected   | Community links & rules            |
| `/biblioteca`             | Protected   | Templates, checklists, resources   |
| `/suporte`                | Protected   | FAQ & contact                      |
| `/perfil`                 | Protected   | User profile & settings            |
| `/proposta/:id`           | Public/Protected | Proposal preview              |

## 6. Pricing Calculator Domain

### 6.1 Domain Models

| Model               | Fields                                          |
|---------------------|-------------------------------------------------|
| `OperationContext`  | `total_cost`, `people_count`, `hours_per_month`, `tax_rate` |
| `ServiceItem`       | `name`, `minutes_per_execution`, `monthly_quantity`, `fixed_value?` |
| `PricingInput`      | `operation`, `services`, `desired_profit_margin` |
| `PricingBreakdown`  | `cost_per_hour`, `cost_per_minute`, `service_costs`, `total_service_cost`, `profit_amount`, `tax_amount` |
| `PricingResult`     | `final_price`, `breakdown`, `assumptions`       |

### 6.2 Calculation Engine

`PricingCalculator.calculate_final_price()` orchestrates:
1. `calculate_cost_per_hour()` – from total cost, people count, hours
2. `calculate_cost_per_minute()` – from cost per hour
3. `calculate_service_cost()` – per service item
4. `calculate_total_service_cost()` – sum of all services
5. `calculate_profit_amount()` – from desired margin
6. `calculate_tax_amount()` – from tax rate
7. Returns consolidated `PricingResult` with final suggested monthly price

### 6.3 Calculator Versions

| Version   | Features                                              |
|-----------|-------------------------------------------------------|
| Public    | Simplified form, HTML report on screen, gated download |
| Member    | Full form, save/duplicate/edit scenarios, PDF download, history by client |

## 7. Authentication Flow

### 7.1 Supported Methods

- Email + password (local)
- Google OAuth (Gmail)
- Microsoft OAuth (Outlook)

### 7.2 Flow

1. User accesses login/register page
2. Authenticates via chosen method
3. Backend issues JWT access token
4. Frontend stores token, sets user context
5. Protected routes accessible
6. Token validated on each API request via `Authorization` header

### 7.3 OAuth Flow

1. Frontend requests OAuth state token from backend
2. User redirected to provider (Google/Microsoft)
3. Provider redirects to callback with `code` + `state`
4. Backend validates state (CSRF protection), exchanges code for token
5. Backend fetches user profile from provider
6. Creates or links user account, issues JWT
7. Frontend receives token, completes login

## 8. Database Schema

### 8.1 Core Tables (via Alembic migrations)

| Table          | Key Columns                                    |
|----------------|------------------------------------------------|
| `users`        | `id`, `email`, `password_hash`, `auth_provider`, `name`, `company`, `avatar_url`, `created_at`, `updated_at` |
| `pricing_scenarios` | `id`, `user_id`, `client_name`, `input_payload` (JSON), `result_payload` (JSON), `created_at`, `updated_at` |
| `clients`      | `id`, `user_id`, `name`, `color`, `deleted_at` |
| `tasks`        | Task management fields                         |
| `proposals`    | Proposal generation fields                     |
| `network_*`    | Network/connection related models              |
| `user_files`   | File management fields                         |

### 8.2 Migration History

| Migration                              | Description                          |
|----------------------------------------|--------------------------------------|
| `345fdaac3155_initial_schema`          | Initial database schema              |
| `64ee92a381a1_add_client_model...`     | Added Client model, user avatar URL  |
| `3b813df4ed3f_add_deleted_at...`       | Soft delete for clients              |
| `03b662a6a1bb_add_network_models`      | Network module models                |
| `0001e729b3a8_add_user_files_table...` | User files table, user updates       |
| `7ed13e88c8f0_add_name_company...`     | Name and company fields on users     |
| `add_color_col_to_clients`             | Color column for clients             |
| `create_tasks_table`                   | Tasks table                          |

## 9. Design System

The frontend follows an **Apple-inspired design language** with:

- **Typography**: System fonts with tight tracking, compressed headlines (line-height ~1.07-1.14)
- **Color**: Binary light/dark section rhythm, single accent color for interactive elements
- **Layout**: Full-width sections, centered content, generous whitespace
- **Components**: Pill-shaped CTAs, soft card shadows, glass-effect navigation
- **Responsive**: Mobile-first, 9 breakpoints from 360px to >1440px

See `docs/DESIGN.md` for the complete design specification.

## 10. Non-Functional Requirements

| Requirement   | Specification                                |
|---------------|----------------------------------------------|
| Performance   | Fast page loads, lightweight asset usage     |
| Responsiveness| Mobile-first, first-class mobile experience  |
| Accessibility | Proper contrast, keyboard navigation, alt text |
| Security      | JWT auth, password hashing, input sanitization, CSRF protection for OAuth |
| Scalability   | Docker services, modular architecture, prepared for growth |

## 11. Development Principles

- **TDD**: Every feature must have tests before implementation
- **Repository Pattern**: Data access abstracted behind repositories
- **Service Layer**: Domain logic separated from HTTP layer
- **Dependency Injection**: FastAPI `Depends()` for all cross-cutting concerns
- **No secrets in code**: All sensitive config via environment variables
- **No raw user HTML**: All user input sanitized before rendering
- **Graceful degradation**: Cache failures never break the main flow

## 12. Commands

### Backend

```bash
cd apps/backend
pytest                          # Run tests
ruff check . && ruff format .   # Lint and format
```

### Frontend

```bash
cd apps/frontend
npm run dev                     # Development server
npm run build                   # Production build
npm run lint                    # ESLint
npm run typecheck               # TypeScript check
npm run test                    # Vitest
```

### Docker

```bash
docker compose up -d            # Start all services
docker compose down             # Stop all services
```
