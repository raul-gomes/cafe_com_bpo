# CSS Architecture Refactor + Light Theme

**Date:** 2026-06-16
**Status:** Draft

## Goal

Restructure the frontend CSS from two monolithic files into a modular, responsibility-based architecture, then implement a light theme toggle with off-white background, yellow accents, and black details.

---

## Phase 1: CSS Architecture Refactor

### Current State (Problems)

| File | Lines | Contents (mixed) |
|------|-------|-------------------|
| `index.css` | ~630 | Variables + DS components + tutorial + legacy homepage styles |
| `panel.css` | ~2100 | Sidebar + layout + proposals + profile + calculator + modals + toasts + calendar + donate modal + media queries |

Both files mix unrelated responsibilities. A sidebar change and a button style change both require editing the same file.

### Target File Structure

```
src/
├── tokens.css                # CSS variables, @font, global reset
├── ds-components.css          # Design system: .ds-btn, .ds-card, .ds-input, etc.
├── panel-layout.css           # Panel shell: .panel-shell, .panel-content, navbar
├── sidebar.css                # Sidebar + mobile overlay + company selector
├── proposals.css              # Orçamentos list + detalhe page
├── profile.css                # Perfil page
├── calculator.css             # Summary bar + ROI calculator
├── tutorial.css               # Tutorial panel
│
├── dashboard.css              # Already exists, unchanged
├── forms.css                  # Already exists, unchanged
├── login.css                  # Already exists, unchanged
├── proposal.css               # Already exists, unchanged (public)
└── HomePage.css               # Already exists, unchanged (public)
```

### Extraction Map

#### From `index.css` (~630 lines):

| New File | Content | Lines |
|----------|---------|-------|
| `tokens.css` | `@import url('Inter font')`, `:root { --ds-* }`, `*, *::before, *::after` reset, `html`, `body`, `a` defaults, `.apple-container`, `.apple-section`, `.apple-display`, `.apple-body`, `.bg-black` (used by UnderConstructionPage) | 1-86, 283-310 |
| `ds-components.css` | `.ds-btn*`, `.ds-input*`, `.ds-label`, `.ds-card*`, `.ds-alert*`, `.ds-toggle*`, `.ds-badge*`, `.ds-error-text`, `.ds-step-badge`, `.tt` (tooltip), `.ds-hint` | 88-448 |
| `tutorial.css` | `.tutorial-overlay`, `.tutorial-panel*` | 450-625 |
| *(removed)* | `.btn-base`, `.btn-primary`, `.btn-outline`, `.btn-pill`, `.btn-size-normal`, `.btn-size-large`, `.bento-grid*`, `.glass-panel`, `.watermark-text`, `.content-relative`, `.metrics-badge*` (dead code — not used anywhere) | 301-368 |

#### From `panel.css` (~2100 lines):

| New File | Content | Lines |
|----------|---------|-------|
| `panel-layout.css` | `.panel-shell`, `.panel-content`, `.panel-content__header`, `.panel-navbar__*` (search, notification, dropdown), scrollbar styles, mobile layout media queries | ~210 |
| `sidebar.css` | `.panel-sidebar`, `.panel-sidebar__*` (brand, profile, nav, company selector, donate, logout, footer), `.panel-sidebar-overlay`, `.panel-mobile-toggle` | ~400 |
| `sidebar.css` *(bottom section)* | `.modal-nos-ajude*` + `.donate-*` (donate modal — triggered from sidebar, kept in same file with comment header) | ~296 |
| `proposals.css` | `.orcamentos-*`, `.orcamento-card*`, `.detalhe-*`, `.panel-info-*card/row*`, `.panel-stats*` | ~470 |
| `profile.css` | `.perfil-page`, `.perfil-card*`, `.perfil-form*` | ~67 |
| `calculator.css` | `.calculator-summary-bar`, `.summary-bar-*`, `.calculator-wrapper`, `.roi-calculator-*`, `:root { --panel-footer-height }` | ~210 |
| `ds-components.css` | `.panel-modal-overlay`, `.panel-modal*`, `.ds-toast-*`, `.panel-empty`, `.panel-skeleton`, `@keyframes panelFadeIn`, `@keyframes panelSlideIn`, `@keyframes panelShimmer` | ~195 |

