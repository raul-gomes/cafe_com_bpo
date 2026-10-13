# DECISÕES — decisões do proprietário e regras de negócio

Registro append-only. Cada decisão tem data, quem decidiu (o proprietário,
Ghuto César, salvo indicação) e o motivo. Quem for codar **não pode contrariar**
estas decisões sem perguntar antes.

## Decisões de produto (recebidas em 2026-10-12)

| Item | Pergunta feita | Decisão | Consequência no código |
|---|---|---|---|
| AUD-008 | Quem já pagou mantém o acesso se um aviso de atraso chegar depois? | **Sim.** | Aviso de atraso de uma cobrança já quitada não altera nada. Acesso mantido enquanto a tolerância ou o período pago estiverem vigentes. |
| AUD-009 | O produto vende só o plano mensal? | **Sim, mensal.** As variações serão por **recursos** (abas de planos mais avançados), nunca por ciclo. | Criação de plano aceita só `MONTHLY`. Recursos por plano ainda não implementados. |
| AUD-024 / AUD-040 | Mostrar a Google Agenda como indisponível por ora e escrever texto próprio para cada módulo em construção? | **Sim.** | Sincronização responde 503 sem configuração; tela mostra "Google Agenda (em breve)". Cada módulo em construção tem texto próprio. |

## Regras de negócio atuais (não violar)

- **Ordem de acesso:** ADMIN → BETA → COURTESY → ACTIVE → PAST_DUE → FREE.
  Escrita é bloqueada conforme o estado; alteração desta ordem precisa de
  confirmação.
- **Cortesia:** acesso completo sem cobrança, por período. Conceder de novo
  substitui a cortesia em andamento.
- **Encontro do café aberto:** última quarta-feira do mês, 14h, horário de
  Brasília. O encontro cadastrado no Admin prevalece sobre a regra padrão.
  Depois do fim do encontro, o próximo passa a ser o exibido.
- **Rotinas gerais:** a edição de uma atividade de rotina geral vira cópia do
  usuário, sem alterar a rotina original (AUD-019).
- **Tarefa de rotina não muda de empresa** (AUD-003). Mudança de empresa para
  rotina é recusada com 409.
- **Contrato finalizado:** o texto fica congelado no momento da finalização
  (AUD-006).
- **Acesso a vínculos de rotina e SLAs:** só o dono da empresa ou um membro
  ativo da equipe; quem cria o vínculo pode alterá-lo (AUD-001 e AUD-002).

## Como registrar uma nova decisão

Acrescente ao fim, com data e o motivo:

    ### AAAA-MM-DD — <assunto>
    - Pergunta: ...
    - Decisão: ...
    - Quem decidiu: ...
    - Consequência no código: ...
