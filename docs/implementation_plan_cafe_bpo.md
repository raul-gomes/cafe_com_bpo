# Plano de Implementação Macro — Café com BPO

Este documento descreve a implementação macro do projeto Café com BPO em fases, com foco em TDD, separação de responsabilidades, segurança, cache, escalabilidade e testabilidade.

## Stack definida

### Backend
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- pytest
- httpx / TestClient
- Passlib / pwdlib para hashing
- python-jose ou equivalente para JWT
- Redis opcional para cache

### Frontend
- React
- TypeScript
- Vite
- React Router
- React Hook Form
- Zod
- TanStack Query
- React Testing Library
- Vitest
- MSW

### Infra
- Docker
- Docker Compose
- Hostinger VPS
- Nginx ou Caddy opcional como reverse proxy

---

## Estratégia geral de TDD

Cada fase deve seguir o ciclo:

1. Escrever os testes da fase.
2. Confirmar que os testes falham.
3. Implementar o mínimo necessário para passar.
4. Refatorar preservando a suíte verde.
5. Validar manualmente o fluxo principal da fase.
6. Avançar apenas quando a fase estiver estável.

Princípios:
- Todo bug corrigido deve ganhar um teste de regressão.
- Toda regra crítica de negócio deve possuir testes de unidade.
- Toda integração com recursos externos deve possuir testes de integração.
- Todo fluxo crítico do usuário deve possuir ao menos um teste E2E.

---

# Fase 0 — Fundação do monorepo, ambiente e pipeline TDD

## Objetivo

Criar a estrutura base do monorepo, preparar backend, frontend, banco, Docker Compose e comandos de teste. Esta fase não entrega regra de negócio, mas entrega a fundação para todas as demais.

## Estrutura sugerida

```txt
cafe-com-bpo/
  apps/
    backend/
    frontend/
  packages/
    shared/
  infra/
  docker-compose.yml
  README.md
```

## Backend

### `Settings`
**Tipo:** classe de configuração.

**Responsabilidade:**
Centraliza leitura e validação de variáveis de ambiente, como URL do banco, segredo JWT, modo da aplicação, credenciais OAuth e configuração de cache.

**Uso da classe:**
É a fonte única de configuração. Evita espalhar `os.getenv` por todo o código.

**Entradas:**
- Variáveis de ambiente do processo.

**Saídas:**
- Instância validada com atributos tipados.

**Pattern:**
Configuration Object Pattern.

---

### `get_settings()`
**Tipo:** função de fábrica com cache interno.

**Responsabilidade:**
Cria e retorna uma instância única de `Settings` para ser reutilizada pela aplicação.

**Entradas:**
- Nenhuma explícita; lê do ambiente.

**Saídas:**
- `Settings`

**Pattern:**
Factory Function + Cached Singleton leve.

---

### `create_app()`
**Tipo:** função fábrica.

**Responsabilidade:**
Monta e retorna a aplicação FastAPI com middlewares, rotas, handlers de erro e dependências registradas.

**Entradas:**
- Opcionalmente `settings`.

**Saídas:**
- Instância FastAPI.

**Pattern:**
Application Factory Pattern.

---

### `health_check()`
**Tipo:** função de rota.

**Responsabilidade:**
Retorna um payload simples para verificação de saúde da aplicação.

**Entradas:**
- Request HTTP.

**Saídas:**
- JSON com status, timestamp e versão opcional.

**Pattern:**
Health Endpoint.

## Frontend

### `App`
**Tipo:** componente React raiz.

**Responsabilidade:**
Carrega providers globais, roteamento e estrutura de bootstrap da aplicação.

**Entradas:**
- Nenhuma direta.

**Saídas:**
- Árvore React principal.

---

### `buildRouter()`
**Tipo:** função fábrica.

**Responsabilidade:**
Configura as rotas públicas e privadas da aplicação.

**Entradas:**
- Configuração opcional de rotas.

**Saídas:**
- Router do React Router.

**Pattern:**
Factory Pattern.

---

### `HomePage`
**Tipo:** componente de página.

**Responsabilidade:**
Representa a landing page principal do projeto.

