# Guia de Implementação — Google Auth + Sincronização de Agenda

## Status Atual

| Funcionalidade | Status | Detalhes |
|---------------|--------|----------|
| **Login com Google (OAuth 2.0)** | ✅ **Completo** | Funcionando: botão "Google" no login → redirect → callback → JWT |
| **Sincronização com Google Agenda** | 🔶 **Esqueleto (mock)** | Código backend existe mas sem integração real. Frontend chama `POST /calendar/sync` que retorna sucesso fictício. |

---

## Parte 1: Login com Google (já implementado)

### 1.1 Visão geral do fluxo

```
Usuário clica "Google"            Frontend GET /auth/google/login
       ↓                                  ↓
Redirecionado para Google      Backend retorna URL de autorização
(consent screen)                (com state JWT + redirect_uri)
       ↓
Usuário autoriza               Google redireciona para:
       ↓                        GET /auth/google/callback?code=...&state=...
Backend troca code por token,
busca perfil na Google API,
cria/login do usuário,
gera JWT,
redireciona para:
   /auth/callback?token=<jwt>
       ↓
OAuthCallbackPage lê token,
chama login(token),
navega para /painel
```

### 1.2 Arquivos envolvidos

| Camada | Arquivo | O que faz |
|--------|---------|-----------|
| Config | `src/core/config.py` | Lê `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_USERINFO_URL`, `OAUTH_REDIRECT_URI` |
| OAuth | `src/modules/auth/oauth/service.py` | `GoogleOAuthProvider` — monta URL de auth, troca code por token, busca user info |
| Router | `src/modules/auth/router.py` | `GET /auth/{provider}/login` e `GET /auth/{provider}/callback` |
| Service | `src/modules/auth/service.py` | `authenticate_oauth_user()` — cria usuário se for novo, retorna JWT |
| Frontend | `LoginForm.tsx` | Botão "Google" → `GET /auth/google/login` → redirect |
| Frontend | `OAuthCallbackPage.tsx` | Lê token da URL → `login(token)` → `/painel` |

### 1.3 Para verificar se está funcionando

1. Configure as variáveis `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `OAUTH_REDIRECT_URI` no `.env`
2. Suba o ambiente (`docker compose up`)
3. Acesse `http://localhost/login`, clique em "Google"
4. Autorize no Google
5. Você deve ser redirecionado de volta para `/painel` logado

---

## Parte 2: Sincronização com Google Agenda (a implementar)

### 2.1 Arquitetura pretendida

```
Frontend (TasksPage)                  Backend
       │                                  │
       │ 1. Verificar status          GET /calendar/status
       │ ← TokenStatusResponse            │
       │                                  │
       │ 2. Se não conectado:         GET /calendar/auth-url
       │ ← auth_url                       │
       │ Abre popup OAuth                 │
       │                                  │
       │ 3. Usuário autoriza            Google redireciona para:
       │                              GET /calendar/callback?code=...
       │    ↑                           Backend troca code, salva token, fecha popup
       │    │ (postMessage)              
       │ 4. Frontend descobre          Página callback abre, envia msg ao opener
       │ que conectou                     
       │                                  │
       │ 5. Sincronizar tarefas        POST /calendar/sync { task_ids }
       │ ← CalendarSyncResponse           │
       │    task_ids → eventos reais      Cria eventos no Google Calendar
       │                                  │
```

### 2.2 Pré-requisitos

1. **Google Cloud Console:**
   - Ative a **Google Calendar API** em `APIs & Services → Library`
   - Crie um **OAuth 2.0 Client ID** separado para o calendário
   - Adicione redirect URI: `http://localhost:3000/calendar/callback` (dev)

2. **Adicione ao `.env`:**
   ```ini
   GOOGLE_CALENDAR_CLIENT_ID=seu-client-id-calendario.apps.googleusercontent.com
   GOOGLE_CALENDAR_CLIENT_SECRET=seu-client-secret-calendario
   GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/calendar/callback
   ```

