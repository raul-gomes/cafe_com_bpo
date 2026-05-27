# Plano de Implementação — Café com BPO

**Baseado em:** `docs/todo.md`
**Abordagem:** TDD (Test-Driven Development)
**Estratégia:** Menor artefato testável possível → commit → testes → próximo

---

## Fluxo de Trabalho por Tarefa

Cada tarefa segue este ciclo:

```
1. Escrever teste(s) que descrevem o comportamento desejado
2. Verificar que o teste falha (RED)
3. Implementar o mínimo para passar (GREEN)
4. Refatorar se necessário (REFACTOR)
5. Rodar TODOS os testes existentes (REGRESSION)
6. Commit convencional
```

### Comandos de Teste

| Escopo | Comando |
|--------|---------|
| Backend (todos) | `cd apps/backend && pytest -v` |
| Backend (arquivo) | `cd apps/backend && pytest tests/<file> -v` |
| Frontend (todos) | `cd apps/frontend && npm run test` |
| Frontend (arquivo) | `cd apps/frontend && npx vitest run <file>` |

---

## FASE 1: Nos Ajude (Sidebar + Modal)

**Escopo:** Apenas frontend. Mover botão "Nos Ajude" para acima do divider, criar modal com as opções da landing page.

### Tarefa 1.1 — Teste: Sidebar "Nos Ajude" button position

- **Arquivo:** `apps/frontend/test/PanelSidebar.test.tsx`
- **Testes:**
  - Renderiza sidebar e verifica que botão "Nos Ajude" está acima do divider
  - Verifica que botão "Sair" está abaixo do divider
  - Verifica que "Nos Ajude" NÃO redireciona (não usa `window.location.href`)
- **RED:** Testes falham (botão está no footer junto com logout)
- **GREEN:** Mover estrutura da sidebar: "Nos Ajude" fica dentro do `__section` (acima do `__footer`), "Sair" fica no `__footer`
- **Commit:** `feat(panel): reposition "Nos Ajude" button above sidebar divider`

### Tarefa 1.2 — Componente: ModalNosAjude

- **Arquivo novo:** `apps/frontend/src/components/panel/ModalNosAjude.tsx`
- **Testes:** `apps/frontend/test/ModalNosAjude.test.tsx`
  - Abre modal com opções de doação (PIX + formulário)
  - Fecha ao clicar no backdrop/X
  - Copia chave PIX para área de transferência
- **GREEN:** Implementar modal com PIX key, valores rápidos, formulário (baseado na seção `#nos-ajude` da HomePage)
- **Commit:** `feat(panel): add ModalNosAjude with PIX and donation options`

### Tarefa 1.3 — Integrar modal no sidebar

- **Arquivo:** `apps/frontend/src/components/panel/PanelSidebar.tsx`
- **Testes:** Atualizar `PanelSidebar.test.tsx`
  - Clicar em "Nos Ajude" abre modal (não redireciona)
  - Modal pode ser fechado
- **GREEN:** Substituir `window.location.href` por `setShowDonateModal(true)` + renderizar `<ModalNosAjude>`
- **Commit:** `feat(panel): integrate ModalNosAjude into PanelSidebar`

---

## FASE 2: Minhas Empresas → Meus Clientes

**Escopo:** Renomear "Minhas Empresas" para "Meus Clientes" + corrigir edição in-place.

### Tarefa 2.1 — Backend: Adicionar campo `address` ao Client model

- **Arquivo:** `apps/backend/src/modules/clients/models.py`
- **Campo novo:** `address = Column(Text, nullable=True)`
- **Schema:** `apps/backend/src/modules/clients/schemas.py` — adicionar `address: Optional[str] = None`
- **Testes:**
  - `test_clients_model.py`: Criar Client com address, verificar persistência
  - `test_clients_api.py`: POST /clients/ com address, GET /clients/ retorna address
- **Migração:** `alembic revision --autogenerate -m "add client address field"`
- **Commit:** `feat(clients): add address field to Client model and schema`

### Tarefa 2.2 — Frontend: Renomear "Minhas Empresas" → "Meus Clientes"

- **Arquivos:** 
  - `apps/frontend/src/pages/panel/EmpresasPage.tsx`
  - `apps/frontend/src/components/panel/PanelSidebar.tsx`
- **Testes:** `test/EmpresasPage.test.tsx`
  - Título da página é "Meus Clientes"
  - Sidebar mostra "Meus Clientes"
- **GREEN:** Substituir textos "Minhas Empresas" por "Meus Clientes" e "Empresa" por "Cliente"
- **Commit:** `fix(panel): rename "Minhas Empresas" to "Meus Clientes"`

