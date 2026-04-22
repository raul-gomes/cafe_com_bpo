# PRD — Armazenamento de avatar e arquivos estáticos com OneDrive

## Visão geral

Este documento descreve a implementação de uma funcionalidade de upload, persistência e consumo de avatar de usuário e arquivos estáticos usando OneDrive como repositório primário de arquivos. O objetivo é permitir uma solução de baixo custo para uma aplicação em fase inicial, utilizando a cota gratuita do OneDrive e a API Microsoft Graph, com tratamento explícito de falhas operacionais, consistência de dados e recuperação.[cite:17][cite:29][cite:35]

## Objetivo do produto

Permitir que a aplicação faça upload de uma foto de avatar e de alguns arquivos estáticos, armazene os metadados de referência necessários para posterior recuperação e exibição, e mantenha comportamento previsível em cenários de erro, indisponibilidade, revogação de acesso e inconsistência entre banco de dados e armazenamento remoto.[cite:17][cite:29]

## Escopo

### Incluído

- Upload de avatar do usuário para OneDrive.[cite:29]
- Upload de arquivos estáticos de apoio, como documentos e imagens.[cite:29]
- Persistência de metadados no banco da aplicação para rastrear arquivos enviados.[cite:29]
- Recuperação da URL utilizável pela aplicação para renderização do avatar.[cite:29]
- Rotina de atualização e substituição de avatar existente.[cite:29]
- Tratamento de falhas transientes e definitivas da API, incluindo throttling com resposta HTTP 429 e uso de `Retry-After`.[cite:35]
- Estratégias de consistência entre estado da aplicação e arquivos no OneDrive.[cite:29][cite:35]

### Excluído

- Editor de imagens, crop inteligente ou pipeline de transformação avançada.
- CDN própria, processamento de imagem em múltiplos tamanhos, ou otimização agressiva de mídia.
- Compartilhamento público generalizado de documentos para terceiros fora da aplicação.
- Migração entre múltiplos provedores de storage nesta primeira versão.

## Contexto e premissas

O OneDrive pode ser acessado pela Microsoft Graph API e suporta upload simples para arquivos pequenos e upload resumível para arquivos maiores, o que é suficiente para o caso de uso de avatar e poucos arquivos estáticos.[cite:29][cite:17] A Microsoft aplica limites dinâmicos de throttling e recomenda que clientes respeitem respostas 429 e o cabeçalho `Retry-After`, então a integração não deve assumir throughput fixo nem ausência de limitação.[cite:35] O armazenamento gratuito do OneDrive é adequado para casos leves, desde que a aplicação controle tamanho, quantidade e frequência de uploads.[cite:17]

## Personas

### Usuário final

Deseja enviar uma foto de perfil e visualizá-la imediatamente na aplicação, sem perceber complexidade técnica de armazenamento externo.

### Administrador / operador

Precisa de previsibilidade operacional, trilha de auditoria mínima e capacidade de investigar falhas de upload, substituição e leitura.

### Time de engenharia

Precisa de implementação simples, barata, com baixo acoplamento, observabilidade básica e comportamento consistente diante de falhas.

## Problema a resolver

Hoje a aplicação precisa armazenar avatar e alguns arquivos, mas o objetivo é evitar custo com storage dedicado neste momento. A solução deve usar OneDrive de forma controlada, sem tratar o armazenamento como fonte única de verdade do domínio da aplicação, reduzindo risco de inconsistência e facilitando futura troca de provedor.

## Proposta de solução

A aplicação fará upload do binário para o OneDrive e persistirá no banco relacional ou documento da aplicação um registro lógico do arquivo, incluindo identificador interno, tipo do arquivo, usuário dono, status do upload, `driveItemId` quando disponível, nome do arquivo, tamanho, hash opcional, timestamps e URL de leitura utilizada pela interface. A renderização do avatar sempre partirá do banco da aplicação; o OneDrive será o repositório físico do arquivo, enquanto a aplicação manterá a referência estável de negócio.[cite:29]

## Arquitetura funcional

### Componentes

