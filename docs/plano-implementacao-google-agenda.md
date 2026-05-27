# Plano de Implementação — Google Agenda Sync

**Baseado em:** FASE 8.3 do `docs/plano-implementacao-todo.md`
**Status do esqueleto atual:** Módulo `src/modules/calendar/` com mock, endpoint POST /calendar/sync e GET /calendar/auth-url, botão "Sincronizar" no frontend
**Objetivo:** Substituir o mock por integração real com Google Calendar API v3

---

## Arquitetura

```
[Frontend]
    │ POST /calendar/sync { task_ids }
    ▼
[FastAPI] → GoogleCalendarService → httpx → Google Calendar API v3
    │              ↕
    │      UserGoogleToken (DB)
    │      - user_id (unique)
    │      - access_token (encrypted)
    │      - refresh_token (encrypted)
    │      - expires_at
    │      - scope
    │
    │ GET /calendar/auth-url → URL de autorização (escopo calendar.events)
    │ GET /calendar/callback?code=xxx → troca code por tokens, salva no DB
    │ GET /calendar/status → { connected: bool, email?: string }
```

---

## Fluxo Completo

1. Usuário clica "Sincronizar" no frontend
2. Frontend chama `GET /calendar/auth-url` → recebe URL de autorização Google
3. Frontend abre popup/redirect para URL (escopo `calendar.events`)
4. Usuário autoriza no Google
5. Google redireciona para `GET /calendar/callback?code=xxx&state=yyy`
6. Backend valida state, troca code por access_token + refresh_token, salva em `UserGoogleToken`
7. Frontend (que estava aguardando) chama `POST /calendar/sync { task_ids }`
8. Backend: refresh token se expirado → para cada task → cria evento via Google Calendar API v3
9. Retorna `{ synced: N, failed: 0, details: [...] }`

---

## Modelo: `UserGoogleToken`

```python
class UserGoogleToken(Base):
    __tablename__ = "user_google_tokens"
    id: UUID (PK, default uuid4)
    user_id: UUID (FK → users.id, unique, nullable=False)
    access_token: str (nullable=False)
    refresh_token: str (nullable=False)
    token_type: str = "Bearer"
    expires_at: datetime (timezone=True, nullable=False)
    scope: str (nullable=False)
    created_at: datetime (server_default=func.now())
    updated_at: datetime (server_default=func.now(), onupdate=func.now())
```

**Unique constraint:** `user_id` (um token por usuário — upsert no callback).

---