#### Dead code verified for removal:

The following selectors from `index.css` are NOT referenced in any `.tsx`/`.ts` file and will be removed:
- `.btn-base`, `.btn-primary`, `.btn-outline`, `.btn-pill`, `.btn-size-normal`, `.btn-size-large`
- `.bento-grid`, `.bento-item`, `.bento-wide`, `.bento-square`
- `.glass-panel`
- `.watermark-text`, `.content-relative`
- `.metrics-badge`, `.metric-item`, `.metric-dot`

The following are STILL USED by `UnderConstructionPage.tsx` and will be kept in `tokens.css`:
- `.apple-container`, `.apple-section`, `.apple-display`, `.apple-body`, `.bg-black`

---

## Phase 2: Light Theme Implementation

### Design Tokens

#### Current dark-only `:root`:

```css
:root {
  --ds-black:         #000000;
  --ds-surface:       #111111;
  --ds-surface-1:     #1a1a1a;    /* new */
  --ds-surface-2:     #222222;
  --ds-surface-3:     #2a2a2a;    /* new */
  --ds-text:          #FFFFFF;
  --ds-text-muted:    rgba(255,255,255,0.55);
  --ds-text-subtle:   rgba(255,255,255,0.35);
  --ds-primary:       #FBBF24;
  --ds-primary-dark:  #d4a017;
  --ds-primary-text:  #000000;
  --ds-border:        rgba(255,255,255,0.08);  /* new */
  --ds-error:         #ef4444;
  --ds-success:       #22c55e;
  --ds-warning:       #FBBF24;
}
```

#### New `.light-theme` overrides:

```css
.light-theme {
  --ds-black:         #f5f5f0;
  --ds-surface:       #ffffff;
  --ds-surface-1:     #f0f0eb;
  --ds-surface-2:     #e8e8e2;
  --ds-surface-3:     #e0e0d8;
  --ds-text:          #1d1d1f;
  --ds-text-muted:    rgba(0,0,0,0.55);
  --ds-text-subtle:   rgba(0,0,0,0.35);
  --ds-primary:       #FBBF24;       /* unchanged */
  --ds-primary-dark:  #d4a017;       /* unchanged */
  --ds-primary-text:  #000000;       /* unchanged */
  --ds-border:        rgba(0,0,0,0.08);
  --ds-error:         #ef4444;       /* unchanged */
  --ds-success:       #22c55e;       /* unchanged */
  --ds-warning:       #FBBF24;       /* unchanged */
}
```

### Hardcoded RGBA Adjustments

`panel.css` and `index.css` contain ~50+ hardcoded `rgba(255,255,255,0.xx)` values for borders, hover states, overlays, etc. These will be converted to use CSS variables:

```css
/* Before */
border-bottom: 1px solid rgba(255, 255, 255, 0.06);

/* After */
border-bottom: 1px solid var(--ds-border);
```

Where a specific opacity is needed that differs from `--ds-border`, a dedicated variable will be added to both `:root` and `.light-theme`.

### Sidebar Logo

`logo-side.png` is yellow on transparent (average color: `#FFC72C`). On the light off-white background (`#f5f5f0`), contrast is insufficient.

**Solution:** Apply `filter: brightness(0.3)` to the logo image in `.light-theme`:
```css
.light-theme .panel-sidebar__brand img {
  filter: brightness(0.3);
}
```
This darkens the yellow to a deep amber visible on light backgrounds.

### Theme Toggle Mechanism