3. **Adicione ao `docker-compose.yml`** (seção `backend.environment`):
   ```yaml
   - GOOGLE_CALENDAR_CLIENT_ID=${GOOGLE_CALENDAR_CLIENT_ID}
   - GOOGLE_CALENDAR_CLIENT_SECRET=${GOOGLE_CALENDAR_CLIENT_SECRET}
   - GOOGLE_CALENDAR_REDIRECT_URI=${GOOGLE_CALENDAR_REDIRECT_URI}
   ```

4. **Adicione ao `.github/workflows/main.yml`** (seção `env` ou `jobs.backend.env`):
   ```yaml
   GOOGLE_CALENDAR_CLIENT_ID: ""
   GOOGLE_CALENDAR_CLIENT_SECRET: ""
   GOOGLE_CALENDAR_REDIRECT_URI: ""
   ```

### 2.3 Passo a passo da implementação

---

#### Passo 1: Criar endpoint `GET /calendar/callback` (backend)

**Arquivo:** `apps/backend/src/modules/calendar/router.py`

Adicione a rota para receber o callback OAuth do Google:

```python
@router.get("/callback")
async def calendar_oauth_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    calendar_service: GoogleCalendarService = Depends(get_calendar_service),
):
    """Recebe o callback OAuth do Google Agenda, troca code por token e salva."""
    result = await calendar_service.exchange_code_for_token(code, current_user.id)
    await calendar_service.save_token_from_callback(result, current_user.id)
    
    # Redireciona para o frontend com sinal de sucesso
    from fastapi.responses import RedirectResponse
    frontend_url = get_settings().frontend_url
    return RedirectResponse(url=f"{frontend_url}/calendar/callback?connected=true")
```

---

#### Passo 2: Implementar criação real de eventos (backend)

**Arquivo:** `apps/backend/src/modules/calendar/service.py`

Substitua o trecho `# TODO: In 8.3d/8.3e, replace with real event creation` por:

```python
# requirements.txt precisa de: google-api-python-client
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

async def _create_calendar_event(
    self, task: TaskResponse, user_id: str
) -> dict:
    """Cria um evento real no Google Calendar para uma tarefa."""
    token = await self._ensure_valid_token(user_id)
    
    creds = Credentials(
        token=token.access_token,
        refresh_token=token.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=get_settings().google_calendar_client_id,
        client_secret=get_settings().google_calendar_client_secret,
    )
    
    service = build("calendar", "v3", credentials=creds)
    
    event = {
        "summary": task.title,
        "description": task.description or "",
        "start": {
            "dateTime": f"{task.deadline or '2025-01-01'}T09:00:00",
            "timeZone": "America/Sao_Paulo",
        },
        "end": {
            "dateTime": f"{task.deadline or '2025-01-01'}T10:00:00",
            "timeZone": "America/Sao_Paulo",
        },
        "reminders": {"useDefault": True},
    }
    
    created = service.events().insert(calendarId="primary", body=event).execute()
    
    return {
        "task_id": task.id,
        "event_id": created.get("id"),
        "html_link": created.get("htmlLink"),
    }
```

E no método `sync_tasks_to_calendar`, chame `_create_calendar_event` para cada task.

**Importante:** Adicione ao `requirements.txt`:
```
google-api-python-client>=2.108.0
google-auth-httplib2>=0.1.1
google-auth-oauthlib>=1.0.0
```

---

#### Passo 3: Implementar fluxo OAuth no frontend

**Arquivo:** `apps/frontend/src/pages/CalendarCallbackPage.tsx`

Crie uma nova página para o callback do calendário:

```tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const CalendarCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    
    if (connected === 'true') {
      // Tenta enviar mensagem para a janela pai (popup)
      if (window.opener) {
        window.opener.postMessage({ type: 'calendar-connected' }, window.origin);
        window.close();
      } else {
        // Navegação direta (não veio de popup)
        toast.success('Google Agenda conectada com sucesso!');
        navigate('/painel/tarefas');
      }
    } else {
      toast.error('Falha ao conectar Google Agenda.');
      navigate('/painel/tarefas');
    }
  }, [navigate]);
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Conectando Google Agenda...</p>
    </div>
  );
};
```

