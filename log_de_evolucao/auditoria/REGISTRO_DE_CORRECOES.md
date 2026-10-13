# Registro de correções — auditoria de 12/10/2026

Histórico das correções feitas a partir do [RELATORIO.md](RELATORIO.md). Os arquivos originais da auditoria não são alterados; cada entrada aqui é acrescentada, nunca apagada.

Branch: `lab` (local, não enviada). Ponto de partida: `3ffc3ab`.

Método por item: conferir se o apontamento ainda existe → teste que falha pelo motivo certo → correção → lint/formatação/typecheck → suíte da área → commit próprio.

Ambiente de testes do backend: Python 3.12 limpo em container com o repositório montado só para leitura (cópia descartável a cada rodada), mesma ordem do CI: `ruff check` → `ruff format --check` → `pytest`.

Catálogos `docs/*.md` (lineage, tree_files, pendencias, regras_negocio, architecture): não existem neste checkout (a pasta `docs/` é ignorada pelo Git). Não foram criados. Mudanças que exigiriam atualização desses catálogos ficam anotadas em cada entrada.

## Decisões pedidas ao proprietário (12/10/2026)

| Item | Pergunta | Resposta |
| --- | --- | --- |
| AUD-009 | O produto vende só o plano mensal? | aguardando |
| AUD-008 | Quem já pagou mantém o acesso até o fim do período pago, mesmo se um aviso de atraso chegar depois? | aguardando |
| AUD-024 / AUD-040 | Mostrar Google Agenda como indisponível por ora; texto próprio para cada módulo em construção? | aguardando |

## Entradas

### AUD-001 — Vínculos de rotina entre contas — FEITA

- **Ainda existia?** Sim. O teste com duas contas confirmou: o outsider criou vínculo na empresa de outra conta (201), listou os vínculos dela (200), desativou (200) e removeu (204).
- **Regra encontrada no caminho:** o teste `test_team_routines_e2e.py` documenta o "Modelo A" das equipes, em que o colaborador convidado vincula as próprias rotinas às empresas onde é membro. A correção preserva isso.
- **Correção:** `AssignmentService` passou a exigir, na camada de serviço:
  - **criar e listar:** dono da empresa ou membro ativo da equipe;
  - **alterar, remover e regenerar:** dono, ou o membro que criou o vínculo.

  Ids alheios respondem 404, igual a inexistente.
- **Testes:** `tests/test_tenant_isolation.py::TestRoutineLinks` (5 casos: criar, listar, alterar/regenerar/remover por estranho, dono ainda gerencia, membro só gerencia o próprio vínculo). Falharam 3 de 4 antes da correção (o 5º foi escrito junto com a regra de equipe).
- **Validação:** ruff check/format limpos; suíte da área tarefas/equipes/rotinas: 233 passaram.
- **Arquivos:** `apps/backend/src/modules/task_manager/assignments/service.py`, `.../assignments/router.py`, `apps/backend/tests/test_tenant_isolation.py`.
- **Commit:** `5196b13`.

### AUD-002 — SLA sem isolamento por dono — FEITA

- **Ainda existia?** Sim. Teste com duas contas: o outsider listou (200), mudou para 999 dias (200) e apagou (204) o SLA de outra conta, e criou SLA na empresa dela (201).
- **Correção:** `SLAService` passou a exigir que a empresa seja do usuário em listar, criar, alterar e apagar (`delete_sla` agora recebe o usuário). SLA é configuração da empresa, então só o dono mexe. Ids alheios respondem 404.
- **Testes:** `tests/test_tenant_isolation.py::TestSLAs` (3 casos); 2 falharam antes da correção.
- **Validação:** ruff limpo; suíte da área: 237 passaram.
- **Arquivos:** `task_manager/sla/service.py`, `task_manager/sla/router.py`, teste.
- **Commit:** `2f3d554`.

### AUD-003 — Tarefa apontada para empresa de outra conta — FEITA

- **Ainda existia?** Sim. A tarefa mudou para a empresa de outra conta (200). Também confirmado que o `company_id` ficava com a empresa antiga ao trocar entre empresas próprias: o listener de escrita dupla só preenche `company_id` vazio.
- **Correção:** `TaskService.authorize_company_change`, chamado pela rota `PUT /tasks/{id}`:
  - o destino precisa ser empresa em que o usuário pode escrever (dono ou colaborador ativo, a mesma regra da criação);
  - o `company_id` acompanha o novo `client_id`;
  - card gerado por rotina não muda de empresa (409, com mensagem para editar o vínculo).
- **Testes:** `tests/test_tenant_isolation.py::TestTaskCompany` (3 casos); os 2 primeiros falharam antes da correção.
- **Validação:** ruff limpo; suíte da área: 240 passaram.
- **Arquivos:** `task_manager/task/service.py`, `task_manager/task/router.py`, teste.
- **Commit:** `6519cf1`.
- **Observação:** o drawer de tarefa ainda não mostra erros da API (é o AUD-020), então o 409 só aparece no console até lá.

### AUD-004 — Ações em lote afetando tarefas ocultas — FEITA

- **Ainda existia?** Sim. Com o filtro de uma empresa, "Concluir todos" mandava concluir também a tarefa da outra empresa; com a busca da coluna, "Cancelar todos" cancelava 2 tarefas quando só 1 aparecia.
- **Correção:**
  - nova função `columnVisibleTasks` (`components/tasks/kanbanColumn.ts`) calcula, num lugar só, o que a coluna mostra: fase, filtros de período e empresa, modo equipe e busca da coluna;
  - a coluna desenha, conta e entrega essa mesma lista às ações em lote;
  - a confirmação diz quantas tarefas visíveis e de qual empresa ("Concluir as 1 tarefa visível nesta coluna (Empresa Beta)?").
