# HISTÓRICO — linha do tempo dos commits

Append-only. Hashes da branch `lab` no momento da escrita. O histórico
completo, incluindo o trabalho anterior ao ciclo de auditoria, está em
`git log`. O trabalho "lab:" de visual, captação e admin começa antes de
`f2b38f9` e anteriores (ver a seção final deste arquivo).

## Ciclo de auditoria UX, lógica e funcionalidades (2026-10-12)

Cada linha: data · hash · item(s) · o que mudou · testes.

- 2026-10-12 · `5196b13` · AUD-001 · vínculos de rotina só pelo dono da empresa ou equipe · teste de isolamento
- 2026-10-12 · `2f3d554` · AUD-002 · SLAs lidos e alterados só pelo dono · teste de isolamento
- 2026-10-12 · `6519cf1` · AUD-003 · tarefa de rotina não muda de empresa (409) · teste de autorização
- 2026-10-12 · `7424b94` · AUD-004 · ações em lote só nos cards visíveis na coluna · teste de escopo
- 2026-10-12 · `71d7a03` · (perf) · páginas nomeadas carregadas sob demanda · testes de rota
- 2026-10-12 · `242bc61` · (test) · `npm ci` em dry-run pelo `npm.cmd` no Windows · teste de dependências
- 2026-10-12 · `f7b919e` · AUD-005 · finalizar contrato salva as edições da tela antes · teste de fluxo
- 2026-10-12 · `78d82ce` · AUD-006 · contrato finalizado mantém o texto congelado · teste de contrato
- 2026-10-12 · `9f067dc` · AUD-007 · edição de tarefa envia só os campos alterados · teste de drawer
- 2026-10-12 · `cb51077` · AUD-010 · texto do remetente escapado no e-mail de proposta · teste de escape
- 2026-10-12 · `8065093` · (achado novo) · nomes escapados no e-mail de convite da equipe · teste de convite
- 2026-10-12 · `184c4c8` · AUD-011 · cookie de refresh com `Secure` fora de dev e teste · teste de cookie
- 2026-10-12 · `e1d08c0` · AUD-012 · armazenamento da API em volume nomeado · teste de compose
- 2026-10-12 · `6c09b28` · AUD-013 · scheduler continua gerando rotinas gerais de outros usuários · teste de scheduler
- 2026-10-12 · `b6c34d2` · AUD-014 · CNPJ digitável no campo de CPF/CNPJ de cobrança · teste de máscara
- 2026-10-12 · `9bdf43c` · AUD-015, AUD-016 · filtros de período seguem as datas escolhidas e semanas de segunda · testes de período
- 2026-10-12 · `b47e900` · AUD-017 · empresas compartilhadas mantêm nome, cor e filtro no modo equipe · teste de equipe
- 2026-10-12 · `f96a9ad` · AUD-018 · ficha de rotina salva a recorrência escolhida · teste de recorrência
- 2026-10-12 · `d9cfc48` · AUD-019 · editar atividade de rotina geral vira cópia do usuário · 3 testes de template
- 2026-10-12 · `c46e5fe` · AUD-020 (front) · drawer valida o título e explica erro de salvamento · teste de validação
- 2026-10-12 · `ff14e25` · AUD-020 (back) · API recusa título em branco (422) · teste de escrita
- 2026-10-12 · `10c4271` · AUD-021 · campo opcional esvaziado remove o valor salvo · teste de empresa
- 2026-10-12 · `edcda0c` · AUD-022 · proposta vai para a empresa vinculada, com confirmação · teste de destinatário
- 2026-10-12 · `1df3a60` · AUD-008 · aviso de atraso tardio não tira período pago · 2 testes de entitlements/webhook
- 2026-10-12 · `c47e98a` · AUD-009 · catálogo vende só o ciclo mensal · teste de planos
- 2026-10-12 · `e6699ba` · AUD-023, AUD-024 · Google Agenda indisponível, sem sincronização falsa · teste de calendário
- 2026-10-12 · `b7576c2` · AUD-040 · páginas em construção com texto próprio por área · 3 testes
- 2026-10-12 · `a964388` · (qualidade) · rota de teste pré-carrega páginas lazy · sem mudança de timeout
- 2026-10-12 · `a04b2c7` · AUD-025 · envios com id único no Cloudinary, sem sobrescrever · teste de storage
- 2026-10-12 · `f1d3eca` · AUD-026 · galeria comum apaga arquivo como raw e mantém a linha se o provedor falhar · testes de galeria
- 2026-10-12 · `bc140a0` · AUD-027 · galeria lê título e descrição do formulário · testes de upload
- 2026-10-12 · `fc20ee2` · AUD-028, AUD-038 · Nginx aceita 25 MB; config de dev versionada (`nginx.dev.conf`) · teste de gateway
- 2026-10-12 · `fbf7ecf` · AUD-029 · bounce e reclamação depois de "enviado" são aplicados · testes de webhook
- 2026-10-12 · `e5a9772` · (estilo) · formatação do teste de gateway · —
- 2026-10-12 · `7305ffb` · AUD-030 · segredo do webhook do Resend chega à API; `.env.example` documenta · teste de compose
- 2026-10-12 · `ac2bce7` · AUD-031 · fórum filtra no servidor e pagina · testes de rede e front
- 2026-10-12 · `a3127fd` · AUD-032 · mural de projetos com "Carregar mais" · teste de projetos
- 2026-10-12 · `8d13278` · AUD-033 · avisos filtram validade e público antes do limite · teste de plataforma
- 2026-10-12 · `f2d767b` · AUD-034 · "pagamento confirmado" só depois do servidor · teste de pagamentos
- 2026-10-12 · `07afbda` · AUD-035 · cabeçalho público no celular mantém Login · medido em 5 larguras
- 2026-10-12 · `26ca0af` · AUD-036 · foco preso no login e devolvido ao fechar · teste de shell público
- 2026-10-12 · `2a51043` · AUD-037 · data do café única em banner, cartão e faixa · teste de consistência
- 2026-10-12 · `f46e4a9` · AUD-042 · calculadora não abre prévia sem cálculo · 2 testes
- 2026-10-12 · `6ae1d4d` · AUD-043 · aulas com estados de carregamento e erro · 2 testes
- 2026-10-12 · `56ae705` · AUD-044 · listas admin com total (`X-Total-Count`) e Excel completo · testes de backend e front
- 2026-10-12 · `2f9adef` · AUD-039 · volta ao destino original após login · teste de retorno
- 2026-10-12 · `b30e9b5` · AUD-041 · metadados próprios em "em construção" e "não encontrada" · teste de meta

## Pontos de controle (validação da suíte completa)

- 2026-10-12 · após `ff14e25`: backend 1245 passaram (rodada isolada antes do AUD-019 e seguintes).
- 2026-10-12 · após `b30e9b5`: backend 1278 passaram, 2 pulados; frontend 599 testes em 88 arquivos. Ver `STATUS.md`.

## Como ler o histórico anterior

Os commits "lab:" de visual, captação, admin e seed vão de `f2b38f9` para trás
(incluindo `98c12b2` e `3ffc3ab`). Para ver um deles: `git show <hash> --stat`.