**Entradas:**
- Nenhuma na fase inicial.

**Saídas:**
- UI HTML/JSX.

---

### `LoginPage`
**Tipo:** componente de página.

**Responsabilidade:**
Representa a tela pública de autenticação.

**Entradas:**
- Nenhuma na fase inicial.

**Saídas:**
- UI HTML/JSX.

## Testes da fase

### Backend
- `test_create_app_returns_fastapi_instance`
- `test_health_check_returns_200`
- `test_settings_load_from_environment`
- `test_settings_fail_when_required_env_is_missing`

### Frontend
- `renders_app_root_without_crashing`
- `renders_home_route`
- `renders_login_route`
- `renders_not_found_for_unknown_route`

---

# Fase 1 — Banco, ORM e persistência inicial

## Objetivo

Criar a infraestrutura de dados com PostgreSQL, modelos ORM, sessões SQLAlchemy, migrações Alembic e repositórios.

## Backend

### `Base`
**Tipo:** classe base ORM.

**Responsabilidade:**
Serve como base declarativa para modelos SQLAlchemy.

**Entradas:**
- Não aplicável.

**Saídas:**
- Metadados ORM.

---

### `get_db_session()`
**Tipo:** função geradora/dependência.

**Responsabilidade:**
Abre uma sessão de banco para a request atual e garante encerramento adequado.

**Entradas:**
- Configuração do banco.

**Saídas:**
- Sessão SQLAlchemy.

**Pattern:**
Dependency Injection via FastAPI Depends.[cite:76][cite:77]

---

### `User`
**Tipo:** classe ORM.

**Responsabilidade:**
Representa o usuário persistido no banco.

**Campos principais:**
- `id`
- `email`
- `password_hash`
- `auth_provider`
- `created_at`
- `updated_at`

**Uso da classe:**
Entidade de persistência para autenticação e relacionamento com cenários.

---

### `PricingScenario`
**Tipo:** classe ORM.

**Responsabilidade:**
Representa um cenário de precificação salvo por um usuário.

**Campos principais:**
- `id`
- `user_id`
- `client_name`
- `input_payload`
- `result_payload`
- `created_at`
- `updated_at`

**Uso da classe:**
Permite histórico e edição de simulações.

---

### `UserRepository`
**Tipo:** classe de acesso a dados.

**Responsabilidade:**
Encapsula toda operação de leitura e escrita relacionada a usuários.

**Uso da classe:**
Evita que controllers e services dependam diretamente do ORM.

**Pattern:**
Repository Pattern.[cite:81][cite:84]

#### `create_user(email: str, password_hash: str, auth_provider: str = "local")`
**Responsabilidade:**
Cria e persiste um novo usuário.

**Entradas:**
- `email`
- `password_hash`
- `auth_provider`

**Saídas:**
- `User`

#### `get_user_by_email(email: str)`
**Responsabilidade:**
Busca um usuário por e-mail.

**Entradas:**
- `email`

**Saídas:**
- `User | None`

#### `get_user_by_id(user_id: UUID)`
**Responsabilidade:**
Busca um usuário por id.

**Entradas:**
- `user_id`

**Saídas:**
- `User | None`

---

### `PricingScenarioRepository`
**Tipo:** classe de acesso a dados.

**Responsabilidade:**
Encapsula persistência e leitura de cenários.

**Pattern:**
Repository Pattern.[cite:81][cite:84]

#### `create_scenario(user_id: UUID, client_name: str, input_payload: dict, result_payload: dict)`
**Entradas:**
- `user_id`
- `client_name`
- `input_payload`
- `result_payload`

**Saídas:**
- `PricingScenario`

#### `list_scenarios_by_user(user_id: UUID)`
**Entradas:**
- `user_id`

**Saídas:**
- `list[PricingScenario]`

#### `get_scenario_by_id(user_id: UUID, scenario_id: UUID)`
**Entradas:**
- `user_id`
- `scenario_id`

**Saídas:**
- `PricingScenario | None`

#### `delete_scenario(user_id: UUID, scenario_id: UUID)`
**Entradas:**
- `user_id`
- `scenario_id`

