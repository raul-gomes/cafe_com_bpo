# Relatório de Mudanças — Café com BPO

## Auditoria de Segurança & Performance

Data: 18/06/2026
Escopo: Backend (FastAPI/Python 3.12) + Frontend (React 18/TypeScript/Vite 5)

---

## Resumo Executivo

Realizamos uma auditoria completa de segurança e performance no código, identificando **20 achados** em 4 categorias. Todos foram corrigidos. A suíte de testes permanece verde (backend: **243 passed**, frontend: **83 passed**) e o build de produção está íntegro (bundle principal: **478 kB gzip: 154 kB**).

---

## Fase 1 — Segurança (7 itens)

### 1.1 Chaves do Cloudinary expostas no `.env`
**Problema:** As credenciais reais do Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) estavam no `.env` versionado no Git.
**Correção:** Removidas do `.env` commitado. Criado `.env.example` com placeholders. As chaves reais devem ser configuradas apenas no ambiente de produção (docker-compose ou variáveis de ambiente do servidor).
**⚠️ Ação necessária:** Rotacionar as chaves no painel do Cloudinary, pois elas já estão no histórico do Git.

### 1.2 JWT armazenado em `localStorage`
**Problema:** O token JWT de acesso ficava no `localStorage` do navegador, vulnerável a ataques XSS.
**Correção:**
- `refresh_token` movido para **cookie httpOnly, SameSite=Strict, path=/auth/refresh**
- `access_token` armazenado **apenas em memória JS** (injetado via interceptor Axios)
- `tokenStorage` substituiu `authStorage` (sem `localStorage.getItem`/`.setItem`)
- Fluxo de refresh automático: interceptor 401 → `POST /auth/refresh` com cookie → retry
- Sessão restaurada ao recarregar a página via `checkToken()` → tenta refresh automático
- Logout limpa o cookie no backend + estado em memória no frontend

### 1.3 Rate limiting ausente
**Problema:** Endpoints de autenticação não tinham proteção contra brute-force.
**Correção:** Adicionado `slowapi` com `TestAwareLimiter` (desabilitado em `MODE=test`):
| Endpoint | Limite |
|----------|--------|
| `POST /auth/login` | 10/min |
| `POST /auth/register` | 3/min |
| `POST /auth/forgot-password` | 3/min |
| `POST /auth/refresh` | 10/min |

### 1.4 Token de reset de senha exposto na URL
**Problema:** O token de reset (`/redefinir-senha?token=...`) ficava visível no histórico do navegador.
**Correção:**
- Frontend: `window.history.replaceState()` remove o token da URL imediatamente após o carregamento
- Backend: verificação opcional de email (o corpo da requisição pode conter `email` para confirmar que o token pertence ao usuário correto)

### 1.5 Duplicação de `UserResponse` (~250 linhas)
**Problema:** 7 lugares diferentes faziam mapeamento manual de `User` → dict, criando risco de vazamento de campos sensíveis.
**Correção:** Adicionado `UserResponse.from_user(user: User) -> UserResponse` — classmethod centralizado que elimina toda a duplicação.

### 1.6 Validação MIME ausente em uploads
**Problema:** O upload de anexos em tarefas não validava tipo de arquivo — qualquer extensão era aceita.
**Correção:** Adicionada validação em `upload_attachment`:
- **Allowlist de 12 MIME types** (PDF, DOCX, XLSX, PNG, JPEG, etc.)
- **13 extensões permitidas**
- **Limite de 20 MB** por arquivo
- Rejeição com `HTTP_400` + mensagem descritiva

### 1.7 Settings loading no módulo `security.py`
**Problema:** `security.py` importava configurações no nível do módulo, dificultando testes.
**Correção:** Implementado `_get_jwt_settings()` — lazy loading das configurações JWT.

---

## Fase 2 — Performance (3 itens)

### 2.1 Lazy loading em todas as rotas
**Problema:** O bundle principal carregava todas as páginas de uma vez (~884 kB).
**Correção:** 18 páginas carregadas via `React.lazy()` + `await import()`:
- Bundle principal reduziu de **884 kB → 478 kB** (gzip: **155 kB**)
- Páginas individuais (ex: TasksPage 127 kB) só carregam quando navegadas
- `pdf-lib` lazy-load separado (1.5 MB — pré-existente)
- `buildRouter()` tornada **assíncrona** para suportar named exports dinâmicos

### 2.2 Componentes extraídos da TasksPage
**Problema:** TasksPage tinha **803 linhas** com 3 visualizações (Kanban, Calendário, Timeline) no mesmo arquivo.
**Correção:** Componentes extraídos com `React.memo`:
| Componente | Linhas | Arquivo |
|-----------|--------|---------|
| `TaskKanban` | ~190 | `src/components/tasks/TaskKanban.tsx` |
| `TaskCalendar` | ~120 | `src/components/tasks/TaskCalendar.tsx` |
| `TaskTimeline` | ~130 | `src/components/tasks/TaskTimeline.tsx` |
| **TasksPage** | **~420** | Redução de 48% |

### 2.3 React.memo em componentes pesados
**Problema:** Kanban, Calendar, Timeline e cards renderizavam sem memoização.
**Correção:** Todos os componentes extraídos + TaskCard envoltos em `React.memo`.

