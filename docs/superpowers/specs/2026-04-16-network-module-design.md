# Design Spec: Network Module (Fórum de Discussões)

## 1. Visão Geral
O sistema "Network" servirá como um fórum da comunidade BPO. Os usuários poderão criar tópicos, trocar de ideias e receber notificações (in-app header bell) quando forem respondidos.

## 2. Arquitetura e Modelagem
A implementação persistirá em três tabelas integradas aos perfis de usuários (`users`):
* `discussion_posts`: Tópicos base.
* `discussion_comments`: Respostas aos tópicos.
* `notifications`: Avisos do sistema.

### Mudanças em Relação à Base de Dados Padrão:
* A tabela `discussion_posts` receberá a coluna `tags` (tipo `ARRAY(String)` ou `JSONB`) para suportar Categorias Flexíveis.

## 3. Decisões do Brainstorming
1. **Organização por Tags:** Os tópicos receberão tags flexíveis criadas pelos próprios usuários (ex: `#duvida`, `#vendas`), tornando a navegação de longo prazo mais simples de organizar em feeds separados.
2. **Editor de Textos (Rich Text):** Uma interface WYSIWYG de edição com formatação tradicional (listas, negrito, links), barrada a injeção ou upload logístico de **Imagens**, afim de diminuir severamente o uso de Storage na nuvem.
3. **Segurança (HTML Sanitation):** Como as requisições virão com formatação de tags HTML geradas pelo Editor, o Backend será responsável por higienizar *qualquer script nocivo (XSS)*.
4. **Governança de Exclusão (Preservação de Histórico):** A exclusão física de um Tópico (por um usuário padrão) só é validada pelo Backend se o `comments_count` for igual a `0`. Modificações/Edições são irrestritas.

## 4. Interfaces e Interface 
* **Header / Sino de Notificação:** Componente flutuante na barra superior com badge numérico.
* **Rota /forum:** Interface dividida em painéis laterais (filtros de tags conhecidas) e rolagem de artigos.
* **Componente de Editor Visuais:** Será instalado um componente lightweight de RichText sem plugins de Upload no Form do Frontend React.