- **Testes:** `test/TasksPageBulkScope.test.tsx` (filtro de empresa e busca da coluna); os 2 falharam antes da correção.
- **Validação:** lint e typecheck limpos; testes das páginas de tarefas: 15 passaram.
- **Arquivos:** `components/tasks/kanbanColumn.ts` (novo), `components/tasks/TaskKanban.tsx`, `pages/panel/TasksPage.tsx`, teste.
- **Commit:** `7424b94`.

### Qualidade — falhas de Vitest registradas na COBERTURA — FEITA

- **`router.test` e `UpgradeModalRouter.test` (timeout de 5 s):**
  - **Causa:** `buildRoutes` esperava (`await`) o import de cerca de 40 páginas do painel antes de qualquer rota renderizar, incluindo as públicas. Isso também atrasava a primeira tela de quem visita o site.
  - **Correção:** essas páginas passaram a `React.lazy`, como as demais; todo uso já estava dentro do `SuspenseWrapper`.
  - **Resultado:** os testes caíram de mais de 5 s para 0,2 a 0,8 s, sem mexer em nenhum timeout. Commit `71d7a03`.
- **`DependencyResolution.test`:** era só portabilidade. No Windows o npm é um `.cmd`, que o `execFile` não abre (ENOENT). O teste agora chama `npm.cmd` por shell no Windows, com argumentos fixos, e mantém exatamente a mesma checagem `npm ci --dry-run --offline`. Commit `242bc61`.
- **Validação:** Vitest completo: 72 arquivos e 534 testes, todos passando, pela primeira vez neste checkout.

### AUD-005 — Finalizar contrato perdendo edições não salvas — FEITA

- **Ainda existia?** Sim. Com uma seção editada e não salva, "Finalizar" finalizava a versão antiga e o recarregamento descartava a edição.
- **Correção:** com edição pendente, o botão salva primeiro a versão exibida e só depois finaliza. Se salvar falhar, nada é finalizado e a edição continua na tela. A confirmação avisa que as alterações não salvas serão salvas antes.
- **Testes:** `test/ContratoDetalhePage.test.tsx`, 2 casos novos (ordem salvar → finalizar; falha ao salvar não finaliza); os 2 falharam antes da correção.
- **Validação:** lint e typecheck limpos; testes de contratos: 25 passaram.
- **Arquivos:** `pages/panel/ContratoDetalhePage.tsx`, teste.
- **Commit:** `f7b919e`.

### AUD-006 — Prévia de contrato finalizado mudando com dados atuais — FEITA

- **Ainda existia?** Sim. Teste: contrato finalizado com "Primeira Ltda" no perfil passou a mostrar "Segunda Ltda" depois que o perfil mudou.
- **Correção:**
  - ao finalizar, os campos variáveis do texto são resolvidos uma última vez com os dados daquele momento, e o resultado vira o documento gravado (`sections` e `template_sections`);
  - a prévia de um contrato finalizado devolve esse texto congelado, igual em todos os canais (detalhe, visualização, governança).
- **Testes:** `tests/test_api_contracts.py::test_finalized_contract_preview_is_the_snapshot_taken_at_finalization`; falhou antes da correção.
- **Validação:** ruff limpo; contratos, governança e propostas: 76 passaram.
- **Arquivos:** `contracts/service.py`, `contracts/repository.py`, `contracts/router.py`, teste.
- **Commit:** `78d82ce`.
- **Pendência registrada:** contratos já finalizados antes desta correção mantêm o texto que estava gravado. Se algum foi editado manualmente, esse texto pode ter campos `{{...}}` sem resolver. Corrigir isso exige decidir se esses documentos devem ser recongelados, e isso mexe em dados reais; não foi feito.

### AUD-007 — Edição pela timeline apagando a descrição — FEITA

- **Ainda existia?** Sim. Mudando só um campo, o drawer reenviava a descrição como texto vazio quando a tarefa vinha da timeline, cujo DTO não traz descrição.
- **Correção:**
  - o drawer envia na edição só os campos alterados (`dirtyFields`); campo esvaziado vai como `null`, então limpar continua funcionando;
  - a timeline passou a entregar só o id, e a página abre a tarefa completa da lista carregada; saiu o cast que escondia a diferença de DTO;
  - o tipo `TaskUpdate` do frontend aceita `null` nos campos que podem ser limpos, igual ao backend.
- **Testes:** `test/TaskDrawerPartialUpdate.test.tsx` (2 casos); os 2 falharam antes da correção.
- **Validação:** lint e typecheck limpos; Vitest completo: 538 passaram.
- **Arquivos:** `components/tasks/TaskDrawer.tsx`, `components/tasks/TaskTimeline.tsx`, `pages/panel/TasksPage.tsx`, `schemas/tasks.ts`, teste.
- **Commit:** `9f067dc`.

### AUD-008 e AUD-009 — Assinaturas — AGUARDANDO DECISÃO

- Os dois mexem na regra de cobrança e acesso, então aguardam a resposta do proprietário (ver tabela de decisões no início). Nada foi alterado.

### AUD-010 — Dados da proposta no HTML do e-mail — FEITA