Adicione a rota em `apps/frontend/src/router.tsx`:
```tsx
// Adicione nos imports dinâmicos:
const CalendarCallbackPage = React.lazy(() => 
  import('../pages/CalendarCallbackPage').then(m => ({ default: m.CalendarCallbackPage }))
);

// Adicione nas rotas:
{ path: "/calendar/callback", element: <SuspenseWrapper><CalendarCallbackPage /></SuspenseWrapper> },
```

---

#### Passo 4: Atualizar botão "Sincronizar" no frontend

**Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx`

Modifique o handler `handleSyncCalendar` para:

```tsx
const handleSyncCalendar = async () => {
  try {
    // 1. Verificar status da conexão
    const { data: status } = await apiClient.get('/calendar/status');
    
    if (!status.connected) {
      // 2. Se não conectado, abrir popup OAuth
      const { data: authData } = await apiClient.get('/calendar/auth-url');
      
      // Abre popup centralizado
      const width = 600, height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      const popup = window.open(
        authData.auth_url,
        'Conectar Google Agenda',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      // 3. Aguarda a mensagem do popup
      const result = await new Promise<void>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          if (event.origin !== window.origin) return;
          if (event.data?.type === 'calendar-connected') {
            window.removeEventListener('message', handler);
            resolve();
          }
        };
        window.addEventListener('message', handler);
        
        // Timeout de 5 minutos
        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Tempo limite excedido'));
        }, 5 * 60 * 1000);
      });
    }
    
    // 4. Sincronizar tarefas ativas
    const activeTaskIds = tasksList
      .filter(t => t.status !== 'done' && t.status !== 'cancelled' && !t.cancelled_at)
      .map(t => t.id);
    
    if (activeTaskIds.length === 0) {
      toast.info('Nenhuma tarefa ativa para sincronizar.');
      return;
    }
    
    const { data: syncResult } = await apiClient.post('/calendar/sync', {
      task_ids: activeTaskIds,
    });
    
    const syncedCount = syncResult.synced?.length || 0;
    const failedCount = syncResult.failed?.length || 0;
    
    if (failedCount > 0) {
      toast.warning(`${syncedCount} tarefa(s) sincronizada(s), ${failedCount} falha(s).`);
    } else {
      toast.success(`${syncedCount} tarefa(s) sincronizada(s) com Google Agenda!`);
    }
    
  } catch (err: any) {
    const detail = err?.response?.data?.detail || err.message || 'Erro ao sincronizar';
    toast.error(detail);
  }
};
```

---

#### Passo 5: Adicionar hook React Query (opcional)

**Arquivo:** `apps/frontend/src/api/hooks/useCalendar.ts`

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useCalendarStatus() {
  return useQuery({
    queryKey: ['calendar-status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/calendar/status');
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useCalendarAuthUrl() {
  return useQuery({
    queryKey: ['calendar-auth-url'],
    queryFn: async () => {
      const { data } = await apiClient.get('/calendar/auth-url');
      return data;
    },
    enabled: false, // Só busca quando chamar refetch()
  });
}

export function useCalendarSync() {
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const { data } = await apiClient.post('/calendar/sync', { task_ids: taskIds });
      return data;
    },
  });
}
```

---

#### Passo 6: Melhorias de UX (opcional)

1. **Indicador de conexão no botão "Sincronizar":**
   - Mostre "Conectado" (verde) ou "Desconectado" (cinza) ao lado do botão
   - Busque `GET /calendar/status` ao montar o componente

2. **Desconectar:**
   - Botão "Desconectar Google Agenda" que chama `DELETE /calendar/disconnect` (endpoint a ser criado)

3. **Feedback visual durante sincronização:**
   - Spinner no botão
   - Barra de progresso se houver muitas tarefas

