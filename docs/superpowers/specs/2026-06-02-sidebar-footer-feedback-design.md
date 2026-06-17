# Sidebar Footer + Feedback Modal

## Summary

Reformular o rodapé da sidebar do painel: remover os botões placeholder "Info" e "Erros", adicionar um botão "Reportar erro" que abre um modal com formulário (título + descrição) e envia um email para o suporte via API backend, mover "Sair da conta" para o último item, e manter o "Nos Ajude" existente.

## Motivation

A sidebar atual tem botões "Info" e "Erros" que só mostram `alert()` placeholders — não entregam valor. O usuário precisa de uma forma rápida de reportar problemas diretamente da interface.

## Design

### Sidebar — Novo Rodapé

Antes:
```
─────────────────
[Info]     (alert placeholder)
[Erros]    (alert placeholder)
[Nos Ajude]
[Sair da conta]
Café com BPO 2026
```

Depois:
```
─────────────────
[Reportar erro]   ← abre modal com formulário
[Nos Ajude]       ← já existe, inalterado
─────────────────
[Sair da conta]   ← último item
Café com BPO 2026
```

### Modal "Reportar Erro"

Implementado como componente React `ModalReportarErro` em arquivo separado.

**Trigger:** Botão "Reportar erro" no rodapé da sidebar.

**Layout:**
```
┌─────────────────────────────┐
│  Reportar Erro          [x] │
├─────────────────────────────┤
│                             │
│  Título                     │
│  [_______________________]  │
│                             │
│  Descrição                  │
│  [_______________________]  │
│  [_______________________]  │
│  [_______________________]  │
│                             │
│     [Cancelar]   [Enviar]   │
└─────────────────────────────┘
```

**Comportamento:**
- Ao abrir: campos vazios, foco no campo "Título"
- Validação: título obrigatório (mín. 3 caracteres), descrição obrigatória (mín. 10 caracteres)
- Ao enviar: chamada `POST /api/feedback/` → mostra toast de sucesso + fecha modal
- Em caso de erro: toast de erro, modal permanece aberto
- loading state no botão "Enviar" durante a requisição
- Fechar ao clicar no fundo escuro, no X, ou Cancelar

### Backend — Módulo `feedback`

**Estrutura:** `src/modules/feedback/` com schemas, service, router (sem models/models.py pois não persiste no banco).

**Endpoints:**

| Método | Rota | Autenticação | Descrição |
|--------|------|-------------|-----------|
| POST | `/feedback/` | Sim | Envia email de suporte com título e descrição |

**Schema `FeedbackCreate`:**
```python
title: str          # min_length=3, max_length=200
description: str    # min_length=10, max_length=2000
```

**Service:**
- Instancia `EmailService` das configurações atuais
- Formata email com: título, descrição, nome do usuário, email do usuário
- Envia para `SUPPORT_EMAIL` (configurado em `Settings`)
- Retorna mensagem de sucesso

**Settings:**
Adicionar `SUPPORT_EMAIL: str = "cafe@cafecombpo.com.br"` ao `Settings` com fallback.

**Registro em `main.py`:**
```python
from src.modules.feedback.router import router as feedback_router
app.include_router(feedback_router, prefix="/api/feedback", tags=["Feedback"])
```

### Frontend — Componentes e Hooks

**`ModalReportarErro.tsx`:**
- Props: `isOpen`, `onClose`
- Estado interno: `title`, `description`, `isSubmitting`, `error`
- Inputs controlados
- Submit: chama hook `useSendFeedback`

**Hook `useSendFeedback`:**
- `POST /feedback/` via axios
- Retorna mutation do React Query (sem cache — é write-only)
- Toast de sucesso/erro

**Alterações no `PanelSidebar.tsx`:**
- Importar `ModalReportarErro`
- Remover os botões "Info" e "Erros"
- Adicionar "Reportar erro" antes de "Nos Ajude"
- Mover "Sair da conta" para depois de um separador após "Nos Ajude"

### Fluxo de Dados

```
[Usuário] → clica "Reportar erro" → Modal abre
→ Preenche título + descrição → clica "Enviar"
→ POST /api/feedback/ (autenticado)
  → Backend valida schema
  → EmailService.send_email(
      to=SUPPORT_EMAIL,
      subject="[Feedback] {title}",
      body="Usuário: {user.name} ({user.email})\n\n{description}"
    )
→ Resposta 200 → Toast "Relato enviado com sucesso!" → Fecha modal
```

### Testes

**Backend:**
- Testar rota `POST /feedback/` com dados válidos (assert 200)
- Testar validação: título curto demais (assert 422)
- Testar sem autenticação (assert 401)
- Mockar `EmailService` para não enviar email real

**Frontend:**
- Testar renderização do modal (aberto/fechado)
- Testar validação do formulário (botão desabilitado se campos inválidos)
- Testar submit com mock do axios

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `apps/backend/src/modules/feedback/__init__.py` | New | Module init |
| `apps/backend/src/modules/feedback/schemas.py` | New | FeedbackCreate schema |
| `apps/backend/src/modules/feedback/service.py` | New | Email sending logic |
| `apps/backend/src/modules/feedback/router.py` | New | POST /feedback/ endpoint |
| `apps/backend/src/main.py` | Edit | Register feedback router |
| `apps/backend/src/core/settings.py` | Edit | Add SUPPORT_EMAIL |
| `apps/backend/tests/test_api_feedback.py` | New | Backend tests |
| `apps/frontend/src/components/panel/ModalReportarErro.tsx` | New | Feedback modal component |
| `apps/frontend/src/api/hooks/useFeedback.ts` | New | React Query hook |
| `apps/frontend/src/components/panel/PanelSidebar.tsx` | Edit | New footer layout |
| `apps/frontend/src/components/panel/ModalNosAjude.tsx` | Unchanged | Already exists |

## Dependencies

- Backend `EmailService` já existe em `src/core/email.py`
- SMTP config já existe em `Settings` (SMTP_HOST, SMTP_USER, etc.)
- `ModalNosAjude.tsx` já existe — não alterar
- React Query já configurado no projeto

## Possible Issues / Mitigations

- **SMTP não configurado em dev:** EmailService já tem fallback para `log.info` quando SMTP não está configurado. O endpoint retornará sucesso mesmo sem envio real em dev.
- **Campo descrição pequeno:** Textarea com min-height 120px, placeholder orientando o usuário a descrever detalhadamente.