- **Ainda existia?** Sim. Teste: um `client_name` com `<a href="https://phish.example">` virava link de verdade no e-mail oficial.
- **Correção:** `client_name` e `message` passam por `html.escape` antes de entrar no HTML; as quebras de linha da mensagem viram `<br>`, e o link de compartilhamento é escapado como atributo. O texto simples do e-mail continua igual.
- **Testes:** `tests/test_api_proposals_share.py::test_email_escapes_client_name_and_message`; falhou antes da correção.
- **Validação:** ruff limpo; testes de propostas: 37 passaram.
- **Arquivos:** `proposals/service.py`, teste.
- **Commit:** `cb51077`.

### Achado novo (mesma causa do AUD-010) — Convite de equipe — FEITA

- **Evidência:** `team/service.py::_send_invite_email` colocava o nome de quem convida e o nome da empresa no HTML sem escapar. Teste com nome `<a href=...>` confirmou.
- **Correção:** os mesmos escapes; a variável local `html` passou a se chamar `html_body`, para não sombrear o módulo.
- **Testes:** `tests/test_team_invite_email.py`; falhou antes da correção.
- **Validação:** testes de equipe: 16 passaram.
- **Commit:** `8065093`.

### AUD-011 — Cookie de renovação sem Secure — FEITA

- **Ainda existia?** Sim. Em `MODE=production` o Set-Cookie saía sem `Secure`.
- **Correção:**
  - um helper único grava o cookie no login e na renovação;
  - `Secure` é o padrão e só sai nos modos `development` e `test`, então um modo desconhecido falha fechado, como pede o AGENTS.md;
  - o logout apaga o cookie com os mesmos atributos.
- **Testes:** `tests/test_refresh_cookie_secure.py` (production, staging, teste e logout); 3 falharam antes da correção.
- **Validação:** testes de autenticação: 44 passaram.
- **Arquivos:** `auth/router.py`, teste.
- **Commit:** `184c4c8`.
- **Observação:** o Chrome aceita cookie `Secure` em `http://localhost`, então rodar o stack de produção localmente continua funcionando.

### AUD-012 — Storage sem persistência no Compose — FEITA

- **Ainda existia?** Sim. O serviço `api` do `docker-compose.yml` não montava nada em `/app/storage`.
- **Correção:** volume nomeado `api_storage:/app/storage` no `api`, declarado nos volumes do topo. A imagem já cria `/app/storage` com dono 1001; um volume nomeado herda esse dono na primeira montagem. `docker compose config` valida o arquivo.
- **Testes:** `tests/test_compose_storage.py` (o volume existe e está declarado; o Dockerfile cria o storage com o usuário da aplicação); o primeiro falhou antes da correção.
- **Arquivos:** `docker-compose.yml`, teste.
- **Commit:** `e1d08c0`.
- **Atenção no próximo deploy (não executado aqui):** os arquivos que já estão hoje dentro do container de produção, fora de qualquer volume, se perdem na recriação. Antes de subir esta versão no servidor, é preciso copiar o `/app/storage` do container atual para o volume novo (`docker cp`). Também vale incluir o `api_storage` no backup, junto do `postgres_data`.

### AUD-013 — Rotina geral parando no scheduler — FEITA

- **Ainda existia?** Sim. Teste: rotina geral do admin, vinculada por um operador depois do dia 10; a execução mensal do scheduler não gerou nada.
- **Correção:** o scheduler resolve o template com `include_general=True`, a mesma regra do vínculo.
- **Testes:** `tests/test_general_templates.py::test_scheduler_keeps_generating_a_general_routine_linked_by_an_operator`; falhou antes da correção (lista vazia).
- **Validação:** suíte da área tarefas e rotinas: 241 passaram.
- **Arquivos:** `task_manager/scheduler.py`, teste.
- **Commit:** `6c09b28`.

### AUD-014 — Campo CPF/CNPJ bloqueando CNPJ — FEITA

- **Ainda existia?** Sim. Digitando dígito por dígito (o `user-event` respeita o `maxLength`, como o navegador), o campo parava em "123.456.780-00".
- **Correção:** novo tipo `cpfCnpj` no `MaskedInput`: CPF até 11 dígitos, CNPJ depois disso, com o limite de tamanho do CNPJ desde o início. O formulário de cobrança passou a usar esse tipo, e a variação foi incluída no Design System.
- **Testes:** `test/BillingCpfCnpj.test.tsx` (CNPJ digitado e CPF); o de CNPJ falhou antes da correção.
- **Validação:** lint e typecheck limpos; Vitest completo: 540 passaram.
- **Arquivos:** `components/ui/MaskedInput.tsx`, `components/payments/BillingProfileForm.tsx`, `pages/panel/DesignSystemPage.tsx`, teste.
- **Commit:** `b6c34d2`.

### Verificação — suíte completa do backend depois dos P1

- **Primeira rodada:** 1 falha e 59 erros. A causa foi minha: enquanto ela rodava, disparei outros testes que recriavam o mesmo diretório de trabalho do container e apagaram arquivos no meio da execução. Não eram defeitos do código.
- **Segunda rodada, isolada:** 1.245 passaram, 2 ignorados (skip já existentes), 0 falhas, 0 erros; ruff limpo.
- **Ajuste no processo:** a suíte completa agora roda sozinha, sem testes em paralelo.

### AUD-015 e AUD-016 — Filtros de período — FEITA