| Componente | Responsabilidade |
|---|---|
| Front-end | Seleção do arquivo, validação básica e envio do upload |
| API da aplicação | Autenticação do usuário, autorização, orquestração do upload e persistência |
| Banco da aplicação | Fonte de verdade dos metadados e estados de processamento |
| OneDrive via Microsoft Graph | Armazenamento físico do avatar e arquivos estáticos |
| Worker assíncrono opcional | Retentativas, compensações e limpeza de inconsistências |

### Modelo lógico de dados

Tabela ou coleção sugerida: `user_files`

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | Identificador interno do registro |
| user_id | UUID / string | Dono do arquivo |
| category | enum | `avatar`, `static_document`, `static_image` |
| provider | string | `onedrive` |
| provider_item_id | string nullable | ID do item no OneDrive |
| provider_parent_path | string | Pasta lógica no OneDrive |
| original_file_name | string | Nome original enviado |
| mime_type | string | Tipo MIME |
| size_bytes | bigint | Tamanho |
| checksum | string nullable | Hash opcional |
| version | integer | Versão lógica do arquivo |
| status | enum | `pending`, `uploading`, `active`, `failed`, `deleting`, `deleted`, `orphaned` |
| read_url | text nullable | URL usada pela aplicação |
| thumbnail_url | text nullable | URL derivada, se houver |
| failure_code | string nullable | Código interno da última falha |
| failure_message | text nullable | Mensagem sanitizada |
| retry_count | integer | Quantidade de retentativas |
| created_at | datetime | Criação |
| updated_at | datetime | Atualização |
| activated_at | datetime nullable | Momento em que virou ativo |
| deleted_at | datetime nullable | Remoção lógica |

Para avatar, recomenda-se também uma referência desnormalizada em `users.avatar_file_id`, apontando para o arquivo atualmente ativo. Isso simplifica leitura da aplicação e evita busca ambígua por “último avatar”.

## Requisitos funcionais

### RF01 — Upload de avatar

O usuário autenticado deve conseguir enviar uma imagem de avatar válida para sua conta.[cite:29]

### RF02 — Tipos aceitos

A aplicação deve aceitar apenas tipos permitidos para avatar, como `image/jpeg`, `image/png` e opcionalmente `image/webp`. O tipo aceito deve ser validado no back-end independentemente da validação do front-end.

### RF03 — Limite de tamanho

A aplicação deve definir limite de tamanho de avatar na camada de negócio, por exemplo 5 MB ou 10 MB, mesmo que o OneDrive suporte arquivos muito maiores.[cite:17][cite:29]

### RF04 — Substituição de avatar

Ao enviar um novo avatar, o sistema deve marcar o novo arquivo como candidato a ativo, promover o novo registro somente após confirmação do upload e tratar o avatar anterior conforme política de retenção definida.

### RF05 — Exibição de avatar

A aplicação deve conseguir recuperar e exibir a imagem do avatar a partir da referência persistida no banco e do link utilizável obtido após o upload.[cite:29]

### RF06 — Upload de arquivos estáticos

A aplicação deve suportar upload de poucos arquivos estáticos adicionais, como documentos e imagens, seguindo regras próprias de tipo e tamanho.[cite:29]

### RF07 — Histórico mínimo

A aplicação deve manter pelo menos o registro do arquivo ativo e os registros com falha para auditoria operacional básica.

### RF08 — Remoção

A aplicação deve permitir remover avatar ou arquivo estático, com remoção lógica no banco e tentativa de exclusão física no OneDrive quando aplicável.[cite:29]

## Requisitos não funcionais

### RNF01 — Baixo custo

A solução deve funcionar dentro do plano gratuito do OneDrive enquanto o volume permanecer baixo.[cite:17]

### RNF02 — Resiliência

A solução deve tolerar falhas transientes de rede, throttling da API e indisponibilidade temporária do provedor.[cite:35]

### RNF03 — Consistência observável

Mesmo sem transação distribuída entre banco e OneDrive, o sistema deve detectar e corrigir estados inconsistentes por meio de estados internos, retentativas e rotinas de compensação.

### RNF04 — Segurança

A aplicação deve restringir acesso por usuário, validar MIME type e extensão, e evitar exposição indevida de links quando o arquivo for privado.

### RNF05 — Observabilidade

Cada operação relevante deve gerar logs estruturados com `request_id`, `user_id`, `file_id`, etapa, status e erro sanitizado.