## Endpoints

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/calendar/auth-url` | Retorna URL de autorização Google (escopo calendar.events) | ✅ Existe (atualizar) |
| GET | `/calendar/callback` | Callback OAuth — troca code por tokens, salva no DB | ❌ Criar |
| POST | `/calendar/sync` | Sincroniza tasks selecionadas para Google Calendar | ✅ Existe (implementar real) |
| GET | `/calendar/status` | Retorna se usuário tem token válido | ❌ Criar |

---

## Mapeamento Task → Google Calendar Event

| Campo do Evento | Fonte | Exemplo |
|-----------------|-------|---------|
| `summary` | `task.title` | "Entregar DCTF Mensal" |
| `description` | `task.description + "\n\n" + "📋 Notas: " + task.notes + "\n🏢 Cliente: " + client_name` | "Entregar DCTF referente ao mês…" |
| `start.date` | `task.deadline` (all-day) | "2026-06-15" |
| `end.date` | `task.deadline` + 1 dia (all-day) | "2026-06-16" |
| `colorId` | `1`=lavanda(deadline hoje), `2`=sálvia(prazo normal), `11`=vermelho(atrasado) | "2" |
| `reminders.overrides` | 24h antes (padrão) | `{ method: "email", minutes: 1440 }` |

**Tasks sem deadline são ignoradas** (não é possível criar evento sem data).

---

## Tarefas de Implementação

### Tarefa 8.3a — Modelo `UserGoogleToken` + migration

| Item | Detalhe |
|------|---------|
| **Arquivos** | `apps/backend/src/modules/calendar/models.py`, `apps/backend/src/modules/calendar/schemas.py` |
| **Modelo** | `UserGoogleToken` com os campos descritos acima |
| **Schema** | `UserGoogleTokenResponse` (sem tokens expostos), `TokenStatusResponse { connected: bool, email: str \| None }` |
| **Import** | Adicionar import do model em `src/core/database.py` (se necessário) |
| **Migração** | `alembic revision --autogenerate -m "add user_google_tokens table"` |
| **Testes** | `test_create_token`, `test_token_unique_per_user`, `test_token_response_hides_secret` |
| **Commit** | `feat(calendar): add UserGoogleToken model and migration` |

### Tarefa 8.3b — OAuth callback endpoint

| Item | Detalhe |
|------|---------|
| **Arquivos** | `apps/backend/src/modules/calendar/router.py` (+service.py) |
| **Endpoint** | `GET /calendar/callback?code=xxx&state=yyy` |
| **Lógica** | Validar state com `OAuthStateService.validate_state()` → trocar code por tokens via https POST para Google → upsert `UserGoogleToken` |
| **Segurança** | State validate impede CSRF; redirect URI deve estar registrada no Google Cloud Console |
| **Testes** | `test_callback_exchanges_code` (mock httpx), `test_callback_invalid_state_returns_400`, `test_callback_saves_token_to_db` |
| **Commit** | `feat(calendar): add OAuth callback endpoint for Google Calendar` |

### Tarefa 8.3c — Refresh automático de token

| Item | Detalhe |
|------|---------|
| **Arquivos** | `apps/backend/src/modules/calendar/service.py` |
| **Método** | `_ensure_valid_token(user_id) → str` (retorna access_token válido) |
| **Lógica** | Buscar token do DB; se `expires_at < now() + 5min`, usa refresh_token para obter novo access_token via Google; atualiza no DB |
| **Testes** | `test_token_refresh_when_expired`, `test_token_not_refreshed_when_valid`, `test_refresh_fails_without_refresh_token` |
| **Commit** | `feat(calendar): add automatic token refresh for Google Calendar` |

### Tarefa 8.3d — Criação real de eventos no Google Calendar

| Item | Detalhe |
|------|---------|
| **Arquivos** | `apps/backend/src/modules/calendar/service.py` |
| **Método** | `_create_calendar_event(access_token, task, client_name) → dict` |
| **API** | `POST https://www.googleapis.com/calendar/v3/calendars/primary/events` com headers `Authorization: Bearer {token}` |
| **Payload** | Segue mapeamento Task → Event definido acima |
| **Testes** | `test_event_created_via_api` (mock httpx), `test_event_skipped_without_deadline`, `test_event_includes_notes_in_description` |
| **Commit** | `feat(calendar): implement real Google Calendar event creation` |

### Tarefa 8.3e — Sync lógico completo

| Item | Detalhe |
|------|---------|
| **Arquivos** | `apps/backend/src/modules/calendar/service.py`, `router.py` |
| **Método** | `sync_tasks_to_calendar(user_id, task_ids) → dict` (versão real) |
| **Lógica** | 1. Obter token válido → 2. Buscar tasks no DB → 3. Filtrar tasks com deadline → 4. Para cada task, chamar `_create_calendar_event()` → 5. Retornar `{ synced, failed, details }` |
| **Tratamento de erros** | Se uma task falha, continua com as demais (não aborta batch) |
| **Rate limit** | Delay de 100ms entre chamadas; max 50 tasks por sync |
| **Testes** | `test_sync_multiple_tasks`, `test_sync_without_token_returns_401_error`, `test_sync_partial_failure` |
| **Commit** | `feat(calendar): complete sync flow with real API calls` |

### Tarefa 8.3f — Frontend: fluxo OAuth completo

