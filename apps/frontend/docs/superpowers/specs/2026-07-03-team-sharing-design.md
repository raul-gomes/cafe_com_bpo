# Team Sharing — Compartilhamento de Clientes com Colaboradores

**Data:** 2026-07-03
**Status:** Draft

## Resumo

Permite que o gestor de um cliente convide colaboradores por email para acessar
as rotinas daquele cliente. O colaborador confirma o convite via link. No Kanban,
cards compartilhados exibem quem moveu, e a movimentação entre fases só é
permitida se a fase de destino existir para o gestor (dono do cliente).

## 1. Modelo de Dados

### `client_invitations`

| Coluna       | Tipo                        | Descrição                              |
|-------------|-----------------------------|----------------------------------------|
| id          | UUID PK                     |                                        |
| client_id   | UUID FK → clients.id (CASCADE) | Cliente alvo                        |
| invited_by  | UUID FK → users.id          | Gestor que convidou                    |
| invited_email | VARCHAR(255)              | Email do colaborador                   |
| token       | VARCHAR(255) UNIQUE         | Link de confirmação único              |
| status      | VARCHAR(20)                 | `pending` / `accepted` / `expired`     |
| expires_at  | TIMESTAMP                   | Token válido por 7 dias                |
| accepted_at | TIMESTAMP NULL              | Quando aceitou                         |
| created_at  | TIMESTAMP                   |                                        |

### `client_invitation_routines`

| Coluna        | Tipo                                    | Descrição               |
|--------------|-----------------------------------------|-------------------------|
| invitation_id | UUID FK → client_invitations.id (CASCADE) |                        |
| template_id   | UUID FK → activity_templates.id (CASCADE) | Rotina liberada        |

PK composta: `(invitation_id, template_id)`.

### `client_team_members`

| Coluna     | Tipo                           | Descrição             |
|-----------|--------------------------------|-----------------------|
| id        | UUID PK                        |                       |
| client_id | UUID FK → clients.id (CASCADE) |                       |
| user_id   | UUID FK → users.id (CASCADE)   | Colaborador           |
| invited_by | UUID FK → users.id            | Gestor que convidou   |
| joined_at | TIMESTAMP                      |                       |

UK: `(client_id, user_id)` — cada par é único.

## 2. Regras de Negócio

### Convite
- Qualquer usuário pode convitar para clientes que **ele próprio criou** (`client.user_id == current_user.id`)
- O email é validado (formato) mas não precisa existir no sistema
- Token expira em 7 dias
- Um email só pode ter 1 convite pendente por cliente

### Aceite
- **Já logado**: link aceita na hora → vira `client_team_member`
- **Não logado**: link redireciona para `/cadastro?invite_token=xxx` → após cadastro, aceita automaticamente
- **Já tem conta mas não está logado**: link redireciona para `/login?invite_token=xxx` → após login, aceita automaticamente

### Kanban — Compartilhamento
- A tasks de um cliente são visíveis para todos os membros do time
- `GET /tasks/?client_id=xxx` retorna tasks de **todos os membros** para aquele cliente
- Cada task no frontend exibe badge `"Movido por: [nome]"` com base em `updated_by` (novo campo opcional)
- O backend adiciona o campo `moved_by_name` na resposta da task

### Kanban — Movimentação (Fases)
- Quando qualquer membro move um card:
  1. Backend verifica se a `phase_id` de destino existe nas fases do **gestor** (`client.user_id`)
  2. Se **não existir** → HTTP 422 com `{ error: "fase_inexistente", message: "Fase 'X' não existe para o gestor deste cliente" }`
  3. Se **existir** → `phase_id` é atualizado na task
- Task tem campo novo `moved_by` (UUID FK → users.id, nullable) setado com `current_user.id` sempre que `phase_id` muda

## 3. APIs

### Módulo `team` (novo módulo ou integrado em clients)

#### `POST /api/clients/{client_id}/invite`
- Body: `{ email: str, template_ids: list[UUID] }`
- Cria `client_invitation` + `client_invitation_routines`
- Dispara email com link de aceite
- Retorna `201 { invitation_id, status: "pending" }`

#### `GET /api/invitations/accept`
- Query: `token: str`
- Se usuário logado → aceita, cria `client_team_member`, retorna `{ status: "accepted", client_name }`
- Se não logado → redireciona (`307`) para `/cadastro?invite_token=xxx` ou `/login?invite_token=xxx`
- Se token inválido/expirado → `404`

#### `GET /api/clients/{client_id}/team`
- Retorna membros do time com nome, email, joined_at e rotinas liberadas
- `200 { members: [{ user_id, name, email, joined_at, routines: [...] }] }`