## Fluxos principais

### Fluxo A — Primeiro upload de avatar

1. Usuário escolhe arquivo no front-end.
2. Front-end valida extensão e tamanho preliminar.
3. API valida autenticação e autorização.
4. API cria registro `pending` no banco.
5. API envia arquivo ao OneDrive usando upload simples para arquivo pequeno ou sessão de upload, se necessário.[cite:29]
6. Se o provedor confirmar sucesso, API persiste `provider_item_id`, `read_url`, `status=active` e atualiza `users.avatar_file_id`.[cite:29]
7. API retorna payload com metadados do avatar ativo.
8. Front-end atualiza a UI.

### Fluxo B — Troca de avatar

1. Usuário envia novo avatar.
2. Sistema cria novo registro com versão superior e status `uploading`.
3. Upload é concluído.
4. Novo arquivo é promovido a ativo.
5. Avatar anterior é marcado como `superseded` ou `deleted`, conforme política de retenção.
6. Exclusão física do arquivo antigo pode ocorrer de forma síncrona ou assíncrona.

### Fluxo C — Remoção de avatar

1. Usuário solicita remoção.
2. Sistema remove vínculo `users.avatar_file_id`.
3. Registro do arquivo é marcado como `deleting`.
4. API ou worker tenta exclusão física no OneDrive.[cite:29]
5. Em caso de sucesso, status vai para `deleted`; em falha, status vai para `orphaned_delete_pending`.

## Estratégia de persistência

### Fonte de verdade

O banco da aplicação é a fonte de verdade para saber qual avatar está ativo e quais arquivos pertencem a cada usuário. O OneDrive não deve ser consultado como fonte primária de estado de negócio.

### Estados de lifecycle

| Status | Significado | Visível ao usuário |
|---|---|---|
| pending | Registro criado, upload ainda não iniciado | Não |
| uploading | Upload em progresso | Opcional |
| active | Arquivo válido e utilizável | Sim |
| failed | Upload falhou | Não |
| deleting | Remoção em andamento | Não |
| deleted | Removido logicamente e fisicamente | Não |
| orphaned | Inconsistência detectada entre banco e provider | Não |

### Política de consistência

Como não existe transação única entre banco e OneDrive, a aplicação deve usar padrão de consistência eventual com compensação. O status só muda para `active` após confirmação do OneDrive e persistência local concluída. Se o upload no OneDrive der certo mas a gravação no banco falhar, a operação deve entrar em fila de reconciliação para localizar o item enviado e concluir a persistência ou excluí-lo.[cite:29][cite:35]

### Idempotência

Toda requisição de upload deve aceitar um `idempotency_key` por usuário e operação. Se o cliente repetir a mesma requisição por timeout, a API deve responder com o resultado conhecido, sem duplicar registros e sem criar múltiplos arquivos desnecessários.

## Cenários de falha

### Falhas de entrada

| Cenário | Causa provável | Resposta esperada |
|---|---|---|
| Arquivo vazio | Cliente enviou payload inválido | HTTP 400 com mensagem amigável |
| Tipo não permitido | Arquivo fora da whitelist | HTTP 415 ou 400 |
| Tamanho acima do limite | Arquivo excede regra de negócio | HTTP 413 |
| Extensão divergente do MIME | Possível arquivo malicioso | Bloquear upload e registrar evento |

### Falhas de autenticação e autorização

| Cenário | Causa provável | Resposta esperada |
|---|---|---|
| Token da aplicação inválido | Sessão expirada | HTTP 401 |
| Usuário tentando alterar avatar de outro usuário | Falha de autorização | HTTP 403 |
| Token Microsoft expirado ou revogado | Integração perdeu permissão | Marcar operação como falha recuperável ou exigir reautorização |

### Falhas do provedor OneDrive

A Microsoft Graph pode aplicar throttling e responder com 429, exigindo respeito ao cabeçalho `Retry-After`.[cite:35] Também podem ocorrer erros 5xx, falhas de rede e timeouts, todos tratados como falhas transientes com retentativa controlada.[cite:35]

