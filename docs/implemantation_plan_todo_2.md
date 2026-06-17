# Implementation Plan – Todo (v2)

## 📋 Visão Geral
Este documento transforma o conteúdo do **docs/todo.md** em entregas técnicas concretas, organizadas por módulo (frontend / backend), com escopo, critérios de aceite, tarefas, prioridades, dependências e riscos. Cada item será tratado em sprints de duas semanas, com estratégia de testes, CI e checklist de entrega.

---

## 1️⃣ Perfil do Usuário (Frontend + Backend)

| # | Escopo | Critérios de Aceite | Tarefas Técnicas | Prioridade | Dependências | Riscos |
|---|--------|----------------------|------------------|------------|--------------|--------|
| 1 | Máscaras de **CNPJ** e **telefone** nos campos de cadastro/edição | • Input aceita apenas formato válido (CNPJ XX.XXX.XXX/0001‑XX, telefone (XX) XXXXX‑XXXX) <br>• Mensagem de erro clara | • Instalar `react-input-mask` (ou usar `zod` + `react-hook-form` custom) <br>• Atualizar `src/pages/panel/PerfilPage.tsx` <br>• Atualizar schema Zod (`src/schemas/perfil.ts`) <br>• Testes unitários de máscara (Vitest) | alta | Nenhuma | Compatibilidade com navegadores antigos (fallback) |
| 2 | **Tabela de cores** para escolha da cor da logo | • Usuário vê paleta (ex.: 8 cores) <br>• Seleção salva em `user_profile.logo_color` <br>• Valor default = cor primária | • Criar componente `ColorPicker` (grid de swatches) <br>• Extender `UserProfile` schema (backend) <br>• Persistir via PATCH `/users/me` <br>• Atualizar UI de “Meu Perfil” <br>• Testes de integração (API + UI) | média | 1 | Persistência de cor em DB (migração) |
| 3 | **Cor primária** e **cor secundária** (fallback preto) | • Se secundária não informada, UI usa `#000000` <br>• Ambas armazenadas no perfil | • Campos adicionais no formulário <br>• Lógica de fallback no tema (CSS custom properties) <br>• Atualizar `src/theme.ts` para ler do profile <br>• Testes de tema (snapshot) | média | 2 | Tema global pode precisar de rebuild de CSS |
| 4 | **Formulário em abas** (organização) | • Cada seção (dados pessoais, empresa, avatar, cores) em aba distinta <br>• Navegação preserva estado ao mudar de aba | • Utilizar `@radix-ui/react-tabs` ou `shadcn/ui Tabs` <br>• Refatorar `PerfilForm` para dividir em sub‑componentes <br>• Testes de navegação (Vitest + React Testing Library) | média | 1,2,3 | Complexidade de validação cruzada entre abas |
| 5 | **Preencher “Meu Perfil”** com dados existentes | • Ao abrir a página, todos campos já vêm preenchidos | • GET `/users/me` ao montar página <br>• Mapear resposta para valores dos campos <br>• Teste de carregamento (mock API) | alta | Backend já tem endpoint | Nenhum |
| 6 | **Segmento “Outros” → input livre** | • Quando “Outros” selecionado, exibe campo de texto <br>• Valor salvo como `segmento_custom` | • Alterar `SegmentoSelect` para incluir opção “Outros” <br>• Condicional render de `<input>` <br>• Atualizar schema e backend (`segmento_custom` column) <br>• Testes de UI + API | média | 1 | Validação de texto livre (tamanho, caracteres) |
| 7 | **Remover “Nome da empresa” (legado)** e substituir por **Razão Social** e **Nome Fantasia** | • Campo “Nome da empresa” não aparece mais <br>• Dados migrados para novos campos | • Atualizar DB migration (renomear coluna ou criar novas) <br>• Atualizar DTOs e schemas <br>• Atualizar UI (remover campo, inserir novos) <br>• Script de migração de dados (SQL) <br>• Testes de migração (pytest) | alta | Nenhuma | Dados legados podem estar incompletos |
| 8 | **Avatar da empresa e avatar pessoal** | • Upload de imagem (max 2 MB, PNG/JPG) <br>• Preview após upload <br>• Salvo em `/storage/avatars/{user_id}.png` <br>• URL retornada no perfil | • Criar endpoint `POST /users/me/avatar` (FastAPI, `UploadFile`) <br>• Front: componente `AvatarUploader` usando `react-dropzone` <br>• Persistir caminho no DB (`avatar_url`) <br>• Testes de upload (pytest + httpx) <br>• Testes UI (Vitest) | alta | 5 | Segurança (validação MIME) e limpeza de arquivos antigos |
| 9 | **Distribuir formulário em abas** (mesmo item 4) | — | — | — | — | — |