**Saídas:**
- `bool`

## Testes da fase

- `test_alembic_upgrade_applies_schema_successfully`
- `test_create_user_persists_record`
- `test_get_user_by_email_returns_user`
- `test_create_user_with_duplicate_email_raises_integrity_error`
- `test_create_scenario_persists_json_payload_and_result`
- `test_list_scenarios_by_user_returns_only_user_records`
- `test_get_scenario_by_id_returns_none_for_other_user`
- `test_delete_scenario_removes_record`

---

# Fase 2 — Domínio de precificação

## Objetivo

Transformar a lógica da planilha em regras de domínio testáveis e independentes de framework.

## Backend

### `OperationContext`
**Tipo:** dataclass / modelo de domínio.

**Responsabilidade:**
Representa o contexto operacional interno usado para calcular custo hora e custo minuto.

**Campos:**
- `total_cost`
- `people_count`
- `hours_per_month`
- `tax_rate`

**Uso da classe:**
Objeto base para todas as contas estruturais da precificação.

---

### `ServiceItem`
**Tipo:** dataclass / modelo de domínio.

**Responsabilidade:**
Representa um serviço operacional que compõe a mensalidade.

**Campos:**
- `name`
- `minutes_per_execution`
- `monthly_quantity`
- `fixed_value` opcional

**Uso da classe:**
Cada item informa consumo de tempo ou valor fixo por serviço.

---

### `PricingInput`
**Tipo:** modelo de domínio.

**Responsabilidade:**
Agrega `OperationContext`, lista de serviços e margem desejada.

**Campos:**
- `operation`
- `services`
- `desired_profit_margin`

---

### `PricingBreakdown`
**Tipo:** modelo de domínio.

**Responsabilidade:**
Representa os componentes intermediários do cálculo.

**Campos:**
- `cost_per_hour`
- `cost_per_minute`
- `service_costs`
- `total_service_cost`
- `profit_amount`
- `tax_amount`

---

### `PricingResult`
**Tipo:** modelo de domínio.

**Responsabilidade:**
Representa o resultado final consolidado da precificação.

**Campos:**
- `final_price`
- `breakdown`
- `assumptions`

---

### `PricingCalculator`
**Tipo:** classe de serviço de domínio.

**Responsabilidade:**
Executa todas as regras de cálculo e retorna `PricingResult`.

**Uso da classe:**
É o núcleo do negócio. Deve ser altamente coberta por testes de unidade.

#### `calculate_cost_per_hour(operation: OperationContext)`
**Entradas:**
- `operation`

**Saídas:**
- `Decimal`

**Responsabilidade:**
Calcula o custo médio por hora da operação.

#### `calculate_cost_per_minute(operation: OperationContext)`
**Entradas:**
- `operation`

**Saídas:**
- `Decimal`

**Responsabilidade:**
Calcula o custo médio por minuto da operação.

#### `calculate_service_cost(service: ServiceItem, cost_per_minute: Decimal)`
**Entradas:**
- `service`
- `cost_per_minute`

**Saídas:**
- `Decimal`

**Responsabilidade:**
Calcula custo total de um serviço considerando tempo e quantidade.

#### `calculate_total_service_cost(services: list[ServiceItem], cost_per_minute: Decimal)`
**Entradas:**
- `services`
- `cost_per_minute`

**Saídas:**
- `Decimal`

**Responsabilidade:**
Soma todos os custos variáveis/fixos dos serviços.

#### `calculate_profit_amount(base_cost: Decimal, desired_profit_margin: Decimal)`
**Entradas:**
- `base_cost`
- `desired_profit_margin`

**Saídas:**
- `Decimal`

**Responsabilidade:**
Calcula lucro sobre a base de custo.

#### `calculate_tax_amount(price_before_tax: Decimal, tax_rate: Decimal)`
**Entradas:**
- `price_before_tax`
- `tax_rate`

**Saídas:**
- `Decimal`

**Responsabilidade:**
Calcula valor do tributo sobre o valor antes do imposto.

#### `calculate_final_price(pricing_input: PricingInput)`
**Entradas:**
- `pricing_input`