- **Ainda existia?** Sim, os dois. Teste na página: o intervalo manual não escondia nada, e no domingo 11/10/2026 a "Semana" mostrava a semana de 12 a 18 em vez da que terminava naquele dia.
- **Correção:** novo `lib/taskPeriods.ts`, com funções puras de uma data de referência (semana de segunda a domingo, mês, ano e intervalo manual). Na página:
  - o intervalo manual vale para o quadro e é enviado à timeline;
  - um fim anterior ao início mostra aviso e não é aplicado;
  - os contadores dos botões rápidos ignoram o intervalo manual;
  - concluídas, dentro de um intervalo manual, seguem a data de conclusão, como nos outros períodos.
- **Testes:**
  - `test/taskPeriods.test.ts` (11 casos com datas fixas: domingo, segunda, virada de mês e de ano, intervalo aberto, intervalo invertido);
  - `test/TasksPagePeriods.test.tsx` (3 casos de página); os 3 falharam antes da correção.
- **Commit:** `9bdf43c` (os dois IDs juntos, porque a causa e o arquivo são os mesmos).

### AUD-017 — Empresa compartilhada sem identificação — FEITA

- **Ainda existia?** Sim. No modo Equipe, o card da empresa de outro dono mostrava "Cliente" e o filtro não oferecia essa empresa.
- **Correção:** a página junta às empresas próprias as compartilhadas que vêm nos DTOs autorizados das tarefas (`client_name`/`client_color`), sem ampliar o payload de empresas. Valem para card, calendário, timeline e filtro.
- **Testes:** `test/TasksPageTeamCompanies.test.tsx`; falhou antes da correção.
- **Commit:** `b47e900`.

### AUD-018 — Periodicidade não persistida — FEITA

- **Ainda existia?** Sim. O `saveConfig` não enviava `recurrence`.
- **Correção:** envia a periodicidade e limpa os campos das outras (`weekdays: []`, `due_day`/`due_month`/`due_days_from_start` = `null`).
- **Testes:**
  - `test/TemplateDetailRecurrence.test.tsx` (falhou antes);
  - teste de contrato no backend, `test_switching_monthly_to_weekly_persists_and_clears_the_monthly_day`, que prova que a API aceita e aplica esse payload.
- **Commit:** `f96a9ad`.

### AUD-019 — Atividade de rotina geral depois do fork — EM ANDAMENTO (backend; será registrada a seguir)

### AUD-020 — Tarefa sem título e falha sem aviso — FEITA (frontend) / backend a seguir

- **Ainda existia?** Sim. O schema Zod estava declarado mas não ligado ao formulário; um título só de espaços chegava à API; a falha só ia para o console.
- **Correção (frontend):**
  - título (sem espaços nas pontas) e empresa são validados antes da requisição, com a mesma regra do schema;
  - falha ao salvar mostra o motivo do servidor e mantém o drawer aberto com os dados.
- **Testes:** `test/TaskDrawerValidation.test.tsx` (2 casos); os 2 falharam antes.
- **Commit:** `c46e5fe`.
- **Nota técnica:** com um `beforeEach` chamando `mockClear` no mock içado, o Vitest acusava a rejeição tratada como erro do teste. Sem o `beforeEach`, os testes continuam independentes: o primeiro não chama a API.

### AUD-021 — Apagar campo opcional não remove valor — FEITA

- **Ainda existia?** Sim. O teste da página de prospectos mostrou `cnpj: undefined` (some do JSON) ao apagar o campo.
- **Correção:** empresas e prospectos enviam `null` para campo esvaziado.
- **Testes:**
  - `test/ProspectosPage.test.tsx` (caso novo, falhou antes);
  - `tests/test_clear_optional_fields.py` no backend, provando que `null` limpa o valor gravado (o backend já suportava).
- **Commit:** `10c4271`.

### AUD-022 — Envio de proposta pelo nome, ignorando o prospecto — FEITA

- **Ainda existia?** Sim. Teste com proposta vinculada a um prospecto e um cliente de mesmo nome: o envio ia para o cliente.
- **Correção:** novo `lib/proposalContact.ts`:
  - o destinatário sai do `company_id` da proposta (cliente ou prospecto, com o contato do representante como reserva);
  - o nome só é usado em proposta antiga sem vínculo, e só quando há uma única empresa com aquele nome;
  - o e-mail pede confirmação mostrando nome e endereço antes de enviar.
- **Testes:** caso novo em `test/OrcamentoDetalhadoPage.test.tsx` (falhou antes) e `test/proposalContact.test.ts`; os testes antigos ganharam o clique de confirmação.
- **Validação:** Vitest completo: 80 arquivos, todos passando.
- **Commit:** `edcda0c`.

### AUD-019 — Atividade de rotina geral depois do fork — FEITA

- **Ainda existia?** Sim. Três testes: editar e excluir pelo id mostrado na tela falhavam com 404, e um id inexistente deixava uma cópia privada criada.
- **Correção:**
  - nova coluna `template_activities.source_activity_id` (anulável, com índice, sem FK), migração `d81f3a6c2e57`;
  - a cópia (fork) grava de qual atividade original veio;
  - o serviço valida o id antes de criar qualquer cópia e mapeia o id original para a atividade copiada; para cópias antigas, usa nome + ordem só se a correspondência for única;
  - o 404 deixou de expor ids internos.
- **Testes:** 3 novos em `tests/test_general_templates.py`; os 3 falharam antes.
- **Validação:** ruff limpo; área de tarefas e rotinas + cadeia de migrações: 248 passaram.
- **Commit:** `d9cfc48`.
- **Pendente:** atualizar o `docs/lineage.md` (catálogo local ausente neste checkout).

## Situação ao parar (limite de uso atingido)

