# Deploy na Hostinger VPS — Café com BPO

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Setup Inicial do VPS](#3-setup-inicial-do-vps)
4. [Docker e Docker Compose](#4-docker-e-docker-compose)
5. [Variáveis de Ambiente](#5-variáveis-de-ambiente)
6. [Deploy Manual com Docker Compose](#6-deploy-manual-com-docker-compose)
7. [Nginx + SSL (Let's Encrypt)](#7-nginx--ssl-lets-encrypt)
8. [CI/CD com GitHub Actions](#8-cicd-com-github-actions)
9. [Cron Job do Scheduler](#9-cron-job-do-scheduler)
10. [Monitoramento](#10-monitoramento)
11. [Backup e Restore](#11-backup-e-restore)
12. [Atualizações e Manutenção](#12-atualizações-e-manutenção)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Visão Geral da Arquitetura

```
Internet
    │
    ▼
  🌐 Hostinger VPS (Ubuntu 22.04+)
    │
    ├── Nginx Gateway (porta 443 — HTTPS)
    │   ├── /api/* → backend (porta 8000)
    │   ├── /pgadmin/* → pgAdmin (porta 80)
    │   ├── /ollama/* → Ollama (porta 11434, opcional)
    │   └── /* → frontend (porta 80)
    │
    ├── API (FastAPI + Uvicorn)
    ├── Frontend (Nginx servindo React build)
    ├── PostgreSQL 16
    ├── pgAdmin (opcional, gerenciamento DB)
    ├── Ollama (opcional, modelos locais de IA)
    │
    └── Cron job (curl → /api/tasks/scheduler/cron)
```

**Serviços no Docker Compose:**

| Serviço    | Porta interna | Função                          |
|------------|---------------|----------------------------------|
| `gateway`  | 80            | Nginx reverso (exposto ao host) |
| `api`      | 8000          | FastAPI (não exposto)            |
| `web`      | 80            | Frontend React (não exposto)     |
| `db`       | 5432          | PostgreSQL 16 (não exposto)      |
| `pgadmin`  | 80            | Admin DB (via /pgadmin)          |
| `ollama`   | 11434         | IA local (via /ollama)           |

---

## 2. Pré-requisitos

- **Plano Hostinger VPS** (mínimo: 2 vCPU, 4 GB RAM, 50 GB SSD)
- **Domínio** apontado para o IP do VPS (ex: `app.cafecombpo.com.br`)
- **Acesso SSH** ao VPS
- **Conta GitHub** com o repositório do projeto
- **Conta GHCR** (GitHub Container Registry) — já inclusa no GitHub

> ⚠️ **Não use planos de hospedagem compartilhada** — eles não suportam Docker.
> O plano mínimo recomendado é **VPS KVM 2** ou superior.

---

## 3. Setup Inicial do VPS

### 3.1 Acessar o VPS

```bash
ssh root@SEU_IP
```

### 3.2 Atualizar o sistema

```bash
apt update && apt upgrade -y
```

### 3.3 Criar usuário não-root

```bash
adduser deploy
usermod -aG sudo deploy
```

A partir daqui, prefira usar o usuário `deploy`:

```bash
su - deploy
```

### 3.4 Configurar firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

### 3.5 Configurar timezone

```bash
sudo timedatectl set-timezone America/Sao_Paulo
```

---

## 4. Docker e Docker Compose

### 4.1 Instalar Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker deploy
```

Faça logout e login novamente para aplicar o grupo:

```bash
exit
ssh deploy@SEU_IP
```

### 4.2 Verificar instalação

```bash
docker --version
docker compose version
```

---

## 5. Variáveis de Ambiente

### 5.1 Criar diretório do projeto

```bash
mkdir -p /home/deploy/cafe-com-bpo
cd /home/deploy/cafe-com-bpo
```

### 5.2 Criar arquivo `.env`

```bash
nano .env
```

Conteúdo mínimo para produção:

```env
# ─── Database ──────────────────────────────────
POSTGRES_USER=cafe_bpo
POSTGRES_PASSWORD=<GERAR_SENHA_FORTE>
POSTGRES_DB=cafe_bpo
DATABASE_URL=postgresql+psycopg://cafe_bpo:<SENHA>@db:5432/cafe_bpo

# ─── Backend Security ──────────────────────────
JWT_SECRET=<GERAR_CHAVE_256BITS>
JWT_ALGORITHM=HS256
MODE=production

# ─── Infrastructure ────────────────────────────
PGADMIN_DEFAULT_EMAIL=admin@seudominio.com
PGADMIN_DEFAULT_PASSWORD=<SENHA_PGADMIN>

# ─── Google OAuth ──────────────────────────────
GOOGLE_CLIENT_ID=seu-google-client-id
GOOGLE_CLIENT_SECRET=seu-google-client-secret
GOOGLE_AUTH_URL=https://accounts.google.com/o/oauth2/v2/auth
GOOGLE_TOKEN_URL=https://oauth2.googleapis.com/token
GOOGLE_USERINFO_URL=https://www.googleapis.com/oauth2/v3/userinfo

# ─── Microsoft OAuth ───────────────────────────
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_AUTH_URL=https://login.microsoftonline.com/common/oauth2/v2.0/authorize
MICROSOFT_TOKEN_URL=https://login.microsoftonline.com/common/oauth2/v2.0/token
MICROSOFT_USERINFO_URL=https://graph.microsoft.com/v1.0/me

# ─── OAuth Redirect ────────────────────────────
OAUTH_REDIRECT_URI=https://app.seudominio.com/api/auth
CORS_ORIGINS=https://app.seudominio.com

# ─── Cloudinary (uploads) ──────────────────────
CLOUDINARY_CLOUD_NAME=seu-cloud
CLOUDINARY_API_KEY=sua-key
CLOUDINARY_API_SECRET=seu-secret
FILE_UPLOAD_MAX_SIZE=5242880

# ─── SMTP (emails) ─────────────────────────────
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=contato@seudominio.com
SMTP_PASSWORD=<SENHA_SMTP>
SMTP_FROM_EMAIL=contato@seudominio.com
SMTP_USE_TLS=true

# ─── Frontend ──────────────────────────────────
FRONTEND_URL=https://app.seudominio.com

# ─── Google Calendar (opcional) ────────────────
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=https://app.seudominio.com/calendar/callback

# ─── Cron / Scheduler ─────────────────────────
CRON_SECRET=<GERAR_SENHA_FORTE_PARA_CRON>
```

> 🔐 **Gerar senhas seguras:**
> ```bash
> # JWT_SECRET (256 bits / 64 hex chars)
> openssl rand -hex 32
>
> # CRON_SECRET
> openssl rand -base64 32
>
> # PostgreSQL / pgAdmin
> openssl rand -base64 16
> ```

---

## 6. Deploy Manual com Docker Compose

### 6.1 Clonar o repositório

```bash
cd /home/deploy/cafe-com-bpo
git clone https://github.com/SEU_USUARIO/cafe_com_bpo.git .
```

### 6.2 Ajustar docker-compose para produção

Crie um arquivo `docker-compose.prod.yml` para sobrescrever configurações:

```yaml
# docker-compose.prod.yml
services:
  api:
    environment:
      - MODE=production
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  web:
    restart: unless-stopped

  db:
    restart: unless-stopped
    # Backup: mapear volume para diretório no host
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - /home/deploy/backups:/backups

  pgadmin:
    restart: unless-stopped
    # Opcional: limitar acesso via Nginx

  ollama:
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 8G
    # Opcional: desabilitar se não usar IA
    # profiles: ["ai"]

  gateway:
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"  # HTTPS
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./infra/nginx.prod.conf:/etc/nginx/nginx.conf:ro
```

### 6.3 Nginx para produção com HTTPS

Crie `infra/nginx.prod.conf` (baseado no existente, com SSL):

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    # Redirecionar HTTP → HTTPS
    server {
        listen 80;
        server_name app.seudominio.com;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name app.seudominio.com;

        ssl_certificate     /etc/letsencrypt/live/app.seudominio.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/app.seudominio.com/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";

        # Upstreams
        upstream backend_api { server api:8000; }
        upstream frontend_web { server web:80; }
        upstream pgadmin_srv { server pgadmin:80; }
        upstream ollama_srv  { server ollama:11434; }

        # Frontend
        location / {
            proxy_pass http://frontend_web;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend_api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # CORS Preflight
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' '*';
                add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH';
                add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
                add_header 'Access-Control-Max-Age' 1728000;
                add_header 'Content-Type' 'text/plain; charset=utf-8';
                add_header 'Content-Length' 0;
                return 204;
            }
        }

        # pgAdmin (restringir por IP ou senha)
        location /pgadmin/ {
            proxy_pass http://pgadmin_srv/;
            proxy_set_header X-Script-Name /pgadmin;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_redirect off;
        }

        # Ollama
        location /ollama/ {
            proxy_pass http://ollama_srv/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 120s;
            proxy_send_timeout 120s;
        }
    }
}
```

### 6.4 Subir os serviços

```bash
cd /home/deploy/cafe-com-bpo

# Pull das imagens mais recentes do GHCR
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Subir todos os serviços
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verificar status
docker compose ps

# Ver logs
docker compose logs -f api
```

### 6.5 Health check

Testar se a API está rodando:

```bash
curl http://localhost:8000/health
```

Resposta esperada:

```json
{
  "status": "healthy",
  "version": "1.1.0",
  "mode": "production",
  "database": "connected",
  "cron_configured": true,
  "timestamp": "2026-06-02T12:00:00Z"
}
```

---

## 7. Nginx + SSL (Let's Encrypt)

### 7.1 Obter certificado SSL

```bash
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado (antes de subir o compose, com Nginx do host)
sudo certbot --nginx -d app.seudominio.com

# Ou modo standalone (se o Nginx do container estiver na porta 80)
sudo certbot certonly --standalone -d app.seudominio.com
```

### 7.2 Renovação automática

O certbot já cria um timer systemd. Testar:

```bash
sudo certbot renew --dry-run
```

### 7.3 Montar certificados no container Nginx

No `docker-compose.prod.yml`, o volume já está configurado:

```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

O Nginx do gateway lê os certificados de `/etc/letsencrypt/live/`.

---

## 8. CI/CD com GitHub Actions

O pipeline já está configurado em `.github/workflows/main.yml`:

```
Push na branch main
    │
    ▼
┌──────────────────────┐
│  Backend CI          │
│  • ruff check        │
│  • ruff format       │
│  • pytest            │
└──────────┬───────────┘
           │
┌──────────────────────┐
│  Frontend CI         │
│  • lint              │
│  • typecheck         │
│  • test              │
└──────────┬───────────┘
           │
           ▼ (se ambos passarem)
┌──────────────────────┐
│  CI Gate             │
└──────────┬───────────┘
           │
           ▼ (se for push na main)
┌──────────────────────┐
│  Build & Push GHCR   │
│  • api:latest        │
│  • web:latest        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Deploy Webhook      │
│  → Hostinger         │
└──────────────────────┘
```

### 8.1 Configurar secrets no GitHub

Em **Settings → Secrets and variables → Actions**, adicione:

| Secret | Valor |
|--------|-------|
| `HOSTINGER_DEPLOY_WEBHOOK` | URL do webhook de deploy |

### 8.2 Script de deploy no VPS (webhook)

Crie um script que o webhook chama:

```bash
# /home/deploy/deploy.sh
#!/bin/bash
cd /home/deploy/cafe-com-bpo

# Pull das novas imagens
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Recrear containers com as novas imagens
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate

# Limpar imagens antigas
docker image prune -f

echo "✅ Deploy concluído em $(date)"
```

```bash
chmod +x /home/deploy/deploy.sh
```

Para expor como webhook, você pode usar um serviço simples como **webhook** (https://github.com/adnanh/webhook) ou um endpoint mínimo no próprio backend:

```bash
# Opção 1: Instalar webhook
sudo apt install -y webhook

# Criar config
sudo tee /etc/webhook.conf << 'EOF'
[
  {
    "id": "redeploy",
    "execute-command": "/home/deploy/deploy.sh",
    "command-working-directory": "/home/deploy/cafe-com-bpo",
    "response-message": "Deploy triggered",
    "trigger-rule": {
      "match": {
        "type": "value",
        "value": "SEU_TOKEN_SECRETO",
        "parameter": {
          "source": "header",
          "name": "X-Deploy-Token"
        }
      }
    }
  }
]
EOF

# Iniciar webhook como serviço
sudo webhook -hooks /etc/webhook.conf -port 9000 -verbose
```

> 💡 **Alternativa mais simples:** Use um serviço como [DeployHQ](https://deployhq.com/) ou [Coolify](https://coolify.io/) para gerenciar o deploy sem webhook manual.

---

## 9. Cron Job do Scheduler

A aplicação possui **dois endpoints** de cron, cada um com uma finalidade específica:

| Endpoint | Frequência | O que faz |
|----------|-----------|-----------|
| `POST /api/tasks/scheduler/cron` | Diariamente (dias úteis) | Gera tasks **diárias** para o dia atual |
| `POST /api/tasks/scheduler/pre-generate` | Último dia útil do mês | Pré-gera tasks **semanais, mensais e anuais** para o mês seguinte |

Ambos são protegidos pelo header `X-Cron-Secret` que deve bater com `CRON_SECRET` do `.env`.

### 9.1 Endpoints de cron

#### 9.1.1 Cron diário — `/api/tasks/scheduler/cron`

Gera tasks com recorrência **diária** para o dia atual. Processa todos os assignments ativos e cria as tasks pendentes que vencem hoje.

**Exemplo de chamada manual:**
```bash
curl -X POST https://app.seudominio.com/api/tasks/scheduler/cron \
  -H "X-Cron-Secret: SUA_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Resposta:**
```json
{
  "assignments_processed": 12,
  "tasks_generated": 45,
  "tasks_skipped": 3,
  "errors": []
}
```

#### 9.1.2 Pré-geração mensal — `/api/tasks/scheduler/pre-generate`

**Deve ser chamado no último dia útil de cada mês.** Gera todas as tasks com recorrência **semanal, mensal e anual** para o mês seguinte.

- **Semanal**: cria tasks para **todos os dias da semana marcados** no mês seguinte
- **Mensal**: cria uma task no `due_day` do mês seguinte
- **Anual**: cria uma task se o mês seguinte corresponder ao `due_month`

**Exemplo de chamada manual:**
```bash
curl -X POST https://app.seudominio.com/api/tasks/scheduler/pre-generate \
  -H "X-Cron-Secret: SUA_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Resposta:**
```json
{
  "month": 7,
  "year": 2026,
  "assignments_processed": 12,
  "tasks_generated": 180,
  "tasks_skipped": 5,
  "errors": []
}
```

### 9.2 Configurar crons no VPS

Edite o crontab do usuário `deploy`:

```bash
crontab -e
```

Adicione as linhas abaixo (ajuste o horário conforme necessário):

```cron
# ─── Café com BPO ──────────────────────────────────────────────

# 1. Scheduler diário — dias úteis às 6h (horário de Brasília = UTC-3)
#    Gera tasks diárias para o dia atual
0 9 * * 1-5 curl -X POST https://app.seudominio.com/api/tasks/scheduler/cron -H "X-Cron-Secret: SUA_CRON_SECRET" -H "Content-Type: application/json" -s -o /dev/null

# 2. Pré-geração mensal — último dia útil do mês às 5h
#    Gera tasks semanais, mensais e anuais para o mês seguinte
#
# ⚠️ Como o cron padrão não suporta "último dia útil", usamos um
#    script shell que verifica se hoje é o último dia útil do mês.
0 8 28-31 * * /home/deploy/cafe-com-bpo/scripts/cron-pre-generate.sh
```

> **Explicação dos horários:** O cron roda em UTC (padrão do VPS). Para 6h BRT (UTC-3), configuramos 9h UTC. Ajuste `SUA_CRON_SECRET` pelo valor definido no `.env`.

### 9.3 Script de verificação do último dia útil

Crie o arquivo `/home/deploy/cafe-com-bpo/scripts/cron-pre-generate.sh`:

```bash
#!/bin/bash
# Script para executar a pré-geração mensal apenas no último dia útil do mês
# Usado com: 0 8 28-31 * * /caminho/para/este/script.sh

# Verificar se hoje é o último dia útil do mês
TODAY=$(date +%d)
TOMORROW=$(date +%d -d "+1 day")

# Se amanhã for dia 1, hoje é o último dia do mês
if [ "$TOMORROW" != "01" ]; then
    exit 0
fi

# Verificar se hoje é dia útil (seg-sex)
DOW=$(date +%u)  # 1=seg, 7=dom
if [ "$DOW" -ge 6 ]; then
    exit 0
fi

# Se for sexta e o último dia cair no sábado/domingo,
# precisamos verificar se hoje é sexta E amanhã (sábado) + dias até segunda > 1
# Exemplo: mês termina no sábado → última sexta é o último dia útil
if [ "$DOW" -eq 5 ]; then
    # Hoje é sexta. Verificar se segunda é dia 3+ (significa que sábado era dia 1)
    MONDAY=$(date +%d -d "+3 day")
    if [ "$MONDAY" -le 2 ]; then  # segunda é dia 1 ou 2 → sábado era último dia
        # Último dia do mês é sábado/domingo, então sexta já é o último dia útil
        :  # continua execução
    fi
fi

# Se chegou aqui, hoje é o último dia útil do mês
curl -X POST https://app.seudominio.com/api/tasks/scheduler/pre-generate \
  -H "X-Cron-Secret: SUA_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -s -o /dev/null

echo "[$(date)] Pré-geração do mês seguinte concluída."
```

```bash
chmod +x /home/deploy/cafe-com-bpo/scripts/cron-pre-generate.sh
```

### 9.4 Alternativa: agendar via crontab.guru

Se preferir uma solução mais simples, você pode agendar o pre-generate para **todo dia 1º de cada mês** (assumindo que o banco tem tarefas do mês anterior já concluídas):

```cron
# Executar no dia 1 de cada mês às 5h
0 8 1 * * curl -X POST https://app.seudominio.com/api/tasks/scheduler/pre-generate -H "X-Cron-Secret: SUA_CRON_SECRET" -H "Content-Type: application/json" -s -o /dev/null
```

> ⚠️ Essa alternativa cria as tasks para o mês corrente no primeiro dia. Não é ideal porque tasks do mês anterior ainda podem estar pendentes, mas funciona como fallback.

### 9.5 Verificar crons

```bash
crontab -l
```

### 9.6 Logs dos crons

O cron envia saída por email local. Para ver:

```bash
grep CRON /var/log/syslog
```

Para logs mais detalhados, redirecione a saída do script para um arquivo:

```cron
0 8 28-31 * * /home/deploy/cafe-com-bpo/scripts/cron-pre-generate.sh >> /home/deploy/cafe-com-bpo/logs/cron-pre-generate.log 2>&1
```

Crie o diretório de logs:

```bash
mkdir -p /home/deploy/cafe-com-bpo/logs
```

### 9.7 Testar endpoints manualmente

Antes de confiar no cron, teste cada endpoint manualmente:

```bash
# Testar cron diário
curl -X POST https://app.seudominio.com/api/tasks/scheduler/cron \
  -H "X-Cron-Secret: SUA_CRON_SECRET" \
  -H "Content-Type: application/json" | jq .

# Testar pré-geração
curl -X POST https://app.seudominio.com/api/tasks/scheduler/pre-generate \
  -H "X-Cron-Secret: SUA_CRON_SECRET" \
  -H "Content-Type: application/json" | jq .
```

> 💡 Instale o `jq` para formatar a saída JSON: `sudo apt install -y jq`

---

## 10. Monitoramento

### 10.1 Health check endpoint

`GET /api/health` retorna:

```json
{
  "status": "healthy",
  "version": "1.1.0",
  "mode": "production",
  "database": "connected",
  "cron_configured": true,
  "timestamp": "2026-06-02T12:00:00Z"
}
```

- **200** → saudável
- **503** → banco offline

### 10.2 Uptime monitoring

Use um serviço gratuito como:

- [UptimeRobot](https://uptimerobot.com/) — monitora `https://app.seudominio.com/api/health` a cada 5 min
- [Better Uptime](https://betteruptime.com/)
- [StatusCake](https://www.statuscake.com/)

### 10.3 Logs dos containers

```bash
# Ver logs em tempo real
docker compose logs -f api
docker compose logs -f web

# Últimos 100 logs
docker compose logs --tail=100 api

# Logs com timestamp
docker compose logs -t api
```

### 10.4 pgAdmin

Acessível em `https://app.seudominio.com/pgadmin/` com as credenciais do `.env`.

> ⚠️ Recomendado proteger com **autenticação HTTP básica** ou restringir por IP no Nginx.

---

## 11. Backup e Restore

### 11.1 Backup do PostgreSQL

```bash
#!/bin/bash
# /home/deploy/backup-db.sh

BACKUP_DIR="/home/deploy/backups"
DB_NAME="cafe_bpo"
DB_USER="cafe_bpo"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Executar dump dentro do container
docker exec $(docker compose ps -q db) pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/$DB_NAME-$DATE.sql"

# Comprimir
gzip "$BACKUP_DIR/$DB_NAME-$DATE.sql"

# Remover backups antigos
find $BACKUP_DIR -name "$DB_NAME-*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup: $DB_NAME-$DATE.sql.gz"
```

```bash
chmod +x /home/deploy/backup-db.sh
```

### 11.2 Cron de backup

```cron
# Backup diário às 3h
0 3 * * * /home/deploy/backup-db.sh
```

### 11.3 Restore

```bash
# Descomprimir
gunzip cafe_bpo-20260602_030000.sql.gz

# Restaurar
docker exec -i $(docker compose ps -q db) psql -U cafe_bpo cafe_bpo < cafe_bpo-20260602_030000.sql
```

---

## 12. Atualizações e Manutenção

### 12.1 Deploy manual (sem CI/CD)

```bash
cd /home/deploy/cafe-com-bpo

# Pull do código mais recente
git pull origin main

# Rebuildar e reiniciar
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Rodar migrations (se houver novas)
docker compose exec api alembic upgrade head
```

### 12.2 Deploy via CI/CD

O pipeline do GitHub Actions faz tudo automaticamente:

1. CI roda lint + testes
2. Build das imagens Docker e push para GHCR
3. Webhook dispara no VPS
4. Script `deploy.sh` faz pull das novas imagens e reinicia

### 12.3 Migrations do banco

As migrations rodam automaticamente no startup via `entrypoint.sh` (`alembic upgrade head`).

Para criar nova migration:

```bash
# Local (dev)
cd apps/backend
alembic revision --autogenerate -m "descricao"
alembic upgrade head

# Commit e push (a migration roda sozinha no deploy)
```

---

## 13. Troubleshooting

### 13.1 Container não sobe

```bash
# Ver logs
docker compose logs api

# Verificar se o banco está saudável
docker compose logs db

# Testar conexão manual
docker compose exec db pg_isready -U cafe_bpo
```

### 13.2 Erro de permissão nos volumes

```bash
# Ajustar dono dos diretórios
sudo chown -R 1001:1001 /home/deploy/cafe-com-bpo/storage
sudo chown -R 1001:1001 /home/deploy/cafe-com-bpo/logs
```

### 13.3 SSL expirou

```bash
sudo certbot renew
docker compose restart gateway
```

### 13.4 Banco de dados corrompido

```bash
# Último backup conhecido
ls -lt /home/deploy/backups/ | head -5

# Restaurar (veja seção 11.3)
```

### 13.5 Scheduler não gerou tarefas

```bash
# Verificar se o cron está ativo
crontab -l

# Verificar se CRON_SECRET está no .env
grep CRON_SECRET /home/deploy/cafe-com-bpo/.env

# Verificar health check
curl https://app.seudominio.com/api/health

# Testar cron diário manualmente
curl -X POST https://app.seudominio.com/api/tasks/scheduler/cron \
  -H "X-Cron-Secret: SUA_CRON_SECRET" \
  -H "Content-Type: application/json" | jq .

# Testar pré-geração mensal manualmente
curl -X POST https://app.seudominio.com/api/tasks/scheduler/pre-generate \
  -H "X-Cron-Secret: SUA_CRON_SECRET" \
  -H "Content-Type: application/json" | jq .
```

**Tasks diárias não aparecem?**
- Verifique se o template tem `recurrence: "daily"` 
- O scheduler diário só gera em dias úteis (seg-sex)

**Tasks semanais/mensais/anuais não aparecem?**
- Verifique se a pré-geração mensal foi executada (cheque os logs em `/home/deploy/cafe-com-bpo/logs/cron-pre-generate.log`)
- A pré-geração só cria tasks para o **mês seguinte** — se o script rodar hoje, as tasks aparecerão com deadline no mês que vem
- Templates com `recurrence: "once"` nunca são gerados pelo scheduler (são criados manualmente)

### 13.6 Erro 502 Bad Gateway

```bash
# Nginx não consegue alcançar o serviço. Verificar se os containers estão rodando:
docker compose ps

# Verificar rede interna
docker compose exec gateway wget -qO- http://api:8000/health
```

---

## Checklist de Deploy

- [ ] VPS contratado e acessível via SSH
- [ ] Firewall configurado (22, 80, 443)
- [ ] Docker e Docker Compose instalados
- [ ] Domínio apontado para o IP do VPS
- [ ] `.env` criado com todas as variáveis
- [ ] Certificado SSL (Let's Encrypt)
- [ ] `docker-compose.prod.yml` criado
- [ ] `infra/nginx.prod.conf` criado
- [ ] Serviços rodando (`docker compose up -d`)
- [ ] Health check respondendo 200
- [ ] Cron job do scheduler configurado
- [ ] Backup automático configurado
- [ ] CI/CD configurado no GitHub
- [ ] Webhook de deploy funcionando
- [ ] Teste de fluxo completo (login → tarefas → scheduler)