**Saídas:**
- `PricingResult`

**Responsabilidade:**
Orquestra as demais funções e devolve o resultado consolidado.

**Pattern:**
Service Layer / Domain Service.

## Testes da fase

- `test_calculate_cost_per_hour_from_total_cost_people_and_hours`
- `test_calculate_cost_per_minute_from_hour_cost`
- `test_calculate_single_service_cost`
- `test_calculate_total_service_cost_from_multiple_services`
- `test_calculate_profit_amount_from_margin`
- `test_calculate_tax_amount_from_tax_rate`
- `test_calculate_final_price_matches_expected_result`
- `test_calculate_pricing_matches_reference_spreadsheet_case`
- `test_raises_when_total_cost_is_negative`
- `test_raises_when_people_count_is_zero`
- `test_raises_when_hours_per_month_is_zero`
- `test_raises_when_service_minutes_is_negative`
- `test_raises_when_profit_margin_is_negative`
- `test_raises_when_tax_rate_is_greater_than_one`

---

# Fase 3 — Schemas Pydantic, service layer e endpoint de cálculo

## Objetivo

Expor o cálculo via API com contrato tipado e validações robustas.

## Backend

### `PricingCalculateRequest`
**Tipo:** schema Pydantic.

**Responsabilidade:**
Define o contrato de entrada do endpoint de cálculo.

**Entradas:**
- JSON HTTP.

**Saídas:**
- Objeto validado.

---

### `PricingCalculateResponse`
**Tipo:** schema Pydantic.

**Responsabilidade:**
Padroniza o formato da resposta da API de cálculo.

---

### `PricingService`
**Tipo:** classe de aplicação.

**Responsabilidade:**
Traduz schemas HTTP em objetos de domínio e invoca `PricingCalculator`.

**Uso da classe:**
Isola a camada HTTP da camada de domínio.

**Pattern:**
Application Service.

#### `calculate_pricing(request: PricingCalculateRequest)`
**Entradas:**
- `request`

**Saídas:**
- `PricingCalculateResponse`

**Responsabilidade:**
Converte payload, executa o cálculo e monta resposta serializável.

---

### `calculate_pricing_endpoint()`
**Tipo:** função de rota FastAPI.

**Responsabilidade:**
Recebe request HTTP, injeta dependências, chama `PricingService` e retorna resposta.

**Entradas:**
- `PricingCalculateRequest`
- Dependências via `Depends`

**Saídas:**
- JSON HTTP

**Pattern:**
Controller / Endpoint Handler + Dependency Injection.[cite:76][cite:89]

## Testes da fase

- `test_post_calculate_returns_200_with_expected_schema`
- `test_post_calculate_returns_422_when_required_field_missing`
- `test_post_calculate_returns_422_for_negative_numeric_values`
- `test_post_calculate_does_not_expose_internal_traceback_on_domain_error`
- `test_post_calculate_returns_consistent_error_shape`

---

# Fase 4 — Autenticação local com e-mail e senha

## Objetivo

Implementar cadastro, login, hashing seguro, tokens e proteção de rotas.

## Backend

### `PasswordService`
**Tipo:** classe de serviço.

**Responsabilidade:**
Encapsula hashing e verificação de senha.

#### `hash_password(plain_password: str)`
**Entradas:**
- `plain_password`

**Saídas:**
- `str`

**Responsabilidade:**
Gera hash seguro da senha.

#### `verify_password(plain_password: str, hashed_password: str)`
**Entradas:**
- `plain_password`
- `hashed_password`

**Saídas:**
- `bool`

**Responsabilidade:**
Compara senha informada com hash armazenado.

---

### `TokenService`
**Tipo:** classe de serviço.

**Responsabilidade:**
Cria e valida tokens de autenticação.

#### `create_access_token(user_id: str, subject: str | None = None)`
**Entradas:**
- `user_id`
- `subject`

**Saídas:**
- `str`

#### `decode_access_token(token: str)`
**Entradas:**
- `token`

**Saídas:**
- `dict`

---

### `AuthService`
**Tipo:** classe de aplicação.