1. **State:** `theme` stored in React state + persisted to `localStorage('cafe_bpo_theme')`
2. **Application:** `.light-theme` class added to `.panel-shell` div in `PanelLayout.tsx`
3. **UI:** Toggle button (Sun/Moon icon) in the sidebar footer section
4. **Default:** `'dark'` (preserves existing behavior for all users)

---

## Implementation Order

### Step 1: Create `tokens.css`
- Extract: font import, `:root` variables, universal reset, html/body/a defaults from `index.css`
- Add missing variables: `--ds-border`, `--ds-surface-1`, `--ds-surface-3`
- Add `.light-theme` block with all overrides
- Include `@import url('...')` for Inter font

### Step 2: Create `ds-components.css`
- Extract: all `.ds-*` component classes from `index.css`
- Extract: `.panel-modal-*`, `.ds-toast-*`, `.panel-empty`, `.panel-skeleton`, animation keyframes from `panel.css`
- Convert hardcoded `rgba(255,255,255,...)` → variables

### Step 3: Create `panel-layout.css`
- Extract: `.panel-shell`, `.panel-content*`, `.panel-navbar*` from `panel.css`
- Convert hardcoded RGBA → variables

### Step 4: Create `sidebar.css`
- Extract: all `.panel-sidebar*`, `.panel-sidebar-overlay`, `.panel-mobile-toggle` from `panel.css`
- Extract: `.modal-nos-ajude*` + `.donate-*` styles at the bottom with a `/* Donate Modal */` comment header
- Convert hardcoded RGBA → variables
- Add `.light-theme` logo filter

### Step 5: Create `proposals.css`
- Extract: `.orcamentos-*`, `.orcamento-card*`, `.detalhe-*`, `.panel-info-*` from `panel.css`
- Convert hardcoded RGBA → variables

### Step 6: Create `profile.css` + `calculator.css` + `tutorial.css`
- Extract respective selectors from `panel.css` and `index.css`
- Convert hardcoded RGBA → variables

### Step 7: Update `main.tsx` imports
- Replace `import './index.css'` with individual imports
- Replace `import './panel.css'` with individual imports
- Remove `import './dashboard.css'` from `DashboardPage.tsx` (now imported globally)

### Step 8: Delete old files
- `index.css` (replaced)
- `panel.css` (replaced)

### Step 9: Add theme toggle in `PanelLayout.tsx` + `PanelSidebar.tsx`
- State management + localStorage persistence
- Toggle button in sidebar

### Step 10: Build, test, deploy
- Verify typecheck, lint, tests pass
- Rebuild Docker image and deploy

---

## Files Modified/Created

| Action | File |
|--------|------|
| **Create** | `src/tokens.css` |
| **Create** | `src/ds-components.css` |
| **Create** | `src/panel-layout.css` |
| **Create** | `src/sidebar.css` |
| **Create** | `src/proposals.css` |
| **Create** | `src/profile.css` |
| **Create** | `src/calculator.css` |
| **Create** | `src/tutorial.css` |
| **Modify** | `src/main.tsx` (CSS imports) |
| **Modify** | `src/components/panel/PanelLayout.tsx` (theme state + class) |
| **Modify** | `src/components/panel/PanelSidebar.tsx` (toggle button) |
| **Delete** | `src/index.css` |
| **Delete** | `src/panel.css` |
| **Unchanged** | `src/dashboard.css`, `src/forms.css`, `src/login.css`, `src/proposal.css`, `src/HomePage.css` |

---

## Risks & Mitigations

1. **Missing styles after extraction** — After creating each new file, verify by loading every panel page and checking visually
2. **Import order** — `tokens.css` must be first so variables are available to all subsequent files
3. **Donate modal** — The `.modal-nos-ajude*` / `.donate-*` styles in `panel.css` are actively used by `ModalNosAjude.tsx`. They will be moved to the bottom of `sidebar.css` with a clear comment header.
4. **Gateway cache** — After deploy, the Nginx gateway may serve cached `index.css` / `panel.css`. Use `docker compose restart gateway` or a hard refresh.