| Cenário | Exemplo | Tratamento |
|---|---|---|
| HTTP 429 | Throttling | Retry com `Retry-After` e backoff exponencial.[cite:35] |
| HTTP 5xx | Erro no provider | Retry com backoff exponencial |
| Timeout | Rede lenta ou indisponibilidade | Retry com limite e observabilidade |
| Sessão de upload expirada | Upload resumível não finalizado | Reiniciar sessão de upload |
| Arquivo excluído externamente | Usuário apagou no OneDrive | Marcar registro como inconsistente e acionar reconciliação |

### Falhas de persistência local

| Cenário | Impacto | Estratégia |
|---|---|---|
| Banco indisponível antes do upload | Nada enviado | Falhar rápido |
| Banco indisponível após upload remoto bem-sucedido | Arquivo pode ficar órfão no provider | Registrar evento para reconciliação e compensação |
| Deadlock ou conflito de versão | Estado inconsistente temporário | Retry transacional curto |
| Falha ao atualizar `users.avatar_file_id` | Avatar novo existe mas não foi promovido | Reconciliar a promoção do arquivo ativo |

### Falhas de leitura e exibição

| Cenário | Causa provável | Comportamento esperado |
|---|---|---|
| URL expirada ou inválida | Link compartilhado deixou de funcionar | UI mostra avatar padrão e backend tenta regenerar link |
| Arquivo inexistente no provider | Exclusão externa | Mostrar fallback e marcar registro inconsistente |
| Permissão insuficiente para leitura | Escopo OAuth incorreto | Mostrar fallback e abrir incidente operacional |

## Estratégia de retentativas

As retentativas devem ocorrer apenas para falhas transientes, nunca para erros permanentes como tipo inválido ou permissão negada. Em respostas 429, a aplicação deve obedecer `Retry-After`; quando ausente, deve usar backoff exponencial com jitter.[cite:35]

Política sugerida:

- Tentativa 1: imediata.
- Tentativa 2: após 2 segundos.
- Tentativa 3: após 5 segundos.
- Tentativa 4: após 15 segundos.
- Tentativa 5: após 30 segundos.
- Após o limite, marcar como `failed` e disponibilizar reprocessamento manual ou assíncrono.

## Reconciliação e limpeza

Deve existir uma rotina agendada para verificar registros não finalizados ou inconsistentes.

### Casos verificados pela rotina

- Registros `uploading` com tempo excessivo.
- Registros `failed` com possibilidade de nova tentativa.
- Registros com `provider_item_id` mas sem `read_url`.
- Registros `active` cujo arquivo não existe mais no OneDrive.
- Itens no OneDrive sem correspondente no banco, quando localizáveis por pasta ou convenção de nome.

### Ações possíveis

- Reconsultar item no provider e completar metadados faltantes.[cite:29]
- Regenerar URL de leitura se a estratégia adotada exigir atualização.[cite:29]
- Remover item órfão do provider.
- Rebaixar avatar ativo para fallback se o arquivo não puder ser recuperado.

## Regras de negócio

### Avatar

- Apenas um avatar ativo por usuário.
- Novo avatar só substitui o antigo após upload confirmado e persistência local concluída.
- Em falha de substituição, o avatar anterior continua ativo.
- Se nenhum avatar estiver ativo, a UI deve usar avatar padrão.

### Arquivos estáticos

- Cada arquivo deve ter owner e categoria definidos.
- Extensões e tamanhos devem variar conforme categoria.
- Documentos podem permanecer privados, mesmo que o avatar adote política de leitura mais simples.

## Decisões técnicas recomendadas

### Organização de pastas no OneDrive

Estrutura sugerida:

- `/app-name/avatars/{userId}/current/`
- `/app-name/avatars/{userId}/history/`
- `/app-name/static/{userId}/`

Essa organização facilita reconciliação, limpeza e futura migração.

### Nome de arquivo

Usar nome controlado pela aplicação, por exemplo:

`avatar_{userId}_{timestamp}_{shortHash}.jpg`

Isso reduz colisão, facilita rastreabilidade e evita dependência do nome original do usuário.

### Estratégia de link

A solução deve evitar depender apenas de nome de arquivo. O registro local deve armazenar `provider_item_id`, e a URL usada pela UI deve ser derivada ou persistida conforme a política adotada pela aplicação.[cite:29] Se a URL deixar de funcionar, o sistema deve poder reconstruí-la a partir do identificador do item e das permissões ativas.

