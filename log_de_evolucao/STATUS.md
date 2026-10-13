# STATUS — estado atual (escrito em 2026-10-13)

## Onde estamos

- **Repositório:** `C:\Projetos\cafe_com_bpo` (remoto `raul-gomes/cafe_com_bpo`).
- **Branch de trabalho:** `lab` (local, não enviada ao GitHub).
- **Último commit no momento deste registro:** `b30e9b5` —
  `fix(seo): own tags for the under-construction and not-found pages (AUD-041)`.
- **Ciclo de auditoria (AUD-001 a AUD-044):** concluído. Todos os 44 itens
  têm correção, teste e entrada no registro. Detalhes em `HISTORICO.md`.
- **Próximo passo:** aguardar do proprietário a lista de ideias e sugestões de
  admin para discussão. Não iniciar nada grande sem essa conversa.

## Validação do último ponto de controle (`b30e9b5`)

| Área | Resultado |
|---|---|
| Backend — ruff check / ruff format | sem apontamentos (396 arquivos) |
| Backend — pytest completo, isolado | 1278 passaram, 2 pulados, 20 de integração fora da rodada padrão |
| Frontend — lint e typecheck | sem erros |
| Frontend — Vitest completo | 88 arquivos, 599 testes passaram |

Como rodar (com o container `cafe-lab-test` da máquina do proprietário):
rodar a suíte de backend **sozinha**; rodar duas suítes ao mesmo tempo no mesmo
`/work` gerou falsos erros antes.

## Pendências

### Deploy (não feito, depende do proprietário)
- Antes do primeiro deploy com o volume `api_storage`: copiar o `/app/storage`
  atual do container (AUD-012).
- Colocar `RESEND_WEBHOOK_SECRET` no `.env` do servidor, com o signing secret do
  painel do Resend (AUD-030).
- Reconstruir o gateway para valer `client_max_body_size 25m` (AUD-028).

### Dados e comportamento antigo
- Contratos finalizados antes da correção AUD-006 mantêm o texto que tinham.

### Funcionalidades futuras (decisões já tomadas, falta implementar)
- Recursos por plano no `entitlements` (abas de planos mais avançados) — AUD-009.
- Callback OAuth da Google Agenda, com `state` validado — AUD-024.

### Textos para o proprietário revisar
- Textos das páginas em construção (AUD-040).
- Mensagem "aguardando confirmação do pagamento" (AUD-034).
- Títulos fixos da regra do café ("última quarta, às 14h") (AUD-037).

### Ajustes menores conhecidos
- `usePageMeta` não restaura os metadados ao sair de uma página (AUD-041). Hoje
  não aparece porque toda página pública define os seus.
- Foco do login (AUD-036) foi verificado por teste automático, não no navegador
  com sessão limpa.

### Documentação local (ignorada pelo git, não versionada)
- `docs/` está no `.gitignore`. Existe localmente só `docs/pendencias.md`.
  Os catálogos `lineage.md`, `tree_files.md`, `regras_negocio.md` e
  `architecture.md` não estão neste clone. Este ciclo **não** atualizou
  `docs/pendencias.md` nem os demais catálogos: ficou para o proprietário.

## Arquivos não rastreados que NÃO são deste ciclo

Na data deste registro havia dois arquivos sem commit, criados depois da última
sessão de correções (00:19 de 13/10), possivelmente de outra ferramenta:

- `apps/backend/tests/test_capture.py`
- `apps/frontend/test/CaptureNavigation.test.ts`

**Não apague, não mova e não commite sem perguntar ao proprietário.** Eles não
estão no histórico e não foram revisados por este registro.

## Pontos de atenção

- Credenciais de teste: a conta local de administrador tem senha gerada que
  fica fora do repositório. Ela não deve aparecer em commits, logs, este diretório
  nem em outros serviços.
- Sessão local do navegador: o aplicativo local pode estar logado. Não sair da
  sessão nem trocar credenciais sem pedido.