**Responsabilidade:**
Coordena repositório de usuário, hashing e tokens.

#### `register_user(email: str, password: str)`
**Entradas:**
- `email`
- `password`

**Saídas:**
- `User`

#### `authenticate_user(email: str, password: str)`
**Entradas:**
- `email`
- `password`

**Saídas:**
- `str | None`

**Responsabilidade:**
Valida credenciais e retorna token de acesso.

---

### `get_current_user()`
**Tipo:** dependência FastAPI.

**Responsabilidade:**
Resolve o usuário autenticado a partir do token enviado.

**Entradas:**
- Header Authorization.

**Saídas:**
- `User`

**Pattern:**
Dependency Injection + Authorization Gate.[cite:76][cite:89]

## Testes da fase

- `test_register_user_returns_201_and_user_payload`
- `test_register_rejects_duplicate_email`
- `test_register_rejects_weak_password`
- `test_login_returns_access_token_for_valid_credentials`
- `test_login_rejects_wrong_password`
- `test_protected_route_rejects_missing_token`
- `test_protected_route_rejects_expired_token`
- `test_auth_response_never_returns_password_hash`
- `test_error_messages_do_not_allow_user_enumeration`

---

# Fase 5 — OAuth Google e Microsoft

## Objetivo

Adicionar autenticação social de forma segura.

## Backend

### `OAuthStateService`
**Tipo:** classe de segurança.

**Responsabilidade:**
Cria e valida o `state` usado no fluxo OAuth para evitar CSRF.

#### `create_state()`
**Saídas:**
- `str`

#### `validate_state(state: str)`
**Entradas:**
- `state`

**Saídas:**
- `bool`

---

### `GoogleOAuthProvider`
**Tipo:** classe de integração.

**Responsabilidade:**
Encapsula a comunicação com o OAuth do Google.

#### `build_authorization_url(state: str)`
**Entradas:**
- `state`

**Saídas:**
- `str`

#### `exchange_code_for_token(code: str)`
**Entradas:**
- `code`

**Saídas:**
- `dict`

#### `fetch_user_profile(access_token: str)`
**Entradas:**
- `access_token`

**Saídas:**
- `dict`

---

### `MicrosoftOAuthProvider`
**Tipo:** classe de integração.

**Responsabilidade:**
Encapsula a comunicação com o OAuth da Microsoft.

**Mesma estrutura do provider do Google.**

## Testes da fase

- `test_google_oauth_redirect_returns_valid_url`
- `test_google_callback_creates_user_on_first_login`
- `test_google_callback_logs_in_existing_user`
- `test_microsoft_callback_creates_or_reuses_user`
- `test_oauth_callback_rejects_invalid_state`
- `test_oauth_callback_handles_profile_without_email`

---

# Fase 6 — Shell do frontend e autenticação no React

## Objetivo

Criar a base do frontend com router, providers, estado de autenticação e cliente HTTP.

## Frontend

### `AppProviders`
**Tipo:** componente agregador.

**Responsabilidade:**
Agrupa QueryClientProvider, RouterProvider, AuthProvider e demais providers globais.

**Pattern:**
Provider Composition Pattern.

---

### `apiClient`
**Tipo:** módulo/função utilitária.

**Responsabilidade:**
Centraliza chamadas HTTP, headers padrão, interceptação de erro e token.

#### `request<T>(config)`
**Entradas:**
- Config de request.

**Saídas:**
- Resposta tipada `T`.

**Pattern:**
API Client Abstraction.

---

### `AuthProvider`
**Tipo:** contexto React.

**Responsabilidade:**
Mantém o estado do usuário autenticado no frontend.

---

### `useAuth()`
**Tipo:** custom hook.

**Responsabilidade:**
Expõe operações de login, logout e leitura do usuário atual.

**Saídas:**
- `{ user, login, logout, isAuthenticated }`

**Pattern:**
Custom Hook Pattern.

---

### `ProtectedRoute`
**Tipo:** componente guard.

**Responsabilidade:**
Impede acesso a rotas privadas quando não há autenticação válida.

**Pattern:**
Route Guard Pattern.

## Testes da fase