- **Feitos:** AUD-001 a 007, 010 a 022 (o 020 só no frontend), achado novo do convite de equipe, e as 3 falhas do Vitest.
- **Aguardando decisão:** AUD-008, AUD-009, AUD-024, AUD-040.
- **Pendentes:** AUD-020 (validação do título no backend), AUD-023, 025 a 039 e 041 a 044.
- **Antes de entregar:** rodar a suíte completa do backend de novo.

## Decisões do proprietário recebidas (12/10/2026)

| Item | Decisão |
| --- | --- |
| AUD-008 | Sim: quem já pagou mantém o acesso até o fim do período pago, mesmo se um aviso de atraso chegar depois. |
| AUD-009 | Só plano mensal. Haverá variações de produto (abas liberadas só em planos mais avançados), mas sempre com ciclo mensal. |
| AUD-024 / AUD-040 | Sim: Google Agenda aparece como indisponível por enquanto; cada módulo em construção ganha um texto próprio. |

### AUD-008 — Atraso tardio bloqueando período pago — FEITA (decisão do proprietário)

- **Ainda existia?** Sim, nas duas pontas:
  - um `PAYMENT_OVERDUE` que chegasse depois do pagamento confirmado da mesma cobrança reabria a tolerância;
  - um `past_due` fora da tolerância perdia o acesso mesmo com `current_period_end` no futuro.
- **Correção:**
  - `_open_grace` ignora o aviso quando o período vigente já cobre a cobrança daquele vencimento (cobrança quitada, evento fora de ordem);
  - `resolve_access`/`_best_subscription` mantêm o acesso enquanto a tolerância ou o período pago estiverem vigentes, e o `expires_at` é o maior dos dois.
- **Testes:**
  - `tests/test_entitlements.py::test_past_due_keeps_access_while_the_paid_period_runs`;
  - `tests/test_subscription_webhook.py::test_late_overdue_of_a_charge_already_paid_changes_nothing`;
  - os 2 falharam antes.
- **Teste antigo ajustado:** `test_past_due_after_the_grace_window_is_free` agora usa um período já vencido. Pela decisão do proprietário, só nesse caso o acesso cai.
- **Validação:** testes de assinaturas, acesso, webhook e write gate: 99 passaram.
- **Commit:** `1df3a60`.

### AUD-009 — Ciclo do plano diferente da duração do acesso — FEITA (decisão do proprietário)

- **Decisão:** só plano mensal. As variações serão por recursos (abas de planos mais avançados), nunca por ciclo.
- **Correção:** `PlanCreate` aceita apenas `MONTHLY`, e o schema de criação do frontend usa `z.literal('MONTHLY')`. O rótulo de outros ciclos continua na listagem, só para ler linhas antigas.
- **Testes:** `tests/test_plans_admin.py::test_only_the_monthly_cycle_is_sold` (YEARLY, WEEKLY, QUARTERLY); os 3 falharam antes.
- **Commit:** `c47e98a`.
- **Para o futuro:** os "planos mais avançados" vão exigir regra de recursos por plano no `entitlements` (hoje só existe pago/gratuito). Ainda não implementado.

### AUD-023 e AUD-024 — Google Agenda — FEITA (decisão do proprietário: indisponível por ora)

- **Ainda existia?** Sim. Sem configuração, o `/calendar/sync` devolvia 200 com todas as tarefas "mock_synced", e a tela dizia "sincronizadas". Não existe callback OAuth para guardar o token.
- **Correção:**
  - sem configuração, o sync responde 503 ("A integração com a Google Agenda ainda não está disponível.");
  - a tela mostra o botão "Google Agenda (em breve)" desabilitado, com a explicação acessível;
  - o handler que anunciava o sucesso foi removido.
- **Testes:**
  - o teste antigo `test_calendar_sync_mock_mode`, que fixava o sucesso falso, foi substituído por `test_calendar_sync_says_unavailable_when_not_configured` (falhou antes);
  - novo `test/TasksPageCalendar.test.tsx` (falhou antes).
- **Commit:** `e6699ba`.
- **Ainda aberto, como funcionalidade futura:** o callback OAuth com `state` validado.

### AUD-040 — Módulos em construção com texto próprio — FEITA (decisão do proprietário)

- **Correção:** a página em construção recebe a área (Notas Fiscais, Certificados Digitais, Gestão de equipes) e diz o que o módulo fará e como resolver hoje, com um link (rotinas, ou a ficha da empresa em Clientes).
- **Testes:** `test/UnderConstructionPanelPage.test.tsx` (3 áreas); falharam antes.
- **Commit:** `b7576c2`. O texto é uma primeira versão e pode ser ajustado pelo proprietário.

### Qualidade — router.test sob carga — FEITA

- **Evidência:** depois da troca para `React.lazy`, uma rodada completa pesada passou de 1 s carregando a página inicial no `waitFor`; isolado, o teste passava.
- **Correção:** o teste pré-carrega as páginas que verifica. Nenhum timeout foi aumentado.
- **Validação:** Vitest completo: 82 arquivos passaram.
- **Commit:** `a964388`.

### AUD-020 (backend) — Título vazio recusado pela API — FEITA

- **Correção:** `TaskCreate` e `TaskUpdate` tiram os espaços do título e respondem 422 quando ele fica vazio. A leitura não muda: tarefas antigas com título vazio continuam abrindo.
- **Teste:** `tests/test_task_write_authorization.py::test_blank_task_title_is_refused_on_create_and_update`; falhou antes.
- **Commit:** `ff14e25`. Com a parte do frontend (já registrada acima), o AUD-020 está completo.