### Tarefa 2.3 — Frontend: Editar client in-line (sem box separada no topo)

- **Arquivo:** `apps/frontend/src/pages/panel/EmpresasPage.tsx`
- **Comportamento atual:** Clicar no card abre um formulário no topo da página
- **Comportamento desejado:** Clicar no card expande o próprio card para edição in-place
- **Testes:** `test/EmpresasPage.test.tsx`
  - Clicar no card expande o card (não mostra form no topo)
  - Salvar edição fecha o card expandido
  - Cancelar edição fecha sem salvar
- **GREEN:** Modificar `handleStartEdit` para adicionar `editingId` e renderizar form dentro do card. Remover `showForm` no topo para edição (manter apenas para "Nova Empresa")
- **Commit:** `fix(panel): edit client inline instead of separate top form`

---

## FASE 3: Editar Perfil

**Escopo:** Adicionar campos faltantes (WhatsApp, Razão Social, Nome Fantasia, CNPJ, Endereço, Email Profissional, Telefone Comercial, Logo por empresa) e organizar em abas.

### Tarefa 3.1 — Backend: Adicionar campos ao User model

- **Arquivo:** `apps/backend/src/modules/auth/models.py`
- **Novos campos no User:**
  - `whatsapp = Column(String(50), nullable=True)`
  - `company_razao_social = Column(String(255), nullable=True)`
  - `company_nome_fantasia = Column(String(255), nullable=True)`
  - `company_cnpj = Column(String(50), nullable=True)`
  - `company_address = Column(Text, nullable=True)`
  - `company_professional_email = Column(String(255), nullable=True)`
  - `company_commercial_phone = Column(String(50), nullable=True)`
  - `company_logo_url = Column(String(500), nullable=True)`
  - `company_color_code = Column(String(10), nullable=True)` — nice to have
- **Testes:**
  - `test_auth.py`: Criar user com todos os campos, verificar persistência
- **Migração:** `alembic revision --autogenerate -m "add profile company fields"`
- **Commit:** `feat(auth): add profile fields to User model (whatsapp, company details)`

### Tarefa 3.2 — Backend: Atualizar schemas e endpoint PATCH /auth/me

- **Arquivos:**
  - `apps/backend/src/modules/auth/schemas.py` — criar `ProfileUpdate` schema
  - `apps/backend/src/modules/auth/router.py` — substituir `dict` por `ProfileUpdate`
  - `apps/backend/src/modules/auth/service.py` — atualizar `update_user_profile`
- **Testes:** `test_auth.py`
  - PATCH /auth/me atualiza whatsapp
  - PATCH /auth/me atualiza company_razao_social
  - PATCH /auth/me NÃO permite atualizar email
- **GREEN:** Implementar `ProfileUpdate` schema, usar no router, service
- **Commit:** `feat(auth): add ProfileUpdate schema and update PATCH /auth/me`

### Tarefa 3.3 — Frontend: Atualizar formulário de perfil

- **Arquivo:** `apps/frontend/src/pages/panel/PerfilPage.tsx`
- **Alterações:**
  - Aba "Dados Pessoais": Nome, Email (disabled), WhatsApp
  - Aba "Dados da Empresa": Razão Social, Nome Fantasia, CNPJ (mascara), Endereço, Email Profissional, Telefone Comercial (mascara), Logo, Código de Cores
  - Abas ocupam todo o espaço horizontal da box
- **Testes:** `test/PerfilPage.test.tsx`
  - Renderiza aba Dados Pessoais com WhatsApp
  - Renderiza aba Dados da Empresa com todos os campos
  - Salvar atualiza todos os campos
- **Commit:** `feat(panel): expand PerfilPage with company details and WhatsApp`

---

## FASE 4: Templates → Rotinas

**Escopo:** Renomear "Templates" para "Rotinas" + nova lógica de recorrência + "criar uma única vez".

### Tarefa 4.1 — Backend: Adicionar novos tipos de recorrência ao ActivityTemplate

- **Arquivo:** `apps/backend/src/modules/tasks/models.py`
- **Adicionar opções de recurrence:**
  - `once` (única vez)
  - `daily` (diário)
  - `weekly` (semanal)
  - `biweekly` (quinzenal)
  - `monthly` (mensal) — já existe
  - `yearly` (anual)
- **Schema:** Atualizar `ActivityTemplateBase.recurrence` — `str = "monthly"` (flexível via validator)
- **Adicionar campos:**
  - `due_date` (data de vencimento) — relevante para `once` e `daily`/`weekly`
  - `recurrence_end_date` (opcional, para templates que expiram)
