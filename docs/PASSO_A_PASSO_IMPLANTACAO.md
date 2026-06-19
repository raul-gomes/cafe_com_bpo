# Passo a Passo para Implantação

Este guia cobre tudo que você precisa para rodar o Café com BPO do jeito que está — desde as chaves necessárias até a configuração do ambiente.

---

## 1. Pré-requisitos

### 1.1 Ferramentas
- **Docker** + **Docker Compose** (versão plugin `docker compose`)
- **Git**
- Acesso a terminal Linux/Mac (ou WSL2 no Windows)

### 1.2 Contas necessárias
| Serviço | Para quê | Criação |
|---------|----------|---------|
| **Google Cloud Console** | Login com Google (OAuth) + Google Agenda | https://console.cloud.google.com |
| **Cloudinary** | Upload de avatares e logos de empresas | https://cloudinary.com |
| **SMTP** (Gmail, SendGrid, etc.) | Envio de email de recuperação de senha | (sua escolha) |

---

## 2. Chaves e Credenciais

### 2.1 Google OAuth (Login Social)

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um **projeto** (ou selecione existente)
3. Vá em **APIs & Services → Credentials**
4. Clique **Create Credentials → OAuth 2.0 Client ID**
5. Escolha **Web application**
6. **Authorized redirect URIs:** adicione:
   - `http://localhost:8000/auth/google/callback` (dev)
   - `https://seudominio.com/api/auth/google/callback` (produção)
7. Anote:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### 2.2 Google Calendar API (Sincronização de Agenda)

> ⚠️ **Importante:** A sincronização real com Google Agenda ainda **não está implementada** — o código atual funciona apenas em **mock mode** (retorna sucesso sem criar eventos reais). Para usar o mock, deixe as variáveis `GOOGLE_CALENDAR_*` vazias. Para implementar a sincronização real, veja o guia separado (`PASSO_A_PASSO_GOOGLE_AUTH_AGENDA.md`).

1. No mesmo projeto do Google Cloud, vá em **APIs & Services → Library**
2. Ative a **Google Calendar API**
3. Em **Credentials**, crie um **OAuth 2.0 Client ID** separado para o calendário
4. **Authorized redirect URIs:**
   - `http://localhost:3000/calendar/callback` (dev)
   - `https://seudominio.com/calendar/callback` (produção)

### 2.3 Cloudinary (Avatares/Logos)

1. Acesse https://cloudinary.com e crie/cadastre-se
2. Vá no **Dashboard** e anote:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. ⚠️ **Rotacione as chaves** se elas estiveram no Git (como estavam antes da auditoria)

### 2.4 SMTP (Email de recuperação de senha)

Opções:
- **Gmail:** Crie uma senha de app em https://myaccount.google.com/apppasswords
- **SendGrid:** Crie uma API Key em https://sendgrid.com
- **Mailtrap** (dev): https://mailtrap.io

---

## 3. Configuração do Ambiente

### 3.1 Clone e prepare
```bash
git clone <seu-repo> cafe_com_bpo
cd cafe_com_bpo
```

### 3.2 Variáveis de ambiente

Crie o arquivo `.env` na raiz do projeto (nunca commitado):

```bash
cp .env.example .env   # se existir, ou crie manualmente
```

Conteúdo mínimo do `.env`:

```ini
# ─── Django / FastAPI ───
MODE=development

# ─── Banco de Dados ───
POSTGRES_USER=cafe_com_bpo
POSTGRES_PASSWORD=SUA_SENHA_AQUI
POSTGRES_DB=cafe_com_bpo
DATABASE_URL=postgresql+psycopg://cafe_com_bpo:SUA_SENHA_AQUI@db:5432/cafe_com_bpo

# ─── JWT ───
JWT_SECRET=uma-chave-aleatoria-de-pelo-menos-32-caracteres-aqui
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ─── CORS ───
CORS_ORIGINS=http://localhost:3000,http://localhost:80

# ─── Google OAuth Login ───
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_AUTH_URL=https://accounts.google.com/o/oauth2/v2/auth
GOOGLE_TOKEN_URL=https://oauth2.googleapis.com/token
GOOGLE_USERINFO_URL=https://www.googleapis.com/oauth2/v3/userinfo
OAUTH_REDIRECT_URI=http://localhost:8000/auth/google/callback

# ─── Google Calendar (deixe vazio para mock) ───
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=

# ─── Cloudinary (opcional, para uploads) ───
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ─── SMTP (para recuperação de senha) ───
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-de-app
SMTP_FROM_EMAIL=seu-email@gmail.com
SMTP_USE_TLS=True

# ─── Frontend URL (usada no email de reset) ───
FRONTEND_URL=http://localhost:3000

# ─── Upload ───
FILE_UPLOAD_MAX_SIZE=5242880
```