### AUD-025 — Upload no mesmo segundo apagava a imagem nova — FEITA

- **Ainda existia?** Sim. O id no Cloudinary era pasta + segundos com `overwrite=True`: dois envios no mesmo segundo se substituíam, e a limpeza da "foto antiga" apagava a nova.
- **Correção:** o id ganha um sufixo aleatório, `overwrite=False`, e a troca de avatar/logo não apaga o arquivo que acabou de ativar.
- **Testes:** `tests/test_storage_service.py` (dois envios com o relógio parado geram ids diferentes, sem sobrescrever); falhou antes.
- **Commit:** `a04b2c7`.

### AUD-026 — Documento da galeria comum ficava no provedor — FEITA

- **Ainda existia?** Sim. Os arquivos da galeria comum sobem como `raw`, mas a exclusão chamava `destroy` sem o tipo (que assume imagem): a linha sumia e o arquivo continuava no Cloudinary. A resposta do provedor nem era conferida.
- **Correção:**
  - `delete_file` recebe o tipo do recurso e devolve se o provedor confirmou (`{"result": "ok"}`);
  - a galeria comum exclui como `raw`;
  - se o provedor não confirmar, responde 502 e mantém a linha, para tentar de novo.
- **Testes:** `tests/test_storage_service.py` (tipo `raw` repassado; falha devolve False) e `tests/modules/test_gallery.py::test_common_gallery_delete_keeps_the_row_when_the_provider_fails`; falharam antes.
- **Commit:** `f1d3eca`.

### AUD-027 — Título e descrição da galeria se perdiam — FEITA

- **Ainda existia?** Sim. A tela manda título e descrição no `FormData`; a API lia da URL (query). Todo envio gravava os dois vazios.
- **Correção:** os dois uploads (galeria pessoal e comum) leem os campos do formulário. O frontend não mudou: já mandava do jeito certo.
- **Testes:** os testes de upload de `tests/modules/test_gallery.py` passaram a enviar como a tela (campos do formulário, não query), e o da galeria comum confere também a descrição; falharam antes. O snapshot de contratos da API continua passando.
- **Commit:** `bc140a0`.

### AUD-028 e AUD-038 — Limite de upload do Nginx e config de desenvolvimento — FEITA

- **Ainda existia?** Sim, os dois.
  - O Nginx usava o padrão de 1 MB e recusava, com uma página HTML 413, arquivos que a API aceita (10 MB na galeria, 20 MB nos anexos de tarefa).
  - O compose de desenvolvimento montava o gateway com `nginx.conf.local`, que não existe no repositório.
- **Achado ao verificar:** `nginx.conf.local` está no `.gitignore` de propósito ("Config local (não versionar)"). Por isso não versionei esse arquivo: criei `infra/nginx.dev.conf` (HTTP, mesmas rotas, WebSocket do Vite) e o compose de desenvolvimento passou a usá-lo. O `nginx.conf.local` continua livre para ajuste pessoal.
- **Correção:** `client_max_body_size 25m` nas duas configs (folga para o envelope multipart).
- **Testes:** novo `tests/test_gateway_config.py` (a config do compose de dev existe; as duas configs aceitam o maior upload da API, lido das constantes do código); falharam antes. O `nginx.dev.conf` passou no `nginx -t` dentro da imagem `nginx:alpine`.
- **Commits:** `fc20ee2`, mais `e5a9772` (só formatação do teste).
- **Para o deploy (não feito):** a mudança vale quando o gateway for reconstruído.

### AUD-029 — Bounce e reclamação depois do envio eram ignorados — FEITA

- **Ainda existia?** Sim. `sent` era status final, então um bounce ou uma reclamação que chegasse depois era descartado.
- **Achado ao verificar:** o teste antigo `test_repeated_event_does_not_overwrite_sent` fixava exatamente esse comportamento. Ele foi substituído: uma reclamação só existe depois da entrega, e o bounce pode chegar depois do aceite.
- **Correção:** só `bounced` e `complained` são finais; um `delivered` atrasado ou repetido não os desfaz.
- **Testes:** `tests/modules/test_email_webhooks.py::TestWebhookIdempotency` (bounce/reclamação depois de sent; delivered atrasado não desfaz; delivered repetido mantém sent); os de bounce/reclamação falharam antes.
- **Validação:** testes de e-mail (webhook, roteador, assinatura, repositório): 42 passaram.
- **Commit:** `fbf7ecf`.

### AUD-030 — Segredo do webhook do Resend não chegava à API — FEITA

- **Ainda existia?** Sim. O webhook de e-mail recusa tudo sem `RESEND_WEBHOOK_SECRET`, e o `docker-compose.yml` não repassava a variável. Em produção, todo evento do Resend era recusado.
- **Correção:** o serviço `api` recebe a variável; o `.env.example` documenta os dois segredos de webhook (Resend e Asaas), com valores vazios.
- **Testes:** novo `tests/test_compose_webhook_secrets.py` (os dois segredos chegam à `api` e estão no `.env.example`); falhou antes.
- **Commit:** `7305ffb`.
- **Para o deploy (não feito):** o `.env` do servidor precisa ter o signing secret do webhook, copiado do painel do Resend.

### AUD-031 — Fórum limitado aos 20 primeiros tópicos — FEITA

- **Ainda existia?** Sim. A tela pedia 20 tópicos e filtrava "Meus Tópicos" e "Respondidos" só nesses 20; não havia próxima página.
- **Correção:**
  - `GET /network/posts` aceita `filter=all|mine|answered`, aplicado antes da contagem e da página (`limit` de 1 a 50);
  - a tela pede cada filtro ao servidor e mostra "Mostrando X de Y tópicos" com "Carregar mais";
  - uma resposta atrasada de outro filtro não mistura as listas.