- **Testes:**
  - `test_api_tasks.py`: Criar template `once`, `daily`, `weekly`, `biweekly`, `yearly`
- **Migração:** `alembic revision --autogenerate -m "add new recurrence types to activity_templates"`
- **Commit:** `feat(tasks): expand ActivityTemplate recurrence options (once, daily, weekly, biweekly, yearly)`

### Tarefa 4.2 — Backend: Lógica de "Atrasado" para tarefas recorrentes

- **Arquivo:** `apps/backend/src/modules/tasks/service.py`
- **Lógica:** Tarefas recorrentes não se acumulam. Se a task de hoje não foi feita, exibe tag "Atrasado X dias" em vez de criar nova task
- **Endpoint:** Adicionar campo `overdue_days: Optional[int]` no `TaskResponse`
- **Testes:**
  - `test_api_tasks.py`: Criar task recorrente com deadline passado, verificar `overdue_days`
  - Verificar que não duplica tasks
- **Commit:** `feat(tasks): add overdue tracking for recurring tasks without duplication`

### Tarefa 4.3 — Frontend: Renomear "Templates" → "Rotinas"

- **Arquivos:**
  - `apps/frontend/src/pages/panel/TemplateListPage.tsx`
  - `apps/frontend/src/components/panel/PanelSidebar.tsx`
  - `apps/frontend/src/pages/panel/TemplateDetailPage.tsx`
- **Testes:** Atualizar testes para verificar novo nome "Rotinas"
- **GREEN:** Substituir textos "Templates" por "Rotinas", "Template de Atividades" por "Rotinas de Atividades"
- **Commit:** `fix(panel): rename "Templates" to "Rotinas"`

### Tarefa 4.4 — Frontend: Opção "Criar uma única vez" no formulário de rotina

- **Arquivo:** `apps/frontend/src/pages/panel/TemplateListPage.tsx`
- **Alterações:**
  - No formulário de criação, adicionar opção "Tipo": "Recorrente" | "Pontual (única vez)"
  - Se "Pontual", campo "Data de Vencimento" aparece
  - Se "Recorrente", campo "Periodicidade" aparece (com as novas opções)
- **Testes:** `test/TemplateListPage.test.tsx`
  - Selecionar "Pontual" mostra campo de data
  - Selecionar "Recorrente" mostra campo de periodicidade
- **Commit:** `feat(panel): add "create once" option to Rotinas form`

### Tarefa 4.5 — Frontend: Exibir indicador de atraso nas rotinas

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx` (cards de tarefa)
- **Alterações:** Se `overdue_days > 0`, exibir tag "Atrasado X dias"
- **Testes:**
  - Card com `overdue_days=2` exibe "Atrasado 2 dias"
  - Card sem atraso não exibe tag
- **Commit:** `feat(panel): show overdue badge on recurring task cards`

---

## FASE 5: Gerenciador de Tarefas (Parte 1 — Fixes)

**Escopo:** Correções de bugs e pequenas melhorias.

### Tarefa 5.1 — Fix: Notificação de prazo no painel

- **Contexto:** Notificação no dashboard mostra prazo incorreto
- **Testes:** Verificar cálculo de dias restantes no `DashboardService`
- **GREEN:** Corrigir cálculo de diferença de datas no `service.py` do dashboard
- **Commit:** `fix(dashboard): correct task deadline notification calculation`

### Tarefa 5.2 — Fix: Fases não aparecem no painel

- **Contexto:** Fases adicionadas não aparecem
- **Testes:** 
  - Criar fase via API → GET /tasks/phases/ retorna a nova fase
  - Frontend: task move para fase correta
- **GREEN:** Verificar `usePhases()` hook e filtragem no frontend
- **Commit:** `fix(tasks): ensure all phases render in task manager panel`

### Tarefa 5.3 — Frontend: Contador de tarefas (pontuais + recorrentes em aberto)

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx`
- **Alteração:** No topo da página, exibir "X tarefas abertas (Y pontuais + Z recorrentes)"
- **Testes:** Com 3 tasks (2 pontuais, 1 recorrente), contador exibe valores corretos
- **Commit:** `feat(panel): add open task counter (one-off + recurring)`

### Tarefa 5.4 — Frontend: Botão "Finalizar" em cada card

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx` (kanban cards)
- **Alteração:** Adicionar botão "✓ Finalizar" no card. Ao clicar, move para fase "Concluído"
- **Testes:** Clicar em finalizar → task vai para fase concluído
- **Commit:** `feat(panel): add "Finalizar" button to task cards`

### Tarefa 5.5 — Frontend: Borda vermelha para atraso + tempo de atraso

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx`
- **Alteração:** Se deadline passou, card ganha `border: 2px solid red` + "X dias em atraso"
- **Testes:** Task com deadline ontem → borda vermelha + "1 dia em atraso"
- **Commit:** `feat(panel): add red border and delay message for overdue tasks`

