# Scheduler de Rotinas — Design (Itens 17-21)

## Resumo

Implementar o scheduler que gera tarefas automaticamente para rotinas com recorrência
diária, semanal, quinzenal, mensal e anual. Atualmente as tarefas só são geradas **uma vez**
no momento do vínculo do template ao cliente.

## Arquitetura

```
POST /tasks/scheduler/run  →  SchedulerService.run()
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
               Diário     Semanal     Quinzenal
               Mensal     Anual
                    │
                    ▼
          TaskRepository.create()
```

O scheduler varre todos os assignments ativos, verifica se deve gerar tarefas para o
período atual baseado na recorrência, e cria apenas se não houver tarefa pendente
duplicada.

## Mudanças no Banco

### `activity_templates` — novos campos

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `weekday_mask` | `String(20)` | `nullable=True` | Dias da semana p/ semanal (ex: "0,2,4" = seg, qua, sex) |
| `due_month` | `Integer` | `nullable=True` | Mês p/ anual (1-12) |

### `client_template_assignments` — novo campo

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `last_generated_at` | `DateTime(timezone=True)` | `nullable=True` | Última vez que o scheduler gerou tarefas p/ este assignment |

## Lógica por Recorrência

### Item 17 — Diário
- Se hoje é dia útil (seg-sex) E não há task pendente para hoje:
  - Cria task com deadline = `next_business_day(now)` às 18:00
- Se já existe task pendente (status != "done"/"cancelled") → pula

### Item 18 — Semanal
- `weekday_mask` armazena dias selecionados (ex: "0,2,4" = seg, qua, sex)
- Se `weekday_mask` inclui o dia da semana atual E não há task pendente:
  - Cria task com deadline = hoje às 18:00
- Se `weekday_mask` for nulo, usa `due_day` como dia da semana (0-6)

### Item 19 — Quinzenal
- Se hoje é dia 01 ou 15 do mês (ajustado p/ próximo dia útil se fim-de-semana):
  - Cria task com deadline calculado
- Usa `due_day` da activity (1 ou 15)

### Item 20 — Mensal
- Já existe. Melhoria: aplicar `next_business_day` no deadline calculado
- Usa `due_day` da activity como dia do mês

### Item 21 — Anual
- Se `due_month` + `due_day` correspondem à data atual (ajuste fim-de-semana):
  - Cria task
- Usa `next_business_day` se cair em fim-de-semana

## Endpoints

| Método | Path | Função |
|--------|------|--------|
| `POST` | `/tasks/scheduler/run` | Varre todos assignments ativos, gera tarefas pendentes |
| `POST` | `/tasks/client-templates/{id}/regenerate` | Já existe — usar mesma lógica do scheduler |

## Frontend

- Botão **"Executar Rotinas"** no topo da página de tarefas (`TasksPage`)
- Ao clicar, chama `POST /tasks/scheduler/run`
- Toast de sucesso com quantidade de tarefas geradas

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `models.py` | + `weekday_mask`, `due_month`, `last_generated_at` |
| `schemas.py` | + `weekday_mask`, `due_month` nos schemas |
| `repository.py` | + `get_pending_tasks_count`, `update_last_generated` |
| `service.py` | + `SchedulerService.run()`, atualizar `regenerate_client_tasks` |
| `router.py` | + `POST /tasks/scheduler/run` |
| `alembic/` | Migration add fields |
| `TasksPage.tsx` | + botão "Executar Rotinas" |
| Testes | Por recorrência (5 tipos) |

## Testes

- `test_scheduler_daily_generates_on_weekday`
- `test_scheduler_daily_skips_weekend`
- `test_scheduler_daily_does_not_duplicate`
- `test_scheduler_weekly_generates_on_selected_day`
- `test_scheduler_weekly_skips_other_days`
- `test_scheduler_biweekly_generates_on_1_and_15`
- `test_scheduler_monthly_applies_next_business_day`
- `test_scheduler_annual_generates_on_month_day`
- `test_scheduler_isolation` — não gera tasks p/ outro usuário