- **Testes:** `tests/test_api_network.py` (filtros além da primeira página; filtro e página inválidos dão 422) e `test/NetworkPage.test.tsx` (filtro pedido ao servidor; carregar mais). Falharam antes. Os testes antigos de filtro passaram a simular o servidor filtrando.
- **Validação:** testes de comunidade, sinais e regressão de endpoints: 99 passaram.
- **Commit:** `ac2bce7`.

### AUD-032 — Mural de projetos só na primeira página — FEITA

- **Ainda existia?** Sim. O backend já paginava e devolvia o total; só a tela não usava.
- **Correção:** "Mostrando X de Y projetos" e "Carregar mais" (mesma busca). A busca mais recente continua valendo sobre respostas antigas.
- **Teste:** `test/ProjectsSection.test.tsx` (23 projetos, carrega os 3 restantes); falhou antes.
- **Commit:** `a3127fd`.

### AUD-033 — Aviso válido sumia da tela inicial — FEITA

- **Ainda existia?** Sim. A consulta pegava os 20 avisos mais novos e só depois descartava os vencidos e os de outro público.
- **Correção:** validade e público entram na consulta, antes do limite.
- **Teste:** `tests/test_api_platform.py::TestAnnouncements::test_old_valid_post_it_survives_many_newer_hidden_ones` (22 avisos novos invisíveis para o usuário e 1 antigo válido); falhou antes.
- **Observação do teste:** a primeira versão passava por engano, porque os avisos do teste eram recusados pela validação (mensagem curta demais). Corrigi o teste para exigir 201 em cada criação antes de confirmar a falha.
- **Commit:** `8d13278`.

### AUD-034 — "Pagamento confirmado" só pela URL — FEITA

- **Ainda existia?** Sim.
- **Correção:** no retorno `?checkout=paid`, a tela consulta `/access` antes de anunciar. Com plano ativo, confirma. Sem o webhook ainda (ou sem resposta), diz que está aguardando a confirmação do Asaas.
- **Testes:** `test/PaymentsPage.test.tsx` (retorno pago sem confirmação do servidor não confirma); falhou antes. O teste antigo agora simula o servidor já com o plano ativo.
- **Commit:** `f2d767b`.
- **Para o proprietário:** o texto de espera é uma primeira versão e pode ser ajustado.

### AUD-035 — Cabeçalho público cortava o Login no celular — FEITA

- **Ainda existia?** Sim, medido no navegador a 390 px: "Quero ser Beta" terminava em x=414 e Login em x=502 (tela de 390). A Precificação ficava escondida.
- **Achado ao verificar:** também cortava entre 561 e ~680 px (a 580 px o Login ia até x=650), faixa que o relatório não mediu.
- **Correção:** até 720 px as três ações ganham uma segunda linha só delas, e a Precificação volta a aparecer; a 360 px ou menos, espaçamentos menores.
- **Validação:** medidas no navegador a 320, 360, 390, 580 e 721 px: todas as ações dentro da tela, sem rolagem horizontal. É CSS de layout, que o jsdom não mede; a evidência são as medidas antes/depois (no commit).
- **Commit:** `07afbda`.

### AUD-036 — Foco do teclado escapava do login — FEITA

- **Ainda existia?** Sim. Havia foco inicial e Escape, mas não contenção nem devolução do foco.
- **Correção:** Tab e Shift+Tab circulam entre o primeiro e o último controle da janela, e ao fechar o foco volta ao botão que abriu. O modal "esqueci a senha" continua cuidando das próprias teclas.
- **Teste:** `test/PublicShell.test.tsx` (ida e volta nas bordas; foco devolvido ao Login); falhou antes.
- **Não verificado no navegador:** a sessão local está logada e a janela leva quem está logado direto ao painel. Não saí da sessão.
- **Commit:** `26ca0af`.

### AUD-037 — Data do café diferente entre banner, cartão e faixa — FEITA

- **Ainda existia?** Sim. O banner e o cartão da agenda calculavam "última quarta, 14h" no navegador (no fuso de quem visita, mantendo o dia mesmo depois do encontro); só a faixa de confirmação usava a data do Admin.
- **Correção:** `useNextCafe` lê `/site/public` para os três (a regra padrão só vale até a API responder) e formata dia e hora no horário de Brasília (ex.: "às 15h30").
- **Teste:** novo `test/CafeDateConsistency.test.tsx` (encontro do Admin numa quarta que não é a última, às 15h30); banner e cartão falharam antes.
- **Validação no navegador:** em /cafes, cartão e faixa mostram "quarta-feira, 28 de outubro, às 14h".
- **Commit:** `2a51043`.
- **Para o proprietário:** os títulos que descrevem a regra ("Café aberto · última quarta do mês, às 14h") e a descrição da página para o Google continuam fixos, porque são texto de produto. Se a regra mudar, eles precisam de revisão.

### AUD-039 — Login perdia o destino de uma sessão expirada — FEITA

- **Ainda existia?** Sim, nos três pontos citados.
- **Achados ao verificar:**
  - a janela de login também mandava quem já estava logado sempre para `/painel`, o que anularia o destino;
  - o aviso "Sua sessão expirou" nunca aparecia: o redirecionamento manda `session_expired=true`, e a janela lia `error`.