### Tarefa 5.6 — Frontend: Nome da empresa na timeline

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx` (timeline view)
- **Alteração:** Na visão timeline, cada task exibe nome do cliente/empresa
- **Testes:** Timeline mostra `client_name` junto com `title`
- **Commit:** `feat(panel): show company name in timeline view`

---

## FASE 6: Gerenciador de Tarefas (Parte 2 — Ordenação e Cards)

### Tarefa 6.1 — Frontend: Ordenar cards (vencidas primeiro, depois prioridade alta)

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx`
- **Alteração:** Dentro de cada fase, ordenar: tarefas vencidas → prioridade alta → demais (por data)
- **Testes:** Mock 4 tasks em mesma fase, verificar ordem do DOM
- **Commit:** `feat(panel): sort tasks by overdue then priority`

### Tarefa 6.2 — Frontend: Seções "Cards do dia", "Em andamento", "Em atraso"

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx`
- **Alteração:** Na visão kanban, adicionar seções/abas no topo: "Hoje", "Em andamento", "Atrasadas"
- **Testes:** Cada aba filtra tasks corretamente
- **Commit:** `feat(panel): add task sections for today, in progress, overdue`

### Tarefa 6.3 — Frontend: Datas de criação e finalização no card

- **Arquivo:** `apps/frontend/src/components/tasks/TaskModal.tsx` e cards
- **Alteração:** Exibir `created_at` e (se concluído) data de finalização em cada card
- **Commit:** `feat(panel): show creation and completion dates on task cards`

### Tarefa 6.4 — Frontend: Tag "Em andamento" na timeline e calendário

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx`
- **Alteração:** Se phase = "Em Andamento", exibir tag azul "Em andamento"
- **Testes:** Task em andamento mostra tag; task em "A Fazer" não mostra
- **Commit:** `feat(panel): add "in progress" tag to calendar and timeline views`

---

## FASE 7: Gerenciador de Tarefas (Parte 3 — Filtros e Cancelamento)

### Tarefa 7.1 — Backend: Adicionar campo `cancelled_at` no Task model

- **Arquivo:** `apps/backend/src/modules/tasks/models.py`
- **Campo novo:** `cancelled_at = Column(DateTime(timezone=True), nullable=True)`
- **Schema:** Adicionar `cancelled_at` no `TaskResponse`
- **Endpoint:** PATCH /tasks/{id}/cancel (soft cancel, não deleta)
- **Testes:**
  - Cancelar task → `cancelled_at` preenchido
  - Listar tasks não retorna tasks canceladas (a menos que `include_cancelled=True`)
- **Migração:** `alembic revision --autogenerate -m "add cancelled_at to tasks"`
- **Commit:** `feat(tasks): add task cancellation with cancelled_at field`

