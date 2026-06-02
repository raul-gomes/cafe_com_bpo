# 🧪 Guia para Testar o Scheduler de Rotinas

## Pré-requisitos

- Backend rodando (`uvicorn src.main:create_app --factory --host 0.0.0.0 --port 8000`)
- Frontend rodando (`npm run dev`)
- Migrations aplicadas (`alembic upgrade head`)
- PostgreSQL rodando (ou SQLite em modo test)

---

## 1. Criar um Tipo de Rotina (opcional)

```
POST http://localhost:8000/tasks/routine-types/
Authorization: Bearer <seu_token>
Content-Type: application/json

{
  "name": "Fiscal",
  "color": "#3b82f6",
  "suggestions": ["Entrega de guia", "Fechamento mensal"]
}
```

> 💡 Use o Swagger em `http://localhost:8000/docs` se preferir.

---

## 2. Criar um Template de Atividades

```
POST http://localhost:8000/tasks/activity-templates/
Authorization: Bearer <seu_token>
Content-Type: application/json
```

<details>
<summary><strong>📅 Recorrência DIÁRIA</strong> (gera seg-sex)</summary>

```json
{
  "name": "Conciliação Diária",
  "description": "Conciliação bancária diária",
  "process_type": "contabil",
  "recurrence": "daily",
  "is_active": true
}
```
</details>

<details>
<summary><strong>📅 Recorrência SEMANAL</strong> (dias específicos da semana)</summary>

```json
{
  "name": "Relatório Semanal",
  "description": "Relatório de desempenho",
  "process_type": "relatorio",
  "recurrence": "weekly",
  "weekday_mask": "0,2,4",
  "is_active": true
}
```
> `weekday_mask`: 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado
> `"0,2,4"` = gera domingo, terça e quinta
</details>

<details>
<summary><strong>📅 Recorrência QUINZENAL</strong> (dias 1 e 15)</summary>

```json
{
  "name": "Fechamento Quinzenal",
  "description": "Fechamento de folha quinzenal",
  "process_type": "folha",
  "recurrence": "biweekly",
  "is_active": true
}
```
</details>

<details>
<summary><strong>📅 Recorrência MENSAL</strong> (dia específico do mês)</summary>

```json
{
  "name": "Entrega de Obrigações",
  "description": "Entrega de obrigações mensais",
  "process_type": "fiscal",
  "recurrence": "monthly",
  "is_active": true
}
```
</details>

<details>
<summary><strong>📅 Recorrência ANUAL</strong> (mês + dia específicos)</summary>

```json
{
  "name": "Declaração Anual",
  "description": "Declaração anual de imposto de renda",
  "process_type": "fiscal",
  "recurrence": "yearly",
  "due_month": 1,
  "is_active": true
}
```
> `due_month` = 1 (janeiro) a 12 (dezembro)
</details>

Guarde o `id` retornado (ex: `"template-id-123"`).

---

## 3. Criar Atividades no Template

Cada template precisa de pelo menos uma atividade:

```
POST http://localhost:8000/tasks/activity-templates/<template-id>/activities
Authorization: Bearer <seu_token>
Content-Type: application/json
```

```json
{
  "name": "Gerar relatório do período",
  "description": "Gerar relatório conforme periodicidade",
  "due_day": 5,
  "estimated_hours": 4,
  "order": 1
}
```

> `due_day` é usado pela recorrência **mensal** e **anual** como dia do vencimento.
> Para daily/weekly/biweekly o deadline é calculado automaticamente (hoje + `next_business_day`).

---

## 4. Criar um Cliente

Se não tiver nenhum:

```
POST http://localhost:8000/clients/
Authorization: Bearer <seu_token>
Content-Type: application/json

{
  "name": "Empresa Exemplo Ltda",
  "cnpj": "11.222.333/0001-99",
  "color": "#22c55e"
}
```

Guarde o `id` do cliente.

---

## 5. Vincular Template ao Cliente

```
POST http://localhost:8000/tasks/client-templates/
Authorization: Bearer <seu_token>
Content-Type: application/json

{
  "client_id": "<id-do-cliente>",
  "template_id": "<id-do-template>",
  "start_date": "2026-06-01T00:00:00Z"
}
```

Isso cria um **vínculo ativo** e já gera as tarefas do período atual.

---

## 6. Executar o Scheduler

### Opção A — Pelo Frontend

1. Acesse `http://localhost:3000/painel/tarefas`
2. Clique no botão **"Executar Rotinas"** (ícone `↻`, ao lado de "Sincronizar")
3. O alerta mostra: tarefas geradas, já existentes, vínculos processados

