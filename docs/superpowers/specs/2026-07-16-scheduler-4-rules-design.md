# Scheduler — 4 Regras de Geração de Tasks

**Data:** 2026-07-16
**Status:** Aprovado ✅

## 1. Visão Geral

Substituir o scheduler atual (baseado em "gerar hoje") por 4 regras independentes que executam em momentos específicos. Cada regra é responsável por gerar tasks de um tipo de recorrência, sempre **pré-gerando** para o período seguinte.

## 2. As 4 Regras

### Regra ① — Diária

**Quando executa:** Toda segunda, terça, quarta e quinta à meia-noite (00:00 UTC)
**O que gera:** Task diária para o **próximo dia útil**
**Não executa:** Sexta, sábado, domingo

| Hoje (00:00) | Gera task p/ |
|-------------|-------------|
| Segunda | Terça |
| Terça | Quarta |
| Quarta | Quinta |
| Quinta | Sexta |
| Sexta | ❌ Nada |
| Sábado | ❌ Nada |
| Domingo | ❌ Nada (a task de segunda é gerada pela regra semanal) |

**Chave UUID:** `daily:{YYYY-MM-DD}` (data-alvo da task)

### Regra ② — Semanal

**Quando executa:** Domingo à meia-noite (00:00 UTC)
**O que gera:**
1. Tasks **semanais** para a semana seguinte (conforme `weekday_mask`)
2. Task **diária de segunda-feira** (substitui a regra diária que não rodou na sexta)

**Chave UUID semanal:** `weekly:{YYYY-MM-DD}` (data-alvo)
**Chave UUID diária de segunda:** `daily:{YYYY-MM-DD}` (data = segunda)

### Regra ③ — Mensal

**Quando executa:** Último dia útil do mês (00:00 UTC)
**O que gera:** Tasks mensais para o **mês seguinte**
**Chave UUID:** `monthly:{YYYY-MM}`

### Regra ④ — Anual

**Quando executa:** Último dia útil do ano (00:00 UTC, junto com a regra mensal se coincidir)
**O que gera:** Tasks anuais para o **ano seguinte**
**Chave UUID:** `yearly:{YYYY}`

## 3. Execução (Rocketry)

O Rocketry executa **todo dia** à meia-noite (`cron("0 0 * * *")`). Dentro da task única:

```
função executar():
    se hoje é útil (seg-sex):
        executar_regra_diaria()
    se hoje é domingo:
        executar_regra_semanal()
    se hoje é último dia útil do mês:
        executar_regra_mensal()
    se hoje é último dia útil do ano:
        executar_regra_anual()
```

**Importante:** As regras são **aditivas** — se mais de uma regra cair no mesmo dia (ex: 31/dez cai numa quarta), todas executam.

## 4. UUID de Instância (`routine_instance_id`)

### 4.1 Propósito

Identificar unicamente uma "instância" de task gerada por rotina, permitindo dedup robusto entre execuções.

### 4.2 Definição

```
namespace = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # DNS Namespace
instance_id = uuid.uuid5(namespace, f"{assignment_id}:{activity_name}:{period_key}")
```

Onde `period_key` varia por regra:

| Regra | period_key | Exemplo |
|-------|-----------|---------|
| Diária | `daily:{target_date}` | `daily:2026-07-20` |
| Semanal | `weekly:{target_date}` | `weekly:2026-07-22` |
| Mensal | `monthly:{YYYY-MM}` | `monthly:2026-08` |
| Anual | `yearly:{YYYY}` | `yearly:2027` |

### 4.3 Dedup

Antes de criar qualquer task, verificar:

```sql
SELECT id FROM tasks
WHERE routine_instance_id = :instance_id
  AND is_active = true
  AND status NOT IN ('done', 'cancelled')
```

Se existir, **pular** (já foi criada em execução anterior).

### 4.4 Vantagens do UUID5

- **Determinístico:** Mesma entrada → mesmo UUID. Execuções múltiplas do scheduler não duplicam.
- **Sem colisão:** Namespace + assignment_id + activity_name + período são únicos.
- **Sem estado compartilhado:** Não precisa de tabela auxiliar ou lock.

## 5. Modelo de Dados

### Task — field novo

```
routine_instance_id: UUID | None
  - nullable: true (tasks manuais não têm)
  - index: true (busca por dedup)
```

## 6. Utilitários

### `last_business_day(year: int, month: int) -> int`

Retorna o último dia útil do mês (seg-sex).

```
último = calendar.monthrange(year, month)[1]
enquanto último for sábado (5) ou domingo (6):
    último -= 1
retorna último
```

### `is_last_business_day_of_month(date: datetime) -> bool`

`date.day == last_business_day(date.year, date.month)`

### `is_last_business_day_of_year(date: datetime) -> bool`

`date.month == 12 AND is_last_business_day_of_month(date)`

### `next_business_day(date: datetime) -> datetime`

Já existe em `src.core.utils`. Ajusta para próximo dia útil se cair em fim de semana.

### `build_routine_instance_id(assignment_id, activity_name, period_key) -> UUID`

`uuid5(namespace, f"{assignment_id}:{activity_name}:{period_key}")`

## 7. Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `src/modules/tasks/models.py` | +`routine_instance_id` (UUID, nullable, index) |
| `src/modules/tasks/schemas.py` | +`routine_instance_id` opcional no response |
| `src/modules/tasks/repository.py` | +`task_exists_by_instance_id()` |
| `src/modules/tasks/scheduler.py` | Reescrever com as 4 regras |
| `src/main.py` | Cron: `"0 0 * * *"` (meia-noite) |
| Alembic | Migration para `routine_instance_id` |
| `tests/test_api_tasks.py` | Adaptar testes do scheduler |

## 8. Testes

### Testes a adaptar (existentes)

- `test_scheduler_daily_generates_on_weekday` — ajustar para gerar p/ next day
- `test_scheduler_weekly_with_weekday_mask` — ajustar para gerar remaining weekdays
- `test_scheduler_monthly_*` — verificar last business day
- `test_scheduler_yearly_*` — verificar last business day of year
- `test_scheduler_isolation` — deve continuar funcionando
- `test_scheduler_no_assignments` — deve continuar funcionando
- `test_scheduler_response_structure` — ajustar se necessário

### Testes novos

- `test_routine_instance_id_daily_dedup`: mesma UUID não gera duplicata
- `test_routine_instance_id_weekly_dedup`: mesma UUID não gera duplicata
- `test_routine_instance_id_monthly_dedup`: mesma UUID não gera duplicata
- `test_daily_generates_for_next_weekday`: seg→ter, ter→qua, qui→sex, sex→nada
- `test_weekly_generates_all_masks_on_sunday`: domingo gera semana toda
- `test_sunday_also_generates_monday_daily`: domingo gera task diária de segunda
- `test_monthly_on_last_business_day`: gera no último dia útil
- `test_monthly_skips_non_last_day`: não gera em dias comuns
- `test_yearly_on_last_business_day_of_dec`: gera em 31/dez se for útil
- `test_yearly_skips_non_december`: não gera em outros meses
- `test_last_business_day_function`: utilitário funciona para vários meses
- `test_scheduler_run_daily_endpoint`: endpoint /run-daily funciona
- `test_scheduler_run_monthly_endpoint`: endpoint /run-monthly funciona