## Segurança e compliance

- Validar autenticação e autorização em toda operação.
- Validar MIME type real e extensão.
- Restringir tamanho por categoria.
- Sanitizar nome do arquivo exibido ao usuário.
- Não confiar em metadados enviados pelo cliente.
- Registrar eventos de segurança para uploads rejeitados por incompatibilidade de conteúdo.
- Revisar se links públicos serão permitidos para avatar ou se será usada mediação pela própria API.

## Observabilidade

### Logs

Campos mínimos:

- `request_id`
- `user_id`
- `file_id`
- `provider=onedrive`
- `operation=upload|delete|read|reconcile`
- `status_before`
- `status_after`
- `http_status_provider`
- `retry_count`
- `error_code`

### Métricas

- Taxa de sucesso de upload.
- Latência média de upload.
- Quantidade de 429 por período.[cite:35]
- Quantidade de arquivos órfãos.
- Quantidade de falhas por categoria.
- Tempo médio de reconciliação.

### Alertas

- Pico de 429 acima do normal.[cite:35]
- Crescimento de registros `orphaned`.
- Falhas de autenticação com Microsoft acima do limiar.
- Erros de leitura de avatar em produção.

## Critérios de aceite

| ID | Critério |
|---|---|
| CA01 | Usuário consegue enviar avatar válido e vê a imagem após conclusão |
| CA02 | Avatar anterior permanece ativo se o novo upload falhar |
| CA03 | Arquivos inválidos por tipo ou tamanho são rejeitados com mensagem clara |
| CA04 | Erros 429 e 5xx do provider geram retentativa controlada.[cite:35] |
| CA05 | Falha entre upload remoto e persistência local gera registro reconciliável |
| CA06 | Exclusão externa do arquivo é detectada e resulta em fallback seguro |
| CA07 | Remoção de avatar apaga vínculo do usuário e evita imagem quebrada |
| CA08 | Logs permitem rastrear ciclo completo da operação |

## Casos de teste

### Funcionais

- Upload do primeiro avatar.
- Troca de avatar com sucesso.
- Remoção de avatar.
- Upload de documento estático permitido.
- Upload de tipo não permitido.
- Upload acima do tamanho aceito.

### Resiliência

- Timeout na chamada de upload.
- Resposta 429 com `Retry-After`.[cite:35]
- Resposta 500 do provider.
- Banco indisponível após sucesso no provider.
- Duplicidade por reenvio do cliente com mesma `idempotency_key`.
- Arquivo deletado manualmente no OneDrive após estar ativo.

### Persistência

- Registro criado como `pending` antes do envio.
- Promoção correta para `active` após confirmação.
- Manutenção do avatar anterior em falha de substituição.
- Reconciliação de item órfão.
- Exclusão lógica com limpeza física posterior.

## Rollout sugerido

### Fase 1

- Upload de avatar.
- Persistência local de metadados.
- Exibição do avatar.
- Fallback padrão.
- Logs básicos.

### Fase 2

- Upload de arquivos estáticos adicionais.
- Worker de reconciliação.
- Remoção física assíncrona.
- Métricas e alertas.

### Fase 3

- Política de versionamento mais robusta.
- Migração futura para storage dedicado, se necessário.
- Abstração de provider com interface comum.

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Mudança na política de compartilhamento do OneDrive | Médio | Abstrair provider e não acoplar UI ao link cru |
| Throttling inesperado | Médio | Backoff, `Retry-After`, baixo volume e fila assíncrona.[cite:35] |
| Exclusão manual de arquivos fora da aplicação | Médio | Reconciliação periódica |
| Cota gratuita insuficiente | Médio | Monitorar consumo e preparar migração |
| Dependência de OAuth da Microsoft | Médio | Renovação de token e tratamento de revogação |

## Recomendação final

Para o cenário descrito, OneDrive é uma opção viável como storage inicial para avatar e poucos arquivos estáticos, desde que a aplicação trate o banco como fonte de verdade, implemente estados explícitos de lifecycle, respeite throttling da Microsoft Graph e tenha rotina de reconciliação para inconsistências.[cite:17][cite:29][cite:35]
