# Design System Migration Plan

**Date**: 2026-06-17
**Status**: Spec (draft)
**Scope**: Migrate all 24 frontend pages from legacy CSS/inline styles to the new shadcn-inspired Design System component library

---

## 1. Current State Summary

| Category | Count |
|---|---|
| Fully migrated pages | 1 (DesignSystemPage) |
| Partially migrated pages | 2 (PerfilPage, UnderConstructionPage) |
| Legacy pages (raw HTML + inline styles + old CSS classes) | 21 |
| Total page components | 24 |

### Cross-cutting legacy systems
- **Dual CSS tokens**: `tokens.css` (`--ds-*` vars) + `globals.css` (shadcn `--*` vars) — both define dark/light themes
- **Dual toast**: Legacy `Toast.tsx` context (`useToast`) + `sonner.tsx` (`<Toaster />`)
- **Legacy ConfirmDialog**: Custom modal vs new `Dialog` component
- **Legacy Navbar**: Inline styles vs DS Button/Card
- **Inline styles**: ~2,500+ lines of `style={}` across all pages

### New Design System component inventory

| Category | Components Available |
|---|---|
| Forms | Button (6 variants, 5 sizes), Input, Textarea, Select, Checkbox, Switch, InputGroup (+MaskedInput for CPF/CNPJ/Phone), CurrencyInput, ColorPicker |
| Display | Badge (6 variants), Table, Avatar (+Group +Badge), Skeleton, Card |
| Feedback | Alert (2 variants), Dialog, Tooltip, Sonner Toast |
| Overlays | DropdownMenu, Popover, Sheet, Command (palette) |
| Navigation | Tabs (horizontal + vertical), Pagination, Separator, Breadcrumb |

---

## 2. Phased Migration Plan

### Phase 0 — Foundations (prerequisite, do first)

**Goal**: Resolve cross-cutting concerns so every page migration is clean and consistent.

| # | Task | Details | Files affected |
|---|------|---------|----------------|
| 0.1 | **Consolidate CSS tokens** | Merge `--ds-*` vars from `tokens.css` into `globals.css` or alias them. Remove `tokens.css` import. Keep only one source of truth for theme variables. | `src/styles/globals.css`, `src/tokens.css`, `src/main.tsx` (imports) |
| 0.2 | **Migrate Toast → sonner** | Replace `useToast()` from legacy `Toast.tsx` with `toast()` from `sonner` across all pages. Remove old `ToastProvider`. | 10+ pages + `src/components/ui/Toast.tsx` + `src/context/AuthContext.tsx` |
| 0.3 | **Migrate ConfirmDialog → Dialog** | Replace `useConfirm()` from legacy `ConfirmDialog.tsx` with `<Dialog>` component. Remove old provider. | 6+ pages + `src/components/ui/ConfirmDialog.tsx` |
| 0.4 | **Update Navbar** | Replace inline-styled navbar with DS `Button` components. Remove `src/components/ui/Navbar.tsx` inline styles. | `src/components/ui/Navbar.tsx` |
| 0.5 | **Update PanelLayout/PanelSidebar** | Replace legacy CSS classes with Tailwind utilities. Remove `panel-layout.css`, `sidebar.css`. | `PanelLayout.tsx`, `PanelSidebar.tsx` |

**Estimated effort**: 2–3 sessions

---

### Phase 1 — Core Panel Pages (user priority)

**Goal**: Migrate the 5 most-used pages in the authenticated area.

#### 1.1 TasksPage (`/painel/tarefas`)
**Current**: 914 lines, largest file. Uses `TaskModal`/`PhaseManager`/`TaskCard` (legacy), raw `<style>` tag injection, `@hello-pangea/dnd`. 3 views (Kanban, Timeline, Calendar).
**Target replacements**:
| Legacy | DS Component |
|--------|-------------|
| Custom filter buttons | `Button` (variants) |
| View switcher (raw buttons) | `Tabs` |
| Task cards | `Card` |
| Status labels | `Badge` |
| Date picker (raw) | `Popover` |
| Macro calendar sidebar | `Sheet` |
| Task modal (custom) | `Dialog` |
| Inline styles | Tailwind utilities |
| `<style>` injection | Remove |
**Estimated effort**: 3–4 sessions. Keep `@hello-pangea/dnd` and calendar rendering as-is.

#### 1.2 DashboardPage (`/painel`)
**Current**: Skeleton loaders, stat cards, task cards, activity feed, summary sidebar, calendar widget.
**Target replacements**:
| Legacy | DS Component |
|--------|-------------|
| Stat cards (inline) | `Card` |
| Task cards (inline) | `Card` + `Badge` |
| Status dropdown | `DropdownMenu` |
| Skeleton loaders | `Skeleton` |
| Activity feed | `Card` + `Separator` |
| Inline styles | Tailwind utilities |
**Estimated effort**: 2 sessions.

#### 1.3 EmpresasPage (`/painel/empresas`)
**Current**: Client cards with inline edit, create form, template linking modal, MaskedCNPJ/Phone (DS).
**Target replacements**:
| Legacy | DS Component |
|--------|-------------|
| Breadcrumb (raw) | `Breadcrumb` (DS) |
| Client cards (inline) | `Card` |
| Create/edit forms | `Input`, `Select`, `Button` |
| Template linking modal | `Dialog` |
| Inline styles | Tailwind utilities |
**Estimated effort**: 2 sessions.