### 3.3 Para desenvolvimento local (sem Docker)
Se quiser rodar backend fora do Docker, crie também `apps/backend/.env`:
```bash
cp .env apps/backend/.env
# Ajuste DATABASE_URL para apontar para localhost:
# DATABASE_URL=postgresql+psycopg://cafe_com_bpo:SUA_SENHA_AQUI@localhost:5432/cafe_com_bpo
```

Frontend: o arquivo `apps/frontend/.env` com `VITE_API_URL=/api` já está configurado.

---

## 4. Subindo o Ambiente

### 4.1 Com Docker (recomendado)
```bash
# Sobe todos os serviços
docker compose up -d

# Acompanhar logs
docker compose logs -f

# Serviços:
#   - Nginx:     http://localhost:80
#   - Frontend:  http://localhost:3000
#   - Backend:   http://localhost:8000
#   - pgAdmin:   http://localhost:5050
#   - Ollama:    http://localhost:11434
```

### 4.2 Sem Docker (desenvolvimento)
```bash
# Terminal 1 - Backend
cd apps/backend
uv run uvicorn src.main:create_app --factory --host 0.0.0.0 --port 8000 --reload

# Terminal 2 - Frontend
cd apps/frontend
npm run dev
```

---

## 5. Comandos Úteis

### Backend
```bash
cd apps/backend

# Testes
uv run pytest tests/ -v

# Lint
uv run ruff check .

# Format
uv run ruff format .

# Migrations (se você alterar models)
uv run alembic revision --autogenerate -m "descricao"
uv run alembic upgrade head
```

### Frontend
```bash
cd apps/frontend

# Typecheck
npm run typecheck

# Lint
npm run lint

# Testes
npm run test

# Build produção
npm run build
```

---

## 6. Verificação pós-implantação

### 6.1 Testar fluxos manualmente

| Fluxo | Como testar |
|-------|-------------|
| **Registro** | Acessar `/cadastro`, criar conta |
| **Login** | Acessar `/login`, entrar com email/senha |
| **Google Login** | Clicar "Google" no login, autorizar |
| **Recuperar senha** | Clicar "Esqueci minha senha", digitar email |
| **Criar tarefa** | Ir em `/painel/tarefas`, criar tarefa |
| **Upload de anexo** | Ao editar tarefa, anexar arquivo |
| **Sincronizar Agenda** | Clicar "Sincronizar" no Kanban (roda em mock) |

### 6.2 Verificar testes
```bash
# Backend
cd apps/backend
uv run pytest tests/ -v

# Frontend
cd apps/frontend
npm run typecheck && npm run lint && npm run test
```

### 6.3 Verificar build
```bash
cd apps/frontend
npm run build
# O diretório dist/ será gerado
```

---

## 7. Produção

### 7.1 Ajustes obrigatórios

1. **HTTPS** — Configure certificados TLS no Nginx e mude `secure=True` nos cookies:
   ```python
   # apps/backend/src/modules/auth/router.py
   # Procure por "Set to True in production" e mude:
   secure=True,
   ```

2. **CORS** — Ajuste `CORS_ORIGINS` no `.env` para seu domínio:
   ```
   CORS_ORIGINS=https://seudominio.com,https://www.seudominio.com
   ```

3. **OAUTH_REDIRECT_URI** — Aponte para seu domínio:
   ```
   OAUTH_REDIRECT_URI=https://seudominio.com/api/auth/google/callback
   ```

4. **FRONTEND_URL** — Aponte para seu domínio:
   ```
   FRONTEND_URL=https://seudominio.com
   ```

5. **JWT_SECRET** — Use uma chave forte e diferente da de desenvolvimento.

### 7.2 CI/CD
O pipeline está em `.github/workflows/main.yml`:
- Push para `main` → CI roda lint + testes → build Docker → push para GHCR → webhook Hostinger

Certifique-se de que os **secrets do GitHub Actions** estão configurados:
```
DOCKER_USERNAME, DOCKER_PASSWORD  (para GHCR)
JWT_SECRET, DATABASE_URL, GOOGLE_CLIENT_ID, etc.
```

---

## 8. Solução de Problemas

### "Tabela não encontrada" (backend)
```bash
docker compose exec backend alembic upgrade head
```

### "Porta já em uso"
```bash
# Mude no .env ou docker-compose.yml as portas
# Frontend: VITE_API_URL + nginx.conf
# Backend: porta 8000
```

### "Erro de conexão com banco"
- Verifique se o PostgreSQL está rodando: `docker compose ps`
- Verifique a `DATABASE_URL` no `.env`

### "Login com Google não funciona"
- Verifique se `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão corretos
- Verifique se a redirect URI está cadastrada no Google Cloud Console
- Verifique se o backend está acessível na URI de redirect

### "Email de recuperação não chega"
- Em dev, verifique os logs do backend (emails são logados, não enviados)
- Em produção, verifique credenciais SMTP
- Verifique se o provedor SMTP não está bloqueando envios