#### `DELETE /api/clients/{client_id}/team/{user_id}`
- Gestor remove colaborador do time
- Tasks do colaborador para este cliente **permanecem** (não são deletadas)
- `204`

#### `GET /api/clients/{client_id}/team/routines`
- Retorna as rotinas que um membro do time tem acesso
- `200 { routines: [{ template_id, name }] }`

### Modificações no módulo `tasks`

#### `PUT /api/tasks/{task_id}` — modificado
- **Nova validação**: se task tem `client_id` e cliente tem `client_team_members`:
  - Verificar se `phase_id` (se presente no body) existe nas `TaskPhase` do gestor (`client.user_id`)
  - Se não existir → HTTP 422 com código `fase_inexistente`
  - Se `phase_id` mudou → setar `task.moved_by = current_user.id`

#### `GET /api/tasks/` — modificado
- Se `client_id` passado como query param e `current_user` é membro do time:
  - Retorna tasks de todos os membros para aquele cliente
  - Cada task inclui `moved_by_name` (nome do último usuário que moveu)

### Modificações no modelo `Task`
- Novo campo: `moved_by` UUID FK → users.id (nullable)
- Novo campo: `moved_by_name` (propriedade read-only, resolve do relacionamento)

## 4. Frontend

### EmpresasPage — Seção Equipe

No card de cada cliente, **ao lado de "Vincular Rotinas"**:

```
[👥 Equipe]  → abre Dialog
```

**Dialog "Equipe do Cliente":**
- Lista de membros atuais (nome, email, data de entrada, badge "Gestor" se for o dono)
- Cada membro não-gestor tem botão "Remover" (com confirmação)
- Botão "[+] Convidar Colaborador" no topo

**Dialog "Convidar Colaborador":**
- Input: email do colaborador
- Select múltiplo: rotinas vinculadas ao cliente (checkboxes)
- Botão "Enviar Convite"
- Validação: email obrigatório, pelo menos 1 rotina selecionada

### TasksPage — Kanban Compartilhado

**Filtro "Time"** no topo do Kanban (perto dos filtros de período):
- Alternância: "Mostrar cards da equipe" (toggle ou checkbox)
- Quando ativo, chama `GET /tasks/?client_id=xxx` (para cada cliente visível)

**Card badge** — quando card foi movido por outro membro:
- Badge sutil no card: `"→ [Nome]"` no canto inferior
- Se `current_user.id === task.user_id`, não mostra badge

**Trava de movimentação** — ao arrastar card para coluna:
- Frontend chama `PUT /tasks/{id} { phase_id: nova_fase }`
- Se backend retorna 422 com `fase_inexistente`:
  - Toast de erro: "Fase 'X' não existe para o gestor deste cliente"
  - Card retorna à posição original (desfaz o drag)

## 5. Fluxo de Email

### Template do email de convite

```
Assunto: Convite para equipe — [Cliente]

Olá!

O [Nome do Gestor] convidou você para fazer parte da equipe de [Nome do Cliente]
na plataforma Café com BPO.

Clique no link abaixo para aceitar o convite:

[Aceitar Convite]

Se você não conhece o remetente, ignore este email.

Atenciosamente,
Equipe Café com BPO
```

- **Já tem conta**: link → `/invitations/accept?token=xxx`
- **Não tem conta**: link → `/cadastro?invite_token=xxx`

## 6. Segurança e Validações

- Apenas `client.user_id` (gestor) pode convidar e remover
- Apenas o gestor vê o botão "Convidar" e "Remover" na UI
- Colaborador não pode remover outros membros
- Token de convite é UUIDv4 + hash na DB (armazenamos hash do token, não o token raw)
- Expiração de 7 dias corridos

## 7. Tasks (novo campo)

```python
# Adicionar ao model Task
moved_by = Column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
)
mover = relationship("User", foreign_keys=[moved_by])

@property
def moved_by_name(self) -> Optional[str]:
    return self.mover.name if self.mover else None
```

## 8. Estrutura de Módulo

Novo módulo `apps/backend/src/modules/team/`:
- `models.py` — ClientInvitation, ClientInvitationRoutine, ClientTeamMember
- `schemas.py` — InviteCreate, InviteResponse, TeamMemberResponse, AcceptResponse
- `repository.py` — TeamRepository
- `service.py` — TeamService (inclui envio de email)
- `router.py` — endpoints de convite, aceite, listagem, remoção

## 9. Pendências / Observações

- Tasks existentes do colaborador permanecem após remoção do time
- O campo `moved_by` é atualizado apenas quando `phase_id` muda
- A validação de fase do gestor acontece **sempre**, mesmo se quem move é o próprio gestor (consistência)