| Item | Detalhe |
|------|---------|
| **Arquivos** | `apps/frontend/src/pages/panel/TasksPage.tsx` |
| **Alteração** | Botão "Sincronizar" abre popup OAuth; aguarda callback; após conexão, dispara sync |
| **Fluxo** | 1. GET `/calendar/auth-url` → 2. `window.open(url, 'google-oauth', 'width=600,height=700')` → 3. Poll `/calendar/status` a cada 2s → 4. Quando `connected=true`, dispara POST `/calendar/sync` |
| **UX** | Estado "Conectando…" durante OAuth; "Sincronizando…" durante sync; feedback de sucesso/erro |
| **Testes** | `test_calendar_button_starts_oauth`, `test_shows_syncing_state` (mock apiClient) |
| **Commit** | `feat(panel): complete OAuth flow for Google Calendar sync` |

### Tarefa 8.3g — Frontend: indicador de status de conexão

| Item | Detalhe |
|------|---------|
| **Arquivos** | `apps/frontend/src/pages/panel/TasksPage.tsx` |
| **Alteração** | Botão "Sincronizar" mostra: 🔴 "Desconectado" (clicável), 🟢 "Sincronizado" (com tooltip do email) |
| **Lógica** | `GET /calendar/status` na montagem da página; se `connected=true`, exibe verde |
| **Testes** | `test_shows_connected_status`, `test_shows_disconnected_status` |
| **Commit** | `feat(panel): show Google Calendar connection status` |

### Tarefa 8.3h — Tratamento de erros e edge cases

| Item | Detalhe |
|------|---------|
| **Casos** | Token expirado sem refresh token, quota excedida (HTTP 403), task sem deadline, rede indisponível, usuário revoga permissão |
| **Mensagens** | Erros traduzidos para pt-BR no frontend |
| **Fallback** | Se sync falha, botão permanece clicável para tentar novamente |
| **Testes** | `test_sync_quota_exceeded`, `test_sync_token_revoked`, `test_sync_empty_deadlines` |
| **Commit** | `fix(calendar): add error handling for all sync failure modes` |

### Tarefa 8.3i — Regressão completa

| Item | Detalhe |
|------|---------|
| **Backend** | `pytest` — todos os testes existentes + novos (baseline ~210+) |
| **Frontend** | `npm run typecheck` + `npm run test` |
| **Docker** | `docker compose up --build -d` — verificar entrypoint com migration |
| **Commit** | (opcional — pode ser incorporado nos commits acima) |

---

## Variáveis de Ambiente

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `GOOGLE_CALENDAR_CLIENT_ID` | Sim | "" | Client ID do projeto Google Cloud (escopo calendar.events) |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Sim | "" | Client Secret correspondente |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Sim | "http://localhost:3000/calendar/callback" | Redirect URI registrada no Google Cloud |

**Configuração necessária no Google Cloud Console:**
- Criar/OAuth consent screen com escopo `https://www.googleapis.com/auth/calendar.events`
- Adicionar redirect URI (ex: `https://seudominio.com/api/calendar/callback`)
- Test user (enquanto app estiver em publishing status "Testing")

---

## Dependências

- `httpx` — já instalado (usado no OAuth de login)
- Nenhuma lib nova — Google Calendar API v3 via REST direto

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Token expira durante sync | Média | Alto | Refresh automático antes de cada chamada API |
| Quota excedida (10k req/dia grátis) | Baixa | Médio | Limitar sync a max 50 tasks; adicionar delay entre chamadas |
| Usuário revoga permissão | Baixa | Baixo | `GET /calendar/status` detecta; botão oferece reconexão |
| Task sem deadline | Média | Baixo | Ignorar task com warning no detalhe |
| Redirect URI mismatch | Baixa | Alto | Documentar configuração necessária no Google Cloud |

---

## Ordem de Implementação Sugerida

```
8.3a (model) → 8.3b (callback) → 8.3c (refresh) → 8.3d (event creation)
                                                        ↓
                                             8.3e (sync lógico)
                                                  ↓
                                         8.3f + 8.3g (frontend)
                                                  ↓
                                             8.3h (erros)
                                                  ↓
                                             8.3i (regressão)
```

Cada tarefa segue TDD: escrever teste → RED → GREEN → REFACTOR → regressão → commit.
