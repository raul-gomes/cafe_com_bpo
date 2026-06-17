# Plano de Implementação — Design System Migration

**Baseado no spec**: `docs/superpowers/specs/2026-06-17-design-system-migration-plan.md`
**Início**: 2026-06-17

---

## Como usar

Cada checklist é uma unidade de trabalho. Complete em ordem. Rode `npm run typecheck && npm run build && npm run test` após cada tarefa.

---

## Fase 0 — Fundações ⚠️ PRIMEIRO

### 0.1 Consolidar CSS tokens
- [ ] Mapear todas as variáveis `--ds-*` do `tokens.css`
- [ ] Adicionar aliases no `globals.css` para que componentes legados ainda funcionem
- [ ] Remover importação do `tokens.css` no `main.tsx`
- [ ] Remover referências a classes `.apple-*` se não usadas
- [ ] Verificar se `--ds-*` é usado em algum componente (grep) e substituir pelo equivalente shadcn

### 0.2 Migrar Toast legado → sonner
- [ ] Mapear todas as páginas que usam `useToast()` (grep `useToast`)
- [ ] Substituir `useToast()` → `toast()` de `sonner` em cada página
- [ ] Remover `<ToastProvider>` do `main.tsx` ou `App.tsx`
- [ ] Remover arquivo `Toast.tsx`
- [ ] Verificar: `ConfirmDialog.tsx` também usa `Toast`? Se sim, migrar junto

### 0.3 Migrar ConfirmDialog → Dialog
- [ ] Mapear páginas que usam `useConfirm()` (grep `useConfirm`)
- [ ] Substituir por `<Dialog>` + estado local `useState`
- [ ] Remover `<ConfirmProvider>` e arquivo `ConfirmDialog.tsx`

### 0.4 Atualizar Navbar
- [ ] Substituir botões com `style={}` inline por `<Button variant="ghost">`
- [ ] Usar `cn()` para classes condicionais
- [ ] Verificar links de navegação

### 0.5 Atualizar PanelLayout / PanelSidebar
- [ ] Substituir classes CSS legadas por Tailwind utilities
- [ ] Remover importação de `panel-layout.css` e `sidebar.css`
- [ ] Consolidar estilos no próprio componente

---

## Fase 1 — Páginas Core do Painel

### 1.1 DashboardPage
- [ ] Substituir `panel-skeleton` → `<Skeleton>`
- [ ] Substituir `panel-info-card` / `orcamento-card` → `<Card>`
- [ ] Substituir `ds-btn`, `ds-btn-ghost`, `ds-btn-primary` → `<Button>`
- [ ] Substituir status dropdown → `<DropdownMenu>`
- [ ] Substituir `<style>` tag injection por Tailwind
- [ ] Remover CSS legado importado (`dashboard.css`)
- [ ] Remover `style={}` inline

### 1.2 TasksPage
- [ ] Substituir botões de filtro → `<Button variant="outline" size="sm">`
- [ ] Substituir view switcher → `<Tabs>`
- [ ] Substituir task cards → `<Card>`
- [ ] Substituir status labels → `<Badge>`
- [ ] Substituir date picker → `<Popover>`
- [ ] Substituir macro calendar sidebar → `<Sheet>`
- [ ] Substituir task modal → `<Dialog>`
- [ ] Remover `<style>` tag injection
- [ ] Remover `style={}` inline
- [ ] ⚠️ Manter `@hello-pangea/dnd` e lógica de calendário intactos

### 1.3 EmpresasPage
- [ ] Substituir breadcrumb raw → `<Breadcrumb>` (DS)
- [ ] Substituir `panel-card` / `orcamento-card` → `<Card>`
- [ ] Substituir `ds-btn` → `<Button>`
- [ ] Substituir `ds-input-group`, `ds-input`, `ds-label` → `<InputGroup>` / `<Input>`
- [ ] Substituir modal de template → `<Dialog>`
- [ ] Remover `style={}` inline

### 1.4 OrcamentosPage
- [ ] Substituir `panel-stat`, `panel-stats` → `<Card>` com ícones
- [ ] Substituir `orcamento-card` → `<Card>` + `<Badge>`
- [ ] Substituir modal WhatsApp → `<Dialog>`
- [ ] Substituir `ds-btn` → `<Button>`
- [ ] Substituir breadcrumb raw → `<Breadcrumb>`
- [ ] Remover `style={}` inline
- [ ] ⚠️ Manter calendar widget como está por enquanto

### 1.5 OrcamentoDetalhadoPage
- [ ] Substituir `detalhe-card` → `<Card>`
- [ ] Substituir `detalhe-action-btn` → `<Button>`
- [ ] Substituir modal WhatsApp → `<Dialog>`
- [ ] Substituir `ds-input-group` → `<InputGroup>`
- [ ] Substituir breadcrumb raw → `<Breadcrumb>`
- [ ] Remover `style={}` inline

---

## Fase 2 — Páginas Secundárias

