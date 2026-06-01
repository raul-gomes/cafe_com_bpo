# Avatar Pessoal + Logo da Empresa — Design

## Resumo

Separar o upload de avatar pessoal do upload de logo da empresa, que atualmente estão
conflituados no frontend. O backend já possui o campo `company_logo_url` no modelo `User`,
mas ele nunca é populado via upload — apenas via PATCH manual. Os componentes de PDF
(proposta, precificação) usam `avatar_url` como logo da empresa, o que é semanticamente
incorreto.

## Motivação

- Item 8 do `docs/implemantation_plan_todo_2.md`
- A tela de Perfil exibe "Logo da Empresa" mas envia o arquivo para o endpoint de avatar pessoal
- `company_logo_url` existe no backend mas é ignorado pelo frontend
- PDFs usam avatar pessoal como logo empresarial

## O que será feito

### 1. Backend — Novo endpoint `POST /auth/me/company-logo`

```
POST /auth/me/company-logo
Content-Type: multipart/form-data
Body: file (image/png, image/jpeg, image/webp, max 5MB)
```

**Fluxo:**
1. Valida extensão (png, jpg, jpeg, webp) e tamanho (`settings.file_upload_max_size`)
2. Lê o arquivo em memória
3. Envia para Cloudinary na pasta `cafe_com_bpo/logos/{user_id}/`
4. Atualiza `User.company_logo_url` com a URL retornada
5. Opcionalmente cria registro `UserFile` com `category="company_logo"` (para rastreabilidade)
6. Retorna `UserResponse` atualizado

**Arquivos alterados:**
- `apps/backend/src/modules/auth/router.py` — nova rota
- `apps/backend/src/modules/auth/service.py` — novo método `upload_company_logo`
- `apps/backend/src/modules/auth/storage_service.py` — `CloudinaryService.upload_file` já aceita pasta customizada (via `folder` param), reuso direto

### 2. Frontend — PerfilPage: duas seções de upload

Na aba **Personalização** (ou **Empresa**), ter dois uploads distintos:

| Seção | Rótulo | Endpoint | Campo no DB |
|-------|--------|----------|-------------|
| Avatar Pessoal | "Avatar Pessoal" (antes "Logo da Empresa") | `POST /auth/me/avatar` | `avatar_url` |
| Logo da Empresa | "Logo da Empresa" (novo) | `POST /auth/me/company-logo` | `company_logo_url` |

**Estado novo:** `companyLogoFile`, `companyLogoPreview`
**Submit:** `handleSubmit` chama `uploadCompanyLogo(file)` + `uploadAvatar(file)` antes do `updateProfile`

**Arquivos alterados:**
- `apps/frontend/src/pages/panel/PerfilPage.tsx` — adicionar seção, renomear existente
- `apps/frontend/src/api/client.ts` — adicionar `uploadCompanyLogo`

### 3. Frontend — Corrigir PDFs para usar `company_logo_url`

Todos os componentes que usam `user?.avatar_url || logoAsset` como logo da empresa devem
passar a usar `user?.company_logo_url || logoAsset`.

**Arquivos alterados:**
- `apps/frontend/src/components/proposal/ProposalPreview.tsx`
- `apps/frontend/src/components/proposal/ProposalDownloadGate.tsx`
- `apps/frontend/src/components/pricing/PricingCalculatorLayout.tsx`
- `apps/frontend/src/pages/DashboardPage.tsx`
- `apps/frontend/src/pages/panel/OrcamentoDetalhadoPage.tsx`

### 4. Testes

**Backend (pytest):**
- `test_upload_company_logo_success` — upload válido, verifica `company_logo_url` na resposta
- `test_upload_company_logo_requires_auth` — sem token → 401
- `test_upload_company_logo_invalid_extension` — arquivo .txt → 400

**Frontend (Vitest):**
- PerfilPage renderiza seção "Logo da Empresa"
- PerfilPage renderiza seção "Avatar Pessoal"

### 5. Migração

Nenhuma. A coluna `company_logo_url` já existe na tabela `users`.

## Arquivos alterados (resumo)

| Arquivo | Mudança |
|---------|---------|
| `backend/.../auth/router.py` | + rota `POST /auth/me/company-logo` |
| `backend/.../auth/service.py` | + método `upload_company_logo` |
| `backend/.../auth/schemas.py` | (nenhuma — já tem `company_logo_url`) |
| `backend/.../auth/storage_service.py` | (nenhuma — `upload_file` já é genérico) |
| `frontend/.../api/client.ts` | + `uploadCompanyLogo` |
| `frontend/.../pages/panel/PerfilPage.tsx` | + seção logo empresa, renomear avatar |
| `frontend/.../components/proposal/ProposalPreview.tsx` | avatar → company_logo_url |
| `frontend/.../components/proposal/ProposalDownloadGate.tsx` | avatar → company_logo_url |
| `frontend/.../components/pricing/PricingCalculatorLayout.tsx` | avatar → company_logo_url |
| `frontend/.../pages/DashboardPage.tsx` | avatar → company_logo_url |
| `frontend/.../pages/panel/OrcamentoDetalhadoPage.tsx` | avatar → company_logo_url |

## Riscos

- Nenhum: endpoint de avatar existente não é alterado, apenas renomeado no frontend
- `company_logo_url` nunca foi usado antes, então não há regressão