### Tarefa 7.2 — Frontend: Filtros por período e fase

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx`
- **Alteração:** Adicionar barra de filtros: input date range + dropdown de fase
- **Testes:** Selecionar filtro reduz lista de tasks
- **Commit:** `feat(panel): add date range and phase filters to task manager`

### Tarefa 7.3 — Frontend: Botão "Cancelar" em cada card

- **Arquivo:** `apps/frontend/src/pages/panel/TasksPage.tsx`
- **Alteração:** Adicionar opção "Cancelar" no card (com confirmação)
- **Testes:** Cancelar task → card some da view padrão
- **Commit:** `feat(panel): add cancel task option to task cards`

---

## FASE 8: Gerenciador de Tarefas (Parte 4 — Google Agenda e Notas)

### Tarefa 8.1 — Backend: Adicionar campo `notes` ao Task model

- **Arquivo:** `apps/backend/src/modules/tasks/models.py`
- **Campo novo:** `notes = Column(Text, nullable=True)`
- **Schema:** Adicionar `notes: Optional[str] = None`
- **Testes:** Criar/atualizar task com notes
- **Migração:** `alembic revision --autogenerate -m "add notes to tasks"`
- **Commit:** `feat(tasks): add notes field to task model`

### Tarefa 8.2 — Frontend: Campo de notas explicativas em cada card

- **Arquivo:** `apps/frontend/src/components/tasks/TaskModal.tsx`
- **Alteração:** Adicionar textarea "Notas" no modal de edição/criação
- **Testes:** Salvar task com notas → notas persistem
- **Commit:** `feat(panel): add explanatory notes field to task modal`

### Tarefa 8.3 — Google Calendar Integration (esqueleto)

- **Criar variáveis de ambiente:** `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`
- **Backend:** Módulo `src/modules/calendar/` com:
  - `GoogleCalendarService` — autenticação OAuth2 + criação de eventos
  - Endpoint: POST /calendar/sync — envia tasks para Google Calendar
- **Frontend:** Botão "Sincronizar com Google Agenda" no TasksPage
- **Testes:** Mock do Google Calendar API, verificar criação de evento
- **Nota:** Implementação inicial simples (apenas envio, não recebimento)
- **Commit:** `feat(calendar): add Google Calendar sync for tasks`

---

## Resumo de Commits

| # | Tipo | Escopo | Descrição |
|---|------|--------|-----------|
| 1 | feat | panel | Reposition "Nos Ajude" button above sidebar divider |
| 2 | feat | panel | Add ModalNosAjude with PIX and donation options |
| 3 | feat | panel | Integrate ModalNosAjude into PanelSidebar |
| 4 | feat | clients | Add address field to Client model and schema |
| 5 | fix | panel | Rename "Minhas Empresas" to "Meus Clientes" |
| 6 | fix | panel | Edit client inline instead of separate top form |
| 7 | feat | auth | Add profile fields to User model (whatsapp, company details) |
| 8 | feat | auth | Add ProfileUpdate schema and update PATCH /auth/me |
| 9 | feat | panel | Expand PerfilPage with company details and WhatsApp |
| 10 | feat | tasks | Expand ActivityTemplate recurrence options |
| 11 | feat | tasks | Add overdue tracking for recurring tasks |
| 12 | fix | panel | Rename "Templates" to "Rotinas" |
| 13 | feat | panel | Add "create once" option to Rotinas form |
| 14 | feat | panel | Show overdue badge on recurring task cards |
| 15 | fix | dashboard | Correct task deadline notification calculation |
| 16 | fix | tasks | Ensure all phases render in task manager |
| 17 | feat | panel | Add open task counter (one-off + recurring) |
| 18 | feat | panel | Add "Finalizar" button to task cards |
| 19 | feat | panel | Add red border and delay message for overdue tasks |
| 20 | feat | panel | Show company name in timeline view |
| 21 | feat | panel | Sort tasks by overdue then priority |
| 22 | feat | panel | Add task sections for today, in progress, overdue |
| 23 | feat | panel | Show creation and completion dates on task cards |
| 24 | feat | panel | Add "in progress" tag to calendar and timeline views |
| 25 | feat | tasks | Add task cancellation with cancelled_at field |
| 26 | feat | panel | Add date range and phase filters to task manager |
| 27 | feat | panel | Add cancel task option to task cards |
| 28 | feat | tasks | Add notes field to task model |
| 29 | feat | panel | Add explanatory notes field to task modal |
| 30 | feat | calendar | Add Google Calendar sync for tasks |

---

## Riscos e Trade-offs

1. **Google Calendar Integration complexa:** Depende de OAuth2 externo. Se faltar credenciais, a feature fica bloqueada. **Mitigação:** Criar esqueleto com mock, feature toggled via env var.
2. **Migrations em produção:** Cada alteração de modelo gera migration. Banco precisa estar saudável. **Mitigação:** Testar migrations em staging primeiro.
3. **SQLite vs PostgreSQL em testes:** Alguns tipos (ARRAY, JSON) precisam de patch no `conftest.py`. Já existe `SQLiteArray`. Monitorar se novos campos quebram.
4. **Tamanho do frontend:** TasksPage tem 485 linhas — vai crescer. **Mitigação:** Extrair componentes (TaskCard, TaskFilters, TaskCounter) em arquivos separados.
5. **Renomear "Templates" para "Rotinas"** pode quebrar URLs/bookmarks existentes. Manter alias de rota `/templates-atividades` redirecionando para `/rotinas`.

---

## Estratégia de Testes

### Backend (`pytest`)
- **Model/repository tests:** Testar CRUD, constraints, isolamento entre usuários
- **API tests:** Testar endpoints com `TestClient`, verificar status codes, payloads
- **Service tests:** Lógica de negócio (ex: cálculo de overdue, recorrência)

### Frontend (`vitest + @testing-library/react`)
- **Component tests:** Renderizar componente, interagir, verificar estado
- **Page tests:** Renderizar página com dados mockados, verificar elementos
- **Hook tests:** Verificar chamadas de API, transformação de dados