### 2.1 PerfilPage
- [ ] Substituir tabs custom → `<Tabs>`
- [ ] Substituir `ds-input`, `ds-label` → `<Input>`, `<Label>`
- [ ] Substituir `<textarea>` raw → `<Textarea>`
- [ ] Substituir `<select>` raw → `<Select>`
- [ ] Substituir `perfil-card` → `<Card>`
- [ ] Remover `style={}` inline

### 2.2 GaleriaArquivosPage
- [ ] Substituir tabs custom → `<Tabs>`
- [ ] Substituir `<table>` raw → `<Table>`
- [ ] Substituir `ds-btn` → `<Button>`
- [ ] Substituir modal upload → `<Dialog>`
- [ ] Substituir barra de progresso → `<Progress>` (criar componente se não existir)
- [ ] Remover `style={}` inline

### 2.3 NetworkPage
- [ ] Substituir botões de filtro/sort → `<Button variant="outline" size="sm">` ou `<Tabs>`
- [ ] Substituir `panel-card` → `<Card>`
- [ ] Substituir tags → `<Badge>`
- [ ] Remover `style={}` inline

### 2.4 NetworkPostPage
- [ ] Substituir avatar initials custom → `<Avatar>` + `<AvatarFallback>`
- [ ] Substituir `panel-card` → `<Card>`
- [ ] Substituir `ds-btn` → `<Button>`
- [ ] Substituir modal delete confirm → `<Dialog>`
- [ ] Adicionar `<Separator>` entre posts
- [ ] Remover `style={}` inline

### 2.5 PaymentsPage
- [ ] Substituir `ds-card` → `<Card>`
- [ ] Substituir `ds-btn` → `<Button>`
- [ ] Substituir `ds-input-group` → `<InputGroup>`
- [ ] Substituir modal create → `<Dialog>`
- [ ] Remover `style={}` inline

---

## Fase 3 — Templates

### 3.1 TemplateListPage
- [ ] Substituir `ds-card` → `<Card>`
- [ ] Substituir `ds-btn` → `<Button>`
- [ ] Substituir `<input>` raw → `<Input>`
- [ ] Substituir `<select>` raw → `<Select>`
- [ ] Substituir modal type manager → `<Dialog>`
- [ ] Substituir weekday selectors → `<Checkbox>`
- [ ] Substituir toggles → `<Switch>`
- [ ] Remover `style={}` inline

### 3.2 TemplateDetailPage
- [ ] Substituir `ds-card` → `<Card>`
- [ ] Substituir `ds-btn` → `<Button>`
- [ ] Substituir `<input>` raw → `<Input>`
- [ ] Substituir `<textarea>` raw → `<Textarea>`
- [ ] Substituir `<select>` raw → `<Select>`
- [ ] Remover `style={}` inline

---

## Fase 4 — Páginas Públicas

### 4.1 LoginPage / CadastroPage
- [ ] Substituir container → `<Card>`
- [ ] Substituir `<input>` raw → `<Input>`
- [ ] Substituir `<button>` raw → `<Button>`
- [ ] Substituir `ds-alert` → `<Alert>`
- [ ] Remover `style={}` inline

### 4.2 ForgotPasswordPage / ResetPasswordPage
- [ ] Substituir wrapper → `<Card>`
- [ ] Substituir `ds-input` → `<Input>`
- [ ] Substituir `ds-btn` → `<Button>`
- [ ] Substituir `ds-alert` → `<Alert>`
- [ ] Remover `style={}` inline

### 4.3 HomePage
- [ ] Substituir `<Navbar>` (após 0.4)
- [ ] Substituir `btn-primary-v2`, `btn-ghost-v2` → `<Button>`
- [ ] Substituir `<input>` raw → `<Input>`
- [ ] Substituir ferramenta cards → `<Card>`
- [ ] Substituir donation card → `<Card>`
- [ ] Remover `style={}` inline

### 4.4 SimulatorPage
- [ ] Substituir `<Navbar>` (após 0.4)
- [ ] Substituir botões → `<Button>`
- [ ] Substituir cards → `<Card>`
- [ ] ⚠️ `PublicPricingSimulator` é componente terceiro — só trocar wrapper

---

## Fase 5 — Cleanup

### 5.1 Páginas pequenas
- [ ] OAuthCallbackPage: trocar spinner inline por `<Skeleton>`
- [ ] ProposalPreviewPage: trocar botões por `<Button>`, loaders por `<Skeleton>`
- [ ] UnderConstructionPage: finalizar migração (já parcial)
- [ ] ClientTimelinePage: decidir se mantém ou remove; se mantém, migrar

### 5.2 Remover CSS órfão
- [ ] Após cada fase, deletar arquivos CSS correspondentes
- [ ] Checklist final: nenhum arquivo `.css` em `src/` além de `globals.css`

---

## Verificação pós-migração

Após cada página:
```bash
npm run typecheck   # sem erros
npm run build       # sem erros
npm run test        # 85 testes passando
```

Após cada fase:
- [ ] Rodar `git status` e fazer commit
- [ ] Verificar visualmente a página em modo light e dark
- [ ] Verificar responsivo (mobile/desktop)
