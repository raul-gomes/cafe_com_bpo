# Module Dependencies Diagram

## Backend Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                        FastAPI App                             │
│                      (main.py)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│     Auth      │    │    Pricing    │    │   Proposals   │
│ modules/auth/ │    │modules/pricing│    │modules/proposals│
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        │                     │                     │
        ▼                     │                     ▼
┌───────────────┐             │              ┌───────────────┐
│  Core Modules │             │              │   PDF Gen     │
│  config.py    │             │              │   Email/WA    │
│  database.py  │             │              └───────────────┘
│  security.py  │             │
│  logger.py    │             │
└───────────────┘             │
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    Clients    │    │   Dashboard   │    │    Gallery    │
│modules/clients│    │modules/dashboard│   │modules/gallery│
└───────────────┘    └───────────────┘    └───────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    Network    │    │     Tasks     │    │   (Future)    │
│modules/network│    │ modules/tasks │    │  Documents,   │
└───────────────┘    └───────────────┘    │  Payments, AI │
                                           └───────────────┘
```

## Frontend Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                     React App (main.tsx)                       │
│                    (providers/Auth + Query)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Router.tsx     │
                    │  (routes)       │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Public Pages │    │  Auth Pages   │    │  Panel Pages  │
│  Home, About  │    │ Login, Register│   │  /painel/*    │
└───────────────┘    └───────────────┘    └───────────────┘
                               │                   │
                               │                   ▼
                               │           ┌───────────────┐
                               │           │  PanelLayout  │
                               │           │  (sidebar+)   │
                               │           └───────────────┘
                               │                   │
                               │   ┌───────────────┼───────────────┐
                               │   │               │               │
                               │   ▼               ▼               ▼
                               │┌─────────┐  ┌─────────┐  ┌─────────┐
                               ││Pricing  │  │Proposals│  │  Tasks  │
                               ││Components│ │Components│  │Components│
                               │└─────────┘  └─────────┘  └─────────┘
                               │       │            │            │
                               └───────┼────────────┼────────────┘
                                       │            │
                                       ▼            ▼
                              ┌─────────────────────────────┐
                              │    API Hooks (TanStack)     │
                              │  useAuth, usePricing, etc   │
                              └─────────────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────────────────┐
                              │  AuthContext (JWT state)    │
                              │  schemas/ (Zod validation)  │
                              └─────────────────────────────┘
```

## Module Dependency Matrix

| Module | Depends On | Used By |
|--------|-----------|---------|
| **Backend** |
| auth | core/* | All modules (user context) |
| pricing | core/database | proposals |
| proposals | auth, pricing, pdf | - |
| clients | auth, core/database | dashboard, proposals |
| dashboard | auth, clients, proposals, tasks | - |
| gallery | auth, core/database, storage | - |
| network | auth, core/database | - |
| tasks | auth, core/database | dashboard |
| **Frontend** |
| auth/* | AuthContext, api/hooks | ProtectedRoute, PanelLayout |
| panel/* | AuthContext, components/* | pages/panel/* |
| pricing/* | api/hooks, lib/pricingEngine | pages/panel/Pricing |
| proposal/* | api/hooks, lib/pdf | pages/panel/Proposals |
| tasks/* | api/hooks | pages/panel/Tasks |
| api/hooks | AuthContext (JWT) | All feature components |
| context/Auth | - | All authenticated components |

## Service Layer Dependencies

```
┌─────────────────────────────────────────────┐
│              FastAPI Dependencies            │
│         (Depends() injection)               │
└─────────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    ▼               ▼               ▼
Database      Security       Config
Session       (JWT)          (Settings)
    │               │               │
    └───────────────┼───────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
    Auth        Pricing     Proposals
    Service     Service     Service
        │           │           │
        └───────────┼───────────┘
                    │
            ┌───────┴───────┐
            │               │
            ▼               ▼
        Clients         Tasks
        Service         Service
```

## Quick Reference - Import Paths

### Backend
```python
# Core
from src.core.config import get_settings
from src.core.database import get_db
from src.core.security import create_access_token

# Modules
from src.modules.auth.service import AuthService
from src.modules.pricing.service import PricingService
```

### Frontend
```typescript
// Components
import { Button, Input } from '@/components'
import { PricingCalculator } from '@/components/pricing'

// API
import { useLogin, useProposals } from '@/api'

// Hooks & Context
import { useAuth } from '@/context/AuthContext'
import { pricingEngine } from '@/lib/pricingEngine'
```