---

## 2️⃣ Painel (Frontend)

| # | Escopo | Critérios de Aceite | Tarefas Técnicas | Prioridade | Dependências | Riscos |
|---|--------|----------------------|------------------|------------|--------------|--------|
| 11| **Alertas desaparecem** quando task concluída ou data de vencimento alterada | • Alertas só aparecem para tasks pendentes/atrasadas <br>• Ao marcar “Concluída” ou mudar data, alerta é removido imediatamente | • Atualizar `TaskCard` para disparar evento `onStatusChange` <br>• No store (Zustand/Redux) filtrar alerts por `status !== "done"` e `dueDate >= today` <br>• Refazer query de tasks no painel (useSWR/React‑Query) <br>• Testes de UI (Vitest) para garantir remoção | alta | `TaskCard` já existente | Condição de “alterar data” pode precisar de debounce |
| 12| **Contador de tarefas em aberto/atrasadas** (corrigir cálculo) | • Contador reflete exatamente número de tasks abertas + atrasadas <br>• Atualiza em tempo real ao mudar status | • Revisar lógica de contagem no hook `useTaskStats` <br>• Garantir que `status` e `dueDate` sejam considerados <br>• Testes unitários (jest) para cenários de borda (vencimento hoje, timezone) | média | 11 | Diferença de fuso horário entre backend (UTC) e frontend (local) |
| 13| **Botões “Confirmar” e “Cancelar” maiores** | • Botões aumentados 1.5× (acessibilidade) <br>• Mantém layout responsivo | • Ajustar CSS (`--ds-spacing-4` → `--ds-spacing-6`) ou Tailwind `p-4` → `p-6` <br>• Verificar contraste (WCAG AA) <br>• Testes visual regression (Chromatic ou Percy) | baixa | Nenhuma | Quebra de layout em telas pequenas |

---

## 3️⃣ Rotinas (Backend + Frontend)
> **Visão geral**: Rotinas são “templates” de tarefas recorrentes. Cada tipo tem regras de geração de datas.