- `renders_app_with_query_client_and_router`
- `protected_route_redirects_when_not_authenticated`
- `protected_route_renders_children_when_authenticated`
- `auth_provider_exposes_user_login_logout_state`
- `api_client_attaches_auth_header_when_token_exists`

---

# Fase 7 — Formulários com React Hook Form e Zod

## Objetivo

Criar formulários robustos e reutilizáveis para login, cadastro e calculadora.

## Frontend

### `loginSchema`
**Tipo:** schema Zod.

**Responsabilidade:**
Define as regras de validação do formulário de login.

**Entradas:**
- Objeto com e-mail e senha.

**Saídas:**
- Resultado de validação.

---

### `pricingFormSchema`
**Tipo:** schema Zod.

**Responsabilidade:**
Define o contrato e validações do formulário da calculadora.

**Pattern:**
Schema Validation Pattern.[cite:82][cite:88]

---

### `LoginForm`
**Tipo:** componente React.

**Responsabilidade:**
Renderiza e gerencia o formulário de login.

**Entradas:**
- Callbacks opcionais.

**Saídas:**
- UI + submissão estruturada.

---

### `PricingForm`
**Tipo:** componente React.

**Responsabilidade:**
Coleta os dados da calculadora e serializa para a API.

**Entradas:**
- Valores iniciais opcionais.
- Callback de submit.

**Saídas:**
- Payload compatível com backend.

**Pattern:**
Controlled Form Orchestration usando React Hook Form.[cite:82][cite:85]

## Testes da fase

- `login_form_shows_required_errors_on_empty_submit`
- `login_form_shows_invalid_email_error`
- `register_form_validates_password_strength`
- `pricing_form_renders_dynamic_service_rows`
- `pricing_form_validates_negative_numbers`
- `pricing_form_serializes_valid_payload_for_api`

---

# Fase 8 — Calculadora pública

## Objetivo

Entregar a experiência pública de cálculo e visualização de resultado.

## Frontend

### `useCalculatePricing()`
**Tipo:** custom hook.

**Responsabilidade:**
Encapsula a mutation de cálculo usando TanStack Query.

**Entradas:**
- Payload da calculadora.

**Saídas:**
- `{ mutate, data, error, isPending }`

**Pattern:**
Mutation Hook Pattern.

---

### `PublicPricingCalculatorPage`
**Tipo:** página React.

**Responsabilidade:**
Orquestra formulário, chamada à API e visualização de resultado.

---

### `PricingResultView`
**Tipo:** componente de apresentação.

**Responsabilidade:**
Renderiza resumo, breakdown e preço final do cálculo.

**Pattern:**
Presentational Component Pattern.

## Testes da fase

- `public_calculator_submits_valid_form_and_renders_result`
- `public_calculator_shows_summary_breakdown_and_final_price`
- `public_calculator_shows_server_validation_errors`
- `public_calculator_shows_generic_error_on_network_failure`
- `public_calculator_disables_submit_while_loading`

---

# Fase 9 — Relatório HTML

## Objetivo

Gerar um relatório HTML seguro a partir do resultado da calculadora.

## Backend

### `PricingReportService`
**Tipo:** classe de serviço.

**Responsabilidade:**
Transforma `PricingResult` em contexto de template e produz HTML final.

#### `build_report_context(result: PricingResult)`
**Entradas:**
- `result`

**Saídas:**
- `dict`

#### `render_pricing_report_html(context: dict)`
**Entradas:**
- `context`

**Saídas:**
- `str`

---

## Frontend

### `PricingHtmlReportPreview`
**Tipo:** componente React.

**Responsabilidade:**
Renderiza visualmente o relatório HTML retornado pelo backend.

### `ReportActions`
**Tipo:** componente React.

**Responsabilidade:**
Exibe ações como salvar e baixar relatório.

## Testes da fase

- `test_render_pricing_report_html_contains_expected_sections`
- `test_render_pricing_report_html_escapes_user_content_safely`
- `report_preview_renders_html_safely_in_expected_container`
- `report_actions_show_download_and_save_buttons`

---

# Fase 10 — Área de membros e cenários salvos

## Objetivo