4. **Agendamento automático:**
   - Sincronizar ao criar/editar tarefa com deadline
   - Ou sincronizar periodicamente (ex: a cada hora)

---

### 2.4 Check-list de implementação

- [ ] Google Calendar API ativada no Google Cloud Console
- [ ] OAuth 2.0 Client ID criado para o calendário
- [ ] `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI` no `.env`
- [ ] Variáveis adicionadas ao `docker-compose.yml`
- [ ] Variáveis adicionadas ao CI (GitHub Secrets + workflow)
- [ ] `GET /calendar/callback` endpoint criado no backend
- [ ] `google-api-python-client` adicionado ao `requirements.txt`
- [ ] `_create_calendar_event()` implementado (substituir TODO)
- [ ] `sync_tasks_to_calendar()` usando criação real de eventos
- [ ] Frontend `CalendarCallbackPage.tsx` criada
- [ ] Rota `/calendar/callback` adicionada no router frontend
- [ ] Botão "Sincronizar" com fluxo OAuth (popup + postMessage)
- [ ] Testes: `pytest tests/test_api_calendar.py` passando (atualizar se necessário)
- [ ] `apps/backend/src/oauth.py` deletado (código órfão)

---

## Parte 3: Google Auth na Agenda (tokens compartilhados?)

### Decisão de arquitetura

O login com Google e a sincronização da Agenda usam **OAuth 2.0** no mesmo escopo, mas com **client IDs diferentes**. Isso é necessário porque:

| Aspecto | Login Google | Google Agenda |
|---------|-------------|---------------|
| **Escopos** | `openid profile email` | `https://www.googleapis.com/auth/calendar.events` |
| **Client ID** | `GOOGLE_CLIENT_ID` | `GOOGLE_CALENDAR_CLIENT_ID` |
| **Redirect URI** | Backend (`/auth/google/callback`) | Frontend (`/calendar/callback`) |
| **Token armazenado** | JWT da aplicação | Refresh token do Google |
| **Tabela DB** | `users.auth_provider` | `user_google_tokens` |

⚠️ **Importante:** Embora seja possível compartilhar o mesmo Client ID e pedir escopos adicionais no login, a prática recomendada pelo Google é usar **Client IDs separados** para flows diferentes, especialmente quando um é server-side (login) e outro é client-side (agenda).

---

## 4. Testando a Sincronização

### Modo Mock (atual — sem chaves configuradas)
```bash
# Com GOOGLE_CALENDAR_CLIENT_ID="" (vazio ou não definido)
# O serviço opera em mock mode:
# - GET /calendar/status → { connected: false, email: null }
# - GET /calendar/auth-url → 501 (not configured)
# - POST /calendar/sync → todos os itens como "mock_synced"
```

### Modo Real (após implementação)
```bash
# Com GOOGLE_CALENDAR_CLIENT_ID preenchido
# 1. GET /calendar/status → { connected: true, email: "user@gmail.com" }
# 2. GET /calendar/auth-url → URL de autorização do Google
# 3. Sincronizar → eventos reais no Google Calendar
```

### Testes automatizados
```bash
cd apps/backend
uv run pytest tests/test_api_calendar.py -v
# Testes atuais: 6 testes (todos em mock mode)
# Após implementação: adicionar testes com mock do Google API client
```

---

## 5. Tratamento de Erros

| Cenário | Como tratar |
|---------|-------------|
| **Token expirado/revogado** | `_ensure_valid_token()` tenta refresh; se falhar, marca como desconectado |
| **Quota excedida** | Google retorna 403; logar erro, informar usuário, retry após 1h |
| **Usuário revoga acesso** | Na próxima sincronização, refresh falha → status = disconnected |
| **Rede indisponível** | Timeout com retry (3 tentativas, backoff exponencial) |
| **Tarefa sem deadline** | Pular (evento precisa de data) |
| **Muitas tarefas** | Batch de 10 por vez com intervalo de 1s (rate limiting) |