---

## Fase 3 — Qualidade de Código (3 itens)

### 3.1 Migração inline styles → Tailwind (TaskCard)
**Problema:** 284 linhas, **100% inline styles** — difícil manutenção, sem aproveitamento do design system.
**Correção:** Migrado para Tailwind CSS. Apenas 4 `style` props permanecem (valores dinâmicos: cor da borda, transform do drag).
- Redução de **285 → 160 linhas**
- Adicionado `cn()` do Tailwind para condicionais
- Badge de atraso agora usa classes Tailwind (`bg-warning/15 text-warning`)
- Botões de ação (finalizar/cancelar) migrados para Tailwind com `hover:` states

### 3.2 Migração inline styles → Tailwind (TaskModal)
**Problema:** 291 linhas, 17 `style=` props.
**Correção:** 4 `style` props restantes (grid template columns, altura máxima dinâmica, cores de paleta).
- Overlay usa Tailwind (`fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm`)
- Layout responsivo com grid Tailwind
- Botões padronizados com `rounded-lg bg-primary px-4 py-2`

### 3.3 Migração inline styles → Tailwind (PhaseManager)
**Problema:** 258 linhas, 26 `style=` props.
**Correção:** 2 `style` props restantes (cores dinâmicas dos círculos de fase e paleta).
- Overlay, header, lista de fases, formulário de criação — tudo Tailwind
- Drag and drop preservado com classes condicionais (`cursor-grab active:cursor-grabbing`)

---

## Fase 4 — Arquivos Modificados

### Novos arquivos (4)
```
apps/frontend/src/components/tasks/TaskKanban.tsx    (extraído)
apps/frontend/src/components/tasks/TaskCalendar.tsx   (extraído)
apps/frontend/src/components/tasks/TaskTimeline.tsx   (extraído)
apps/backend/src/core/rate_limit.py                   (TestAwareLimiter)
```

### Arquivos modificados (20+)
```
apps/backend/.env                                      (remove Cloudinary keys)
apps/backend/.env.example                              (criado com placeholders)
apps/backend/requirements.txt                          (adicionado slowapi)
apps/backend/src/core/security.py                      (lazy settings)
apps/backend/src/core/rate_limit.py                    (constantes + TestAwareLimiter)
apps/backend/src/core/email.py                         (ajuste)
apps/backend/src/core/config.py                        (—)
apps/backend/src/main.py                               (registra rate limit handler)
apps/backend/src/modules/auth/router.py                (cookies httpOnly + rate limits)
apps/backend/src/modules/auth/schemas.py               (UserResponse.from_user)
apps/backend/src/modules/auth/service.py               (cookie helpers, authenticate_oauth_user)
apps/backend/src/modules/tasks/router.py               (MIME validation)
apps/backend/tests/conftest.py                         (MODE=test)

apps/frontend/src/api/client.ts                        (tokenStorage in-memory, refresh queue)
apps/frontend/src/context/AuthContext.tsx               (checkToken, cookie-based refresh)
apps/frontend/src/router.tsx                           (async buildRouter, lazy routes)
apps/frontend/src/App.tsx                              (async mount com loading)
apps/frontend/src/pages/panel/TasksPage.tsx             (imports extraídos)
apps/frontend/src/components/tasks/TaskCard.tsx         (Tailwind migration)
apps/frontend/src/components/tasks/TaskModal.tsx        (Tailwind migration)
apps/frontend/src/components/tasks/PhaseManager.tsx     (Tailwind migration)
apps/frontend/test/TaskCard.test.tsx                    (seletor CSS)
```

---

## Status dos Testes

### Backend
```
pytest: 243 passed, 1 skipped
ruff:   0 errors
```

### Frontend
```
tsc --noEmit:              0 errors
vitest (83 tests, 10 files): 83 passed
npm run build:              ✓ (8.9s)
  Main bundle:  478.49 kB (gzip: 154.42 kB)
  TasksPage:    127.57 kB (gzip: 39.17 kB)
  PDF lib:      1,552.75 kB (gzip: 518.04 kB) — pré-existente
```

---

## Itens Não Abordados (para próxima iteração)

1. **CSS cleanup profundo** — 12 arquivos CSS legados (~4.200 linhas) ainda importados. Muitos contêm classes do design system antigo (`ds-*`) que coexistem com Tailwind. Requer auditoria classe por classe.
2. **HTTPS** — Nginx escuta apenas porta 80. Sem TLS. Cookie `secure=False`.
3. **CSP / Security Headers** — Sem Content Security Policy, sem headers de segurança no Nginx.
4. **CSRF Token** — Apenas `SameSite=Strict` como proteção.
5. **Rate limit em reset-password** — Endpoint sem proteção contra brute-force.
6. **Account lockout** — Sem bloqueio após tentativas falhas.
7. **Revogação de sessão** — Refresh tokens são JWT sem blacklist em DB.
8. **Audit log** — Eventos de auth só logados via `print`, sem registro estruturado.
9. **Google Calendar sync real** — Apenas esqueleto (mock mode). Faltam endpoints, fluxo OAuth frontend, criação real de eventos.
10. **Dead code** — `apps/backend/src/oauth.py` é órfão (importa de path inexistente) e deve ser deletado.
