# Convite em Lote com Chip Input

**Date:** 2026-07-13
**Status:** Approved

## Summary

Melhorar o diálogo de convite de equipe (`EmpresasPage` → "Equipe" → "Convidar Colaborador") para:
1. Aceitar **múltiplos emails** separados por vírgula ou Enter, com UI de chips estilo Gmail
2. **Detectar automaticamente** se o email pertence a um usuário existente e mostrar avatar + nome
3. **Filtrar rotinas** para exibir apenas as que estão vinculadas ao cliente (não todas)

## Changes

### Backend

#### 1. `POST /users/lookup` (novo, auth/router.py)
Busca em lote por emails existentes:
```json
POST /users/lookup
Authorization: Bearer ...
{ "emails": ["joao@email.com", "maria@teste.com"] }

Response 200:
{
  "found": [
    { "email": "joao@email.com", "name": "João Silva", "avatar_url": "https://..." }
  ],
  "not_found": ["maria@teste.com"]
}
```

#### 2. `InviteCreate` schema (team/schemas.py)
```python
# Antes
class InviteCreate(BaseModel):
    email: str
    template_ids: list[UUID]

# Depois
class InviteCreate(BaseModel):
    emails: list[str]
    template_ids: list[UUID]
```

#### 3. `TeamService.invite_collaborator` (team/service.py)
Itera sobre `data.emails`, aplicando a mesma validação + criação + email para cada um.
Se algum email falhar (já convidado, já membro), pula com erro logado mas continua os demais.

### Frontend

#### 4. `EmailChipInput` (novo, components/ui/EmailChipInput.tsx)
- Input de texto livre que escuta `keydown` para vírgula e Enter
- Ao disparar: valida email (regex simples), adiciona chip à lista
- Chip: fundo `bg-primary/10` + borda `border-primary/20`, texto `text-sm`
  - Se `name` presente: avatar circular 20px (inicial) + nome + email
  - Se só email: email em texto mais claro
  - Botão `×` para remover
- Props controladas: `value: EmailChip[]`, `onChange: (chips) => void`

#### 5. `useUserLookup` (novo, api/hooks/useUserLookup.ts)
- Envolve `POST /users/lookup` como `useMutation`
- Recebe array de emails, retorna found/not_found

#### 6. EmpresasPage — alterações
- `inviteEmail` (string) → `inviteEmails` (EmailChip[])
- `<Input type="email">` → `<EmailChipInput>`
- Ao adicionar chip: `useUserLookup` com emails ainda não verificados
- `templates` → `useClientAssignments(teamClientId)` para filtrar rotinas vinculadas
- Payload do submit: `{ emails: inviteEmails.map(e => e.email), template_ids: inviteTemplateIds }`
- Estado `lookedUpEmails: Set<string>` para evitar re-busca

## Data Flow

```
1. Abre dialog Equipe → setTeamClientId(id)
2. useClientAssignments(id) → carrega rotinas vinculadas
3. Usuário digita "joao@email.com," → EmailChipInput cria chip
4. useEffect → lookup dos emails não verificados
5. Chip atualiza com avatar/nome se encontrado
6. Usuário marca checkboxes (só rotinas vinculadas)
7. Clica "Enviar" → POST /clients/{id}/invite { emails: [...], template_ids: [...] }
8. Backend cria N invitations + envia N emails
9. Recarrega lista de membros
```

## Files Changed

| File | Change |
|------|--------|
| `apps/backend/src/modules/auth/router.py` | + `POST /users/lookup` |
| `apps/backend/src/modules/auth/schemas.py` | + `UserLookupRequest`, `UserLookupResponse` |
| `apps/backend/src/modules/team/schemas.py` | `InviteCreate.email` → `emails: list[str]` |
| `apps/backend/src/modules/team/service.py` | Loop sobre `data.emails` |
| `apps/backend/src/modules/team/repository.py` | + `get_users_by_emails()` |
| `apps/frontend/src/components/ui/EmailChipInput.tsx` | Novo componente |
| `apps/frontend/src/api/hooks/useUserLookup.ts` | Novo hook |
| `apps/frontend/src/pages/panel/EmpresasPage.tsx` | Multi-chip + rotinas filtradas |

## Testing

- **Backend:** Testar lookup com emails existentes/inexistentes; testar invite batch com múltiplos emails
- **Frontend:** Verificar typecheck + build + testes existentes continuam passando
