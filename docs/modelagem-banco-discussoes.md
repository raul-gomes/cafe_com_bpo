# Modelagem de Banco — Módulo de Discussões

## Visão geral

A modelagem abaixo foi pensada para um mural de discussões simples: posts, comentários lineares e notificações in-app. O modelo favorece leitura rápida, paginação, busca simples e evolução incremental para moderação e reações futuras.[cite:64][cite:67]

## Entidades principais

### users

Tabela já existente na aplicação. O módulo precisa apenas referenciar `user_id` como chave estrangeira lógica ou física, conforme o banco atual.

Campos mínimos relevantes para integração:

- `id`
- `name`
- `email`
- `avatar_url`
- `status`

### discussion_posts

Armazena as publicações principais.

| Campo | Tipo sugerido | Descrição |
|---|---|---|
| id | UUID | Identificador da publicação |
| author_id | UUID | Usuário autor |
| title | varchar(180) | Título da publicação |
| message | text | Corpo da publicação |
| status | varchar(30) | `published`, `hidden`, `deleted` |
| comments_count | integer | Contador de comentários visíveis |
| views_count | integer | Contador opcional de visualizações |
| last_activity_at | timestamp | Última interação relevante |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Data de atualização |
| deleted_at | timestamp nullable | Exclusão lógica |

### discussion_comments

Armazena os comentários de cada publicação.[cite:64]

| Campo | Tipo sugerido | Descrição |
|---|---|---|
| id | UUID | Identificador do comentário |
| post_id | UUID | Publicação relacionada |
| author_id | UUID | Autor do comentário |
| message | text | Texto do comentário |
| status | varchar(30) | `published`, `hidden`, `deleted` |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Data de atualização |
| deleted_at | timestamp nullable | Exclusão lógica |

### notifications

Armazena notificações in-app simples.[cite:63][cite:66]

| Campo | Tipo sugerido | Descrição |
|---|---|---|
| id | UUID | Identificador da notificação |
| user_id | UUID | Usuário que receberá a notificação |
| type | varchar(50) | `post_commented` |
| post_id | UUID | Publicação relacionada |
| comment_id | UUID | Comentário que gerou o evento |
| triggered_by_user_id | UUID | Usuário que executou a ação |
| is_read | boolean | Indicador de leitura |
| read_at | timestamp nullable | Data de leitura |
| created_at | timestamp | Data de criação |

## Relacionamentos

- `discussion_posts.author_id -> users.id`
- `discussion_comments.post_id -> discussion_posts.id`
- `discussion_comments.author_id -> users.id`
- `notifications.user_id -> users.id`
- `notifications.post_id -> discussion_posts.id`
- `notifications.comment_id -> discussion_comments.id`
- `notifications.triggered_by_user_id -> users.id`

## Índices recomendados

### discussion_posts

- `idx_discussion_posts_author_id`
- `idx_discussion_posts_status`
- `idx_discussion_posts_created_at`
- `idx_discussion_posts_last_activity_at`
- índice textual em `title` e `message`, conforme o banco.[cite:68]

### discussion_comments

- `idx_discussion_comments_post_id`
- `idx_discussion_comments_author_id`
- `idx_discussion_comments_status`
- `idx_discussion_comments_created_at`

### notifications

- `idx_notifications_user_id`
- `idx_notifications_is_read`
- `idx_notifications_created_at`
- índice composto `user_id + is_read + created_at`

## Regras de consistência

- Ao criar comentário publicado, incrementar `comments_count` no post.
- Ao ocultar ou excluir comentário publicado, decrementar `comments_count` de forma controlada.
- Ao criar comentário, atualizar `last_activity_at` do post.
- Ao remover logicamente o post, remover da listagem pública sem apagar fisicamente registros.

## SQL de referência

```sql
create table discussion_posts (
  id uuid primary key,
  author_id uuid not null,
  title varchar(180) not null,
  message text not null,
  status varchar(30) not null default 'published',
  comments_count integer not null default 0,
  views_count integer not null default 0,
  last_activity_at timestamp not null default current_timestamp,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  deleted_at timestamp null
);

create table discussion_comments (
  id uuid primary key,
  post_id uuid not null,
  author_id uuid not null,
  message text not null,
  status varchar(30) not null default 'published',
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp,
  deleted_at timestamp null
);

create table notifications (
  id uuid primary key,
  user_id uuid not null,
  type varchar(50) not null,
  post_id uuid not null,
  comment_id uuid not null,
  triggered_by_user_id uuid not null,
  is_read boolean not null default false,
  read_at timestamp null,
  created_at timestamp not null default current_timestamp
);
```

## Variante para MongoDB

Se o backend usar MongoDB, a recomendação continua sendo separar `posts`, `comments` e `notifications` em coleções distintas, em vez de embutir todos os comentários no documento do post, porque isso facilita paginação, moderação, atualização concorrente e crescimento gradual do volume.[cite:67][cite:47]