| # | Escopo | Critérios de Aceite | Tarefas Técnicas | Prioridade | Dependências | Riscos |
|---|--------|----------------------|------------------|------------|--------------|--------|
| 14| **Modelo de Rotina** (campos listados) | • Entidade `Routine` com campos: `title`, `description`, `due_days`, `priority`, `estimated_hours`, `type`, `frequency`, `weekday_mask`, `day_of_month`, `month_day`, `created_at` | • Criar migration Alembic `add_routine_table` <br>• Definir Pydantic schema (`RoutineCreate`, `RoutineUpdate`, `RoutineRead`) <br>• Implementar repository + service + router (`/routines`) <br>• Testes unitários (pytest) | alta | Nenhuma | Migração de dados (se houver) |
| 15| **Cálculo de vencimento em dias úteis** | • Se data cair em fim de semana, avançar para próximo dia útil | • Função utilitária `next_business_day(date)` (Python) <br>• Usar em service ao criar/atualizar rotina <br>• Testes de data (parametrizados) | alta | 14 | Feriados não cobertos (poderá ser estendido) |
| 16| **“Um só vez” – remover data fixa, usar “dias após criação”** | • Campo `due_days` (int) ao invés de `due_date` <br>• API aceita `due_days` e calcula `due_date` na criação | • Alterar schema e migration (coluna `due_days`) <br>• Atualizar lógica de criação (service) <br>• Atualizar UI (campo numérico) <br>• Testes de criação e cálculo | média | 14 | Compatibilidade com rotinas já existentes (migrar) |
| 17| **Diário – gerar de segunda a sexta, sem data** | • Tarefa criada automaticamente todos os dias úteis se não houver pendente | • Scheduler (Celery ou `APScheduler`) rodando diariamente <br>• Verificar existência de task aberta antes de criar <br>• Endpoint `/routines/daily` (trigger interno) <br>• Testes de scheduler (freezegun) | média | 14 | Overhead de scheduler no container |
| 18| **Semanal – escolher dia da semana** | • UI mostra checkboxes Mon‑Fri; ao selecionar, rotina gera task naquele dia | • Campo `weekday_mask` (bitmask ou array) <br>• UI `WeekdaySelector` <br>• Service gera task na próxima ocorrência do dia escolhido <br>• Testes de geração | média | 14 | Complexidade de máscara de dias |
| 19| **Quinzenal – gerar nos dias 01 e 15, pular fim de semana** | • Se 01/15 for sábado ou domingo, mover para próximo dia útil | • Campo `bi_monthly` boolean + lógica de ajuste <br>• Scheduler roda nos dias 01 e 15 <br>• Testes de ajuste de data | média | 14 | Calendário de feriados pode precisar de ajuste futuro |
| 20| **Mensal – vencimento ajustado para próximo dia útil** | • Mesmo ajuste de fim de semana que acima | • Reusar `next_business_day` <br>• UI permite escolher “dia do mês” (1‑28) <br>• Scheduler mensal <br>• Testes | média | 14 | Usuário pode escolher 31 → necessidade de fallback |
| 21| **Anual – escolher dia e mês, ajuste fim de semana** | • UI com `select` de mês + `input` de dia <br>• Scheduler anual <br>• Testes | média | 14 | Ano bissexto (29/02) |
| 22| **Editar rotina existente** | • Usuário pode mudar qualquer campo, alterações refletidas nas próximas gerações | • PATCH `/routines/{id}` <br>• UI “Editar” modal <br>• Testes de atualização e geração posterior | média | 14 | Conflito se houver tasks já geradas com data antiga |
| 23| **Tipo de rotina definido pelo usuário** | • Usuário cria novo “tipo” (ex.: “Reunião cliente”) com sugestões opcionais | • Tabela `routine_type` (id, name, suggestions JSON) <br>• CRUD endpoints <br>• UI “Gerenciar tipos” <br>• Testes | baixa | 14 | Necessidade de validação de nomes únicos |
| 24| **Exibir tipo no card de gestor de tarefas** | • Card mostra “Tipo: <nome>” | • Atualizar `TaskCard` para ler `routine_type.name` <br>• Testes de renderização | baixa | 23 | Nenhum |

---

## 4️⃣ Gestor de Tarefas (Frontend)

| # | Escopo | Critérios de Aceite | Tarefas Técnicas | Prioridade | Dependências | Riscos |
|---|--------|----------------------|------------------|------------|--------------|--------|
| 25| **Mostrar apenas tarefas do dia atual + atrasadas** | • Lista contém tasks com `due_date = today` ou `due_date < today && status != done` | • Filtrar no hook `useTasks` (query param `?filter=today,overdue`) <br>• Backend endpoint `/tasks?today=true&overdue=true` <br>• Testes de filtro (API + UI) | alta | 11 | Timezone inconsistências |
| 26| **Contador de tarefas em aberto e atrasadas** (já coberto no item 12) | — | — | — | — | — |
| 27| **Botões “Confirmar”/“Cancelar” maiores** (já coberto no item 13) | — | — | — | — | — |

---

## 5️⃣ Sidebar (Frontend)

| # | Escopo | Critérios de Aceite | Tarefas Técnicas | Prioridade | Dependências | Riscos |
|---|--------|----------------------|------------------|------------|--------------|--------|
| 28| **Botão para exibir erro** | • Ao clicar, abre modal ou toast com mensagem de erro genérica (ex.: “Erro ao carregar dados”) | • Adicionar `<ErrorButton>` no `Sidebar` <br>• Hook `useError` (global state) <br>• UI modal/toast usando `shadcn/ui` <br>• Testes de interação | baixa | Nenhuma | Nenhum |

---