Permitir persistência, listagem, visualização e edição de cenários.

## Backend

### `ScenarioService`
**Tipo:** classe de aplicação.

**Responsabilidade:**
Coordena repositório, cálculo e regras de ownership dos cenários.

#### `save_scenario(user_id: UUID, request: PricingCalculateRequest)`
**Entradas:**
- `user_id`
- `request`

**Saídas:**
- `PricingScenario`

#### `list_user_scenarios(user_id: UUID)`
**Entradas:**
- `user_id`

**Saídas:**
- `list[PricingScenario]`

#### `get_user_scenario(user_id: UUID, scenario_id: UUID)`
**Entradas:**
- `user_id`
- `scenario_id`

**Saídas:**
- `PricingScenario | None`

#### `update_user_scenario(user_id: UUID, scenario_id: UUID, request: PricingCalculateRequest)`
**Entradas:**
- `user_id`
- `scenario_id`
- `request`

**Saídas:**
- `PricingScenario`

#### `delete_user_scenario(user_id: UUID, scenario_id: UUID)`
**Entradas:**
- `user_id`
- `scenario_id`

**Saídas:**
- `bool`

---

## Frontend

### `ScenarioList`
**Tipo:** componente React.

**Responsabilidade:**
Lista os cenários do usuário.

### `ScenarioCard`
**Tipo:** componente React.

**Responsabilidade:**
Renderiza resumo de um cenário salvo.

### `MemberPricingCalculatorPage`
**Tipo:** página React.

**Responsabilidade:**
Versão logada da calculadora com suporte a salvar, editar e duplicar.

## Testes da fase

- `test_save_scenario_requires_auth_and_persists_data`
- `test_list_user_scenarios_returns_only_owned_records`
- `test_update_user_scenario_changes_input_and_result`
- `member_scenarios_page_lists_saved_scenarios`
- `member_scenario_edit_recalculates_and_saves`
- `member_pages_redirect_to_login_on_401`

---

# Fase 11 — Gate de login para baixar/salvar relatório

## Objetivo

Permitir acesso público à visualização do relatório, mas restringir download e persistência a usuários autenticados.

## Frontend

### `RequireLoginActionModal`
**Tipo:** componente React.

**Responsabilidade:**
Solicita autenticação quando uma ação protegida é disparada.

### `persistPendingScenarioDraft()`
**Tipo:** função utilitária.

**Responsabilidade:**
Armazena temporariamente o cenário em memória, session storage ou estratégia equivalente segura.

**Entradas:**
- Payload da calculadora.

**Saídas:**
- Nenhuma.

### `recoverPendingScenarioDraft()`
**Tipo:** função utilitária.

**Responsabilidade:**
Recupera o cenário pendente após autenticação.

**Saídas:**
- `PricingCalculateRequest | None`

---

## Backend

### `generate_pdf_from_report_html(html: str)`
**Tipo:** função/serviço.

**Responsabilidade:**
Converte o HTML do relatório em PDF.

**Entradas:**
- `html`

**Saídas:**
- `bytes`

### `download_scenario_report_pdf(user_id: UUID, scenario_id: UUID)`
**Tipo:** serviço de aplicação.

**Responsabilidade:**
Valida ownership, gera PDF e devolve binário para download.

**Entradas:**
- `user_id`
- `scenario_id`

**Saídas:**
- `bytes`

## Testes da fase

- `guest_can_view_report_but_not_download_without_login`
- `guest_clicking_save_opens_login_prompt`
- `after_login_pending_scenario_is_recovered_and_saved`
- `authenticated_user_can_download_pdf`
- `pdf_download_endpoint_rejects_non_owner_access`

---

# Fase 12 — Cache, headers de segurança e observabilidade

## Objetivo

Adicionar desempenho, resiliência e segurança operacional para produção.

## Backend

### `CacheService`
**Tipo:** classe de infraestrutura.

**Responsabilidade:**
Abstrai acesso ao cache Redis ou cache local.

#### `get(key: str)`
**Entradas:**
- `key`

**Saídas:**
- `Any | None`