### Opção B — Pela API (apenas seu usuário)

```
POST http://localhost:8000/tasks/scheduler/run
Authorization: Bearer <seu_token>
```

### Opção C — Pela API de Cron (todos os usuários)

Configure `CRON_SECRET` no `.env` do backend, reinicie, depois:

```
POST http://localhost:8000/tasks/scheduler/cron
x-cron-secret: minha-senha
Content-Type: application/json
```

---

## 7. Resposta do Scheduler

```json
{
  "assignments_processed": 1,
  "tasks_generated": 2,
  "tasks_skipped": 0,
  "errors": []
}
```

| Campo | Significado |
|-------|-------------|
| `assignments_processed` | Vínculos processados |
| `tasks_generated` | Tarefas criadas nesta execução |
| `tasks_skipped` | Tarefas já existentes (não duplicadas) |
| `errors` | Erros por vínculo (se houver) |

---

## 8. Testar Cada Recorrência (hoje = 02/06/2026, terça-feira)

| Recorrência | Configuração | Gera hoje? | Motivo |
|-------------|-------------|------------|--------|
| **daily** | — | ✅ Sim | Terça é dia útil |
| **weekly** | `weekday_mask: "1,3"` | ✅ Sim | Terça = weekday 1 |
| **weekly** | `weekday_mask: "0,4"` | ❌ Não | Só domingo e quinta |
| **biweekly** | — | ❌ Não | Só dia 1 e 15 |
| **monthly** | `due_day: 2` (na activity) | ✅ Sim | Hoje é dia 2 |
| **monthly** | `due_day: 5` (na activity) | ❌ Não | Hoje é dia 2 ≠ 5 |
| **yearly** | `due_month: 6`, `due_day: 2` | ✅ Sim | Junho + dia 2 |
| **yearly** | `due_month: 12` | ❌ Não | Mês errado |
| **once** | — | ❌ Não | Só gera no vínculo |

---

## 9. Testar via pytest (15 testes automatizados)

```bash
cd apps/backend

# Rodar todos os testes do scheduler
venv/bin/python -m pytest tests/test_api_tasks.py -k "scheduler" -v
```

### Cobertura dos testes

| # | Teste | Cenário |
|---|-------|---------|
| 1 | `test_scheduler_no_assignments` | Nenhum vínculo ativo |
| 2 | `test_scheduler_daily_generates_on_weekday` | Daily em dia útil |
| 3 | `test_scheduler_does_not_duplicate` | Previne duplicatas |
| 4 | `test_scheduler_weekly_with_weekday_mask` | Weekly com dia na máscara |
| 5 | `test_scheduler_weekly_skips_when_mask_mismatch` | Weekly com dia fora da máscara |
| 6 | `test_scheduler_biweekly_on_1_or_15` | Quinzenal (match ou skip dinâmico) |
| 7 | `test_scheduler_monthly_skips_existing_task` | Mensal — não duplica |
| 8 | `test_scheduler_yearly_skips_existing_task` | Anual — não duplica |
| 9 | `test_scheduler_yearly_skips_wrong_month` | Anual — mês errado |
| 10 | `test_scheduler_isolation` | Isolamento entre usuários |
| 11 | `test_scheduler_template_not_active_skipped` | Template inativo |
| 12 | `test_scheduler_response_structure` | Estrutura da resposta |
| 13 | `test_scheduler_cron_requires_secret` | Cron sem CRON_SECRET |
| 14 | `test_scheduler_cron_wrong_secret` | Cron com secret errado |
| 15 | `test_scheduler_cron_success` | Cron com secret correto |

---

## 10. Testar via Frontend (rotina completa)

```bash
# 1. Backend (terminal 1)
cd apps/backend
uvicorn src.main:create_app --factory --reload --host 0.0.0.0 --port 8000

# 2. Frontend (terminal 2)
cd apps/frontend
npm run dev

# 3. Acessar
open http://localhost:3000

# 4. Criar template em:
http://localhost:3000/painel/templates-atividades

# 5. Executar rotinas em:
http://localhost:3000/painel/tarefas
```

---

## 11. Cron Job Local (simular produção)

```bash
# Instalar cron (se não tiver)
sudo apt install cron

# Adicionar job (executar a cada minuto para teste)
crontab -e

# Linha:
* * * * * curl -s -X POST http://localhost:8000/tasks/scheduler/cron \
  -H "x-cron-secret: minha-senha" \
  -H "Content-Type: application/json" \
  -o /dev/null

# Ver logs
grep CRON /var/log/syslog
```