- **Correção:**
  - o destino completo (caminho, query e hash) vai em `return_to`, tanto pelo interceptador quanto pela rota protegida;
  - login e janela só o seguem quando é um caminho interno: recusam endereço absoluto, `//host`, `/\host`, `javascript:` e o próprio login;
  - o aviso de sessão expirada voltou a aparecer.
- **Testes:** novo `test/returnTo.test.tsx` (validação contra redirecionamento aberto; volta ao registro; destino externo cai no painel; rota protegida guarda o destino). Os de comportamento falharam com o código anterior (conferido guardando a correção à parte e rodando os testes).
- **Commit:** `2f9adef`.

### AUD-041 — Página em construção sem metadados próprios — FEITA

- **Ainda existia?** Sim.
- **Achado ao verificar:** o "Página não encontrada" (rota `*`) tinha o mesmo problema: herdava o título e o "index, follow" da página anterior.
- **Correção:** as duas definem título próprio e ficam fora do Google (`noindex`). O 404 virou uma página pequena com link para o início, mantendo o `data-testid`.
- **Teste:** novo `test/PageMetaFallbacks.test.tsx`; falhou antes.
- **Commit:** `b30e9b5`.
- **Não feito:** o `usePageMeta` não restaura os metadados ao sair de uma página. Com todas as páginas públicas definindo os seus, isso não aparece; as do painel ficam atrás do login.

### AUD-042 — Calculadora com zero pessoas ou horas quebrava a prévia — FEITA

- **Ainda existia?** Sim.
- **Correção:**
  - com zero pessoas ou horas, "Visualizar Proposta Detalhada" explica o que preencher e não sai da página;
  - a prévia trata um rascunho sem cálculo como "Nenhuma proposta encontrada", em vez de quebrar.
- **Teste:** novo `test/PricingVisualizeGuard.test.tsx`; os 2 falharam antes (sem aviso; a prévia quebrava em `pricing` nulo).
- **Commit:** `f46e4a9`.

### AUD-043 — Falha ao carregar aulas parecia conteúdo — FEITA

- **Ainda existia?** Sim.
- **Correção:**
  - estado de carregamento;
  - erro com "Tentar de novo";
  - a lista planejada só quando a API responde que a seção não tem aulas publicadas;
  - uma falha numa nova busca mantém na tela as aulas que já estavam.
- **Teste:** novo `test/LessonsPageStates.test.tsx`; carregamento e erro falharam antes.
- **Commit:** `6ae1d4d`.

### AUD-044 — Listas e Excel do Admin cortados sem aviso — FEITA

- **Ainda existia?** Sim: usuários paravam em 300, presenças em 500, e o Excel exportava só isso.
- **Correção:**
  - as duas rotas mantêm a resposta em lista (contrato da tela), aceitam `limit` (até 20000) e mandam o total no cabeçalho `X-Total-Count`, liberado no CORS;
  - as telas mostram "Mostrando X de Y" quando a lista está cortada;
  - o Excel pede todos os registros, e avisa se até esse teto for atingido.
- **Testes:**
  - `tests/test_api_platform.py::TestAdminListTotals` (total e limite em usuários e presenças; limite fora da faixa dá 422; o navegador consegue ler o cabeçalho); falharam antes;
  - `test/AdminListTotals.test.tsx` (aviso de lista cortada; o Excel pede a lista inteira); falharam antes.
- **Validação:** testes de plataforma e de contratos: 70 passaram.
- **Commit:** `56ae705`.

## Situação final do ciclo (12/10/2026)

Esta seção substitui, como retrato atual, a "Situação ao parar" mais acima, que fica preservada como histórico.

- **Itens:** os 44 apontamentos (AUD-001 a AUD-044) estão tratados, cada um com entrada própria neste registro. Os que dependiam de decisão (AUD-008, 009, 024 e 040) foram feitos depois da resposta do proprietário.
- **Validação final, rodada isolada depois do último commit (`b30e9b5`):**
  - **Backend:** ruff check e ruff format sem apontamentos (396 arquivos); pytest com 1278 testes passando, 2 pulados e 20 de integração fora da rodada padrão (`-m "not integration"`).
  - **Frontend:** lint e typecheck sem erros; Vitest com 88 arquivos e 599 testes passando.
- **Branch:** tudo está no `lab` local, sem push, sem PR, sem deploy e sem tocar em dados reais.

### O que continua pendente

- **Deploy (não feito):**
  - copiar o `/app/storage` atual do container antes do primeiro deploy com o volume `api_storage` (AUD-012);
  - colocar o signing secret do Resend no `.env` do servidor (AUD-030);
  - reconstruir o gateway, para valer o novo limite de upload (AUD-028).
- **Dados antigos:** os contratos finalizados antes do AUD-006 continuam com o texto que tinham.
- **Funcionalidades futuras:**
  - recursos por plano no `entitlements`, para os "planos mais avançados" (AUD-009);
  - callback OAuth da Google Agenda (AUD-024).
- **Textos para o proprietário revisar:**
  - páginas em construção (AUD-040);
  - aviso de pagamento aguardando confirmação (AUD-034);
  - títulos fixos da regra do café (AUD-037).
- **Ajustes menores conhecidos:**
  - o `usePageMeta` não restaura os metadados ao sair de uma página (AUD-041);
  - foco do login conferido só em teste automatizado, não no navegador (AUD-036).
- **Catálogos de documentação:** `docs/lineage.md`, `docs/tree_files`, pendências, regras de negócio e arquitetura não existem neste clone (`docs/` está no `.gitignore`). Precisam ser atualizados onde eles vivem.