#### `set(key: str, value: Any, ttl_seconds: int)`
**Entradas:**
- `key`
- `value`
- `ttl_seconds`

**Saídas:**
- `None`

---

### `PricingCacheKeyBuilder`
**Tipo:** classe utilitária.

**Responsabilidade:**
Gera chave determinística para cache de cálculos.

#### `build(pricing_input: PricingInput)`
**Entradas:**
- `pricing_input`

**Saídas:**
- `str`

**Pattern:**
Key Builder Pattern.

---

### `SecurityHeadersMiddleware`
**Tipo:** middleware.

**Responsabilidade:**
Adiciona headers de segurança como CSP, X-Frame-Options e similares.

**Pattern:**
Middleware Pattern.

---

### `RequestIdMiddleware`
**Tipo:** middleware.

**Responsabilidade:**
Gera e propaga request id para rastreabilidade.

**Pattern:**
Middleware Pattern.

## Testes da fase

- `test_same_pricing_input_hits_cache_after_first_calculation`
- `test_cache_key_changes_when_any_relevant_input_changes`
- `test_cache_failure_does_not_break_calculation_flow`
- `test_security_headers_are_present`
- `test_cors_allows_only_expected_origins`
- `test_unhandled_exceptions_return_generic_error_payload`

---

# Fase 13 — Home refatorada e integração de aquisição

## Objetivo

Refatorar a home atual para refletir a proposta final: comunidade + calculadora + área de membros.

## Frontend

### `HeroSection`
**Tipo:** componente React.

**Responsabilidade:**
Apresenta a promessa principal do site e CTA primário.

### `ManifestoSection`
**Tipo:** componente React.

**Responsabilidade:**
Explica o posicionamento anti-guru e a proposta de comunidade realista.

### `BenefitsSection`
**Tipo:** componente React.

**Responsabilidade:**
Apresenta benefícios da comunidade e da área de membros.

### `CalculatorTeaserSection`
**Tipo:** componente React.

**Responsabilidade:**
Promove a calculadora pública como porta de entrada.

### `FaqSection`
**Tipo:** componente React.

**Responsabilidade:**
Esclarece dúvidas frequentes.

## Testes da fase

- `home_renders_primary_value_proposition`
- `home_has_cta_to_calculator_and_login`
- `home_sections_render_expected_content_blocks`
- `home_is_accessible_by_keyboard_for_primary_actions`

---

# Fase 14 — Testes E2E e hardening final

## Objetivo

Validar todos os fluxos críticos do sistema, incluindo cenários felizes e falhas relevantes.

## Fluxos E2E obrigatórios

- `e2e_guest_visits_home_and_navigates_to_calculator`
- `e2e_guest_calculates_price_successfully`
- `e2e_guest_attempts_download_and_is_prompted_to_login`
- `e2e_guest_registers_after_calculation_and_recovers_pending_scenario`
- `e2e_authenticated_user_downloads_pdf_successfully`
- `e2e_member_creates_saves_edits_and_deletes_scenario`
- `e2e_protected_routes_are_not_accessible_when_logged_out`
- `e2e_session_expiration_redirects_to_login`
- `e2e_invalid_route_shows_not_found_page`

---

# Observações finais de arquitetura

## Padrões usados no backend
- Application Factory Pattern
- Repository Pattern
- Service Layer Pattern
- Dependency Injection com FastAPI Depends[cite:76][cite:77][cite:89]
- Middleware Pattern
- Configuration Object Pattern

## Padrões usados no frontend
- Provider Pattern
- Custom Hook Pattern
- Route Guard Pattern
- Presentational / Container separation quando necessário
- Schema Validation com Zod + React Hook Form[cite:82][cite:85]

## Regras obrigatórias de implementação
- Nenhuma feature entra sem teste.
- Nenhuma rota autenticada pode retornar dados de outro usuário.
- Nenhum HTML vindo de input do usuário pode ser renderizado sem sanitização.
- Nenhuma informação sensível deve aparecer em logs ou respostas de erro.
- Todo cache deve falhar em modo degradado, nunca quebrando o fluxo principal.
- Toda fase precisa fechar com validação automatizada e validação manual.
