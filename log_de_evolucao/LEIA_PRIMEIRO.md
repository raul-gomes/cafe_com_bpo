# LEIA PRIMEIRO — Log de evolução do Café com BPO

Esta pasta é o registro compartilhado do que foi construído. Qualquer ferramenta
(Claude Code, Codex, Cursor, Copilot, outra IA ou um humano) que for trabalhar
neste projeto deve ler este arquivo antes de mexer em código.

## Ordem de leitura

1. Este arquivo (regras de uso do log).
2. `STATUS.md` — estado atual: branch, último commit, o que está pronto, o que falta.
3. `DECISOES.md` — decisões do proprietário e regras de negócio que NÃO podem ser
   alteradas sem confirmação.
4. `HISTORICO.md` — linha do tempo dos commits, com o item que cada um fechou.
5. `auditoria/REGISTRO_DE_CORRECOES.md` — registro detalhado de cada correção
   (achado, evidência, teste que falhou antes, commit). É cópia de um ponto no
   tempo; a versão viva fica na pasta de auditoria do proprietário.
6. `../AGENTS.md` — regras técnicas do projeto (TDD, camadas, idioma, segurança).

## Regras para quem for codar

- **Trabalhe na branch `lab`** (local, nunca enviada ao GitHub). Não faça push,
  não abra PR, não faça deploy sem pedido explícito do proprietário.
- **Antes de começar:** rode `git log --oneline -15` e `git status`. Se houver
  arquivos não rastreados ou alterações que você não fez, não apague nem
  sobrescreva: pergunte ao proprietário de quem são.
- **Não invente decisões de produto.** Regra de negócio, preço, prazo ou texto
  voltado ao cliente: pergunte antes (ver `DECISOES.md`).
- **Ao terminar um trabalho, registre-o aqui** (ver "Como registrar").
- **Nunca grave segredo no log:** senhas, tokens, chaves de API, `.env`, código
  de webhook. Se precisar citar uma credencial, diga só que ela existe e onde
  está guardada, sem o valor.
- **Não inclua `desktop.ini` em commits.**
- **Não descarte alterações existentes** sem antes verificar o que são.

## Como registrar uma entrada nova

1. Acrescente ao fim de `HISTORICO.md` uma linha no formato:
   `- AAAA-MM-DD · <hash curto> · <item/tema> · <o que mudou em uma frase> · <testes>`
2. Atualize `STATUS.md`: último commit, o que saiu de "pendente" e o que entrou.
3. Se tomou uma decisão de produto ou mudou uma regra, registre em `DECISOES.md`
   com data, quem decidiu e o motivo.
4. Não reescreva entradas antigas: o log é append-only. Para corrigir, acrescente
   uma nota nova dizendo o que mudou.

## Atenção aos hashes

Os hashes deste log são os da branch `lab` no momento da escrita. Se a branch for
reescrita (rebase, amend), os hashes mudam e a lista de commits precisa ser
conferida com `git log --oneline`. Os títulos dos commits seguem o padrão
convencional e são a referência estável.