## 📅 Roadmap (Sprints de 2 semanas)
| Sprint | Itens (prioridade) | Principais entregas |
|--------|--------------------|---------------------|
| **1** (2 sem) | 1,5,9,10,13,25,28 | - Máscaras CNPJ/telefone <br> - API/DB para avatar <br> - Formulário “Meu Perfil” preenchido <br> - Sidebar botão de erro <br> - Painel filtra tasks (hoje/atrasadas) |
| **2** (2 sem) | 2,3,4,6,7,11,12 | - Tabela de cores + picker <br> - Tema com cores primária/secundária <br> - Formulário em abas <br> - Segmento “Outros” <br> - Migração de “Nome da empresa” → Razão Social/Nome Fantasia <br> - Alertas desaparecem ao concluir task |
| **3** (2 sem) | 14‑24 (Rotinas) | - Modelo de Rotina + CRUD <br> - Scheduler (diário, semanal, quinzenal, mensal, anual) <br> - Cálculo de dias úteis <br> - UI de criação/edição de rotinas <br> - Tipo de rotina customizável |
| **4** (2 sem) | 8,15,16,17,18,19,20,21,22,23,24 | - Ajustes finos de geração de datas <br> - Exibir tipo no card de tarefa <br> - Testes de integração (frontend + backend) <br> - Documentação de API (OpenAPI) |
| **5** (1 sem) | Refino, testes de carga, auditoria de acessibilidade, CI/CD | - Cobertura de testes > 90 % <br> - Lint/format passes <br> - Deploy em ambiente de staging <br> - Checklist de segurança (CSRF, upload sanitização) |

---

## 🧪 Estratégia de Testes
| Camada | Ferramenta | Escopo |
|--------|------------|--------|
| **Backend unit** | `pytest` + `httpx` | Repositórios, serviços, cálculo de datas úteis, migrações |
| **Backend integration** | `pytest` (docker‑compose) | Endpoints `/users/me`, `/routines/*`, upload avatar |
| **Frontend unit** | Vitest + React Testing Library | Componentes `TaskCard`, `ColorPicker`, `AvatarUploader`, `RoutineForm` |
| **Frontend e2e** | Playwright (opcional) | Fluxos de cadastro, criação de rotina, painel de tarefas |
| **Lint/Format** | Ruff (backend), ESLint/Prettier (frontend) | Zero warnings |
| **CI** | GitHub Actions (já existente) | `ruff check → ruff format --check → pytest` (backend) <br> `lint → typecheck → test` (frontend) |

---

## ⚠️ Riscos & Mitigações
| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Fusos horários** entre backend (UTC) e frontend (local) | Dados de vencimento incorretos | Sempre armazenar datas em UTC; converter para local apenas na UI. Testar com `freezegun`. |
| **Migração de colunas legadas** (nome da empresa) | Perda de dados | Script de migração com `SELECT INTO` + backup antes de aplicar. |
| **Upload de avatar** – arquivos maliciosos | Segurança | Validar MIME (`image/png`, `image/jpeg`), limitar tamanho, gerar hash aleatório para nome de arquivo, remover arquivos antigos. |
| **Scheduler** – tarefas duplicadas ou falhas | Inconsistência de dados | Utilizar lock de banco (`SELECT FOR UPDATE`) ou Celery beat com `max_instances=1`. |
| **Performance do painel** com grande volume de tasks | UI lenta | Paginação/infinite scroll, memoização de filtros, índices DB (`status`, `due_date`). |
| **Dependência de terceiros** (react‑input‑mask, react‑dropzone) | Quebra de build | Fixar versões no `package-lock.json`, monitorar vulnerabilidades. |

---

## 📦 Entregáveis
1. **Código** – PRs separados por sprint (ex.: `feat/profile-masks`, `feat/routine-model`, `feat/panel-alert-filter`).
2. **Documentação** – Atualizar `docs/` (API, UI guidelines, migrações) e `README.md` com novos endpoints.
3. **Changelog** – Cada PR inclui entry no `CHANGELOG.md` seguindo Conventional Commits.
4. **Deploy** – Imagens Docker versionadas (`cafe_com_bpo-api:1.3.0`, `cafe_com_bpo-web:1.3.0`).

---

### Próximos Passos Imediatos
1. **Abrir a primeira issue**: “Mascaras CNPJ/telefone + Avatar upload” (Sprint 1). 
2. **Criar branch `feat/profile-masks`** a partir de `main`. 
3. **Adicionar dependências** (`react-input-mask`, `react-dropzone`) ao `package.json`. 
4. **Escrever testes de máscara** (Vitest) e de upload (pytest). 
5. **Rodar CI localmente** (`docker compose up -d && npm run test && pytest`).

Com esse plano, temos clareza de escopo, prioridades e entregas mensuráveis para transformar o *Todo* em funcionalidades reais e testáveis. 🚀