#### 1.4 OrcamentosPage (`/painel/orcamentos`)
**Current**: Stats bar, proposal cards, calendar widget, WhatsApp modal, summary card.
**Target replacements**:
| Legacy | DS Component |
|--------|-------------|
| Stats bar cards | `Card` |
| Proposal cards | `Card` + `Badge` |
| Calendar (raw `<table>`) | Keep or replace later |
| WhatsApp modal | `Dialog` |
| Summary card | `Card` |
| Inline styles | Tailwind utilities |
**Estimated effort**: 2 sessions.

#### 1.5 OrcamentoDetalhadoPage (`/painel/orcamento/:id`)
**Current**: Action buttons, financial summary, service scope, client data, WhatsApp modal.
**Target replacements**:
| Legacy | DS Component |
|--------|-------------|
| Action buttons | `Button` |
| Cards (inline) | `Card` |
| WhatsApp modal | `Dialog` |
| Inline styles | Tailwind utilities |
**Estimated effort**: 2 sessions.

---

### Phase 2 — Secondary Panel Pages

| Page | Complexity | Key replacements | Est. effort |
|------|-----------|-----------------|-------------|
| PerfilPage | MEDIUM | Tabs, Input, Textarea, Select, Avatar, Card | 1 session |
| GaleriaArquivosPage | LARGE | Tabs, Table, Button, Dialog, Progress | 2 sessions |
| NetworkPage | LARGE | Button, Badge, Card, Tabs | 2 sessions |
| NetworkPostPage | MEDIUM | Avatar, Card, Button, Separator | 1 session |
| PaymentsPage | MEDIUM | Card, Button, Input, Select, Badge, Dialog | 1 session |

---

### Phase 3 — Template Pages

| Page | Complexity | Key replacements | Est. effort |
|------|-----------|-----------------|-------------|
| TemplateListPage | LARGE | Card, Button, Input, Select, Dialog, Switch, Checkbox | 2 sessions |
| TemplateDetailPage | LARGE | Card, Button, Input, Textarea, Select, Badge | 2 sessions |

---

### Phase 4 — Public Pages

| Page | Complexity | Key replacements | Est. effort |
|------|-----------|-----------------|-------------|
| LoginPage | MEDIUM | Card, Button, Input, Alert | 1 session |
| CadastroPage | MEDIUM | Card, Button, Input, Alert | 1 session |
| ForgotPasswordPage | MEDIUM | Card, Button, Input, Alert | 1 session |
| ResetPasswordPage | MEDIUM | Card, Button, Input, Alert | 1 session |
| HomePage | LARGE | Navbar, Button, Input, Card, Select | 2 sessions |
| SimulatorPage | MEDIUM | Button, Card (embedded form is complex) | 1 session |

---

### Phase 5 — Cleanup & Edge Pages

| Page | Complexity | Notes |
|------|-----------|-------|
| OAuthCallbackPage | SMALL | Minimal UI (loading spinner → Skeleton) |
| ProposalPreviewPage | SMALL | Button + Skeleton |
| UnderConstructionPage | SMALL | Already partial — finish migration |
| ClientTimelinePage | MEDIUM | Exists but not in router — decide fate |

---

## 3. CSS Cleanup Strategy

After each phase, remove CSS files that are no longer needed:

| Phase to remove | CSS files |
|----------------|-----------|
| Phase 0 | `tokens.css`, `panel-layout.css`, `sidebar.css` (merged into globals.css) |
| Phase 1 | `dashboard.css`, `profile.css` (if PerfilPage also done) |
| Phase 2 | `forms.css`, `proposals.css`, `proposal.css` |
| Phase 3 | (template CSS files if any exist) |
| Phase 4 | `login.css`, `calculator.css`, `HomePage.css` |
| Phase 5 | Any remaining orphan CSS files |

---

## 4. Principles & Constraints

1. **No visual regression**: After migration, each page must look equivalent or better. Do not change layout structure unless the old layout was broken.
2. **Keep working integrations**: `@hello-pangea/dnd` (kanban), `react-hook-form` + `zod` (forms), `@base-ui/react` popovers/calendars — keep as-is where they work.
3. **Inline styles → Tailwind classes**: Every `style={}` property must be converted to a Tailwind utility. Use `cn()` for conditional classes.
4. **One page per PR/commit**: Each page migration is its own commit with a descriptive message. No mega-commits mixing pages.
5. **Phase 0 is blocking**: Do not start Phase 1 until Phase 0 is merged and verified.
6. **Test after each page**: Run `npm run typecheck && npm run build && npm run test` after each page migration.
7. **No new features**: This is purely a UI migration. No functional changes.

---

## 5. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TasksPage dnd breaks | Low | High | Keep dnd library untouched; only replace wrapper UI |
| CSS cascade conflicts | Medium | Medium | Phase 0 resolves token consolidation first |
| Toast regression (missing notifications) | Medium | High | Keep both toast systems alive during Phase 0; remove legacy only after verifying all pages |
| Page becomes slower after migration | Low | Low | DS components are tree-shaken; no new deps added |
| Scope creep (redesigning while migrating) | Medium | Medium | Strict "no new features" rule; if a redesign is desired, do it in a separate project |

---

## 6. Effort Summary

| Phase | Pages | Estimated sessions |
|-------|-------|-------------------|
| Phase 0 — Foundations | 5 cross-cutting tasks | 2–3 |
| Phase 1 — Core pages | 5 | 11–13 |
| Phase 2 — Secondary | 5 | 6–7 |
| Phase 3 — Templates | 2 | 4 |
| Phase 4 — Public | 6 | 7 |
| Phase 5 — Cleanup | 4 | 2–3 |
| **Total** | **24 pages + 5 foundation tasks** | **32–37 sessions** |
