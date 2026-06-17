# Design System — Café com BPO

**Data**: 2026-06-16
**Status**: Aprovado
**Tags**: frontend, design-system, tailwind, shadcn-ui, storybook

---

## Objetivo

Criar um Design System componentizado para o frontend do Café com BPO usando Tailwind CSS + shadcn/ui + Storybook. O objetivo é que todos os elementos de UI (botões, inputs, cards, modais, dropdowns, filtros, tabelas, etc.) sejam componentes React reutilizáveis com tema centralizado, de forma que alterações de estilo propaguem automaticamente para todos os elementos.

## Escopo

**Fase 0 — Setup Técnico**: Instalar e configurar Tailwind CSS, shadcn/ui e Storybook.

**Fase 1 — Componentes Core**: Button, Input, Textarea, Select, Card, Dialog, Alert, Badge, DropdownMenu, Tabs, Table, Pagination.

**Fase 2 — Componentes de Suporte**: Skeleton, Toast (Sonner), Tooltip, Popover, Sheet (drawer), Separator, Avatar, Switch, Checkbox, Command (palette).

**Fase 3 — Histórias Storybook**: Stories para cada componente mostrando variantes, estados e exemplos de uso.

**Fora de escopo**: Refatoração de páginas existentes para usar os novos componentes. O CSS antigo (`tokens.css`, `ds-components.css`, `panel-layout.css`) continua funcionando em paralelo.

## Stack

| Tecnologia | Versão | Uso |
|---|---|---|
| Tailwind CSS | ^3.4 | Utilitários de estilo |
| shadcn/ui | latest | Componentes base (acessíveis via Radix UI) |
| Storybook | ^8 | Catálogo de componentes |
| Lucide React | já instalado | Ícones nos componentes |
| Inter | já carregada | Fonte do design system |

## Tema

### Dark Mode (padrão)

```css
--background:         #111111
--foreground:         #FFFFFF
--card:               #1a1a1a
--card-foreground:    #FFFFFF
--popover:            #222222
--popover-foreground: #FFFFFF
--primary:            #FBBF24    /* Amarelo mostarda */
--primary-foreground: #000000
--secondary:          #2a2a2a
--secondary-foreground: #FFFFFF
--muted:              rgba(255,255,255,0.06)
--muted-foreground:   rgba(255,255,255,0.55)
--accent:             #FBBF24
--accent-foreground:  #000000
--destructive:        #ef4444
--destructive-foreground: #FFFFFF
--border:             rgba(255,255,255,0.08)
--input:              rgba(255,255,255,0.08)
--ring:               #FBBF24
--radius:             4px
```

### Light Mode

```css
--background:         #f5f5f5
--foreground:         #1d1d1f
--card:               #ececec
--card-foreground:    #1d1d1f
--popover:            #e0e0e0
--popover-foreground: #1d1d1f
--primary:            #FBBF24
--primary-foreground: #000000
--secondary:          #d5d5d5
--secondary-foreground: #1d1d1f
--muted:              rgba(0,0,0,0.06)
--muted-foreground:   rgba(0,0,0,0.55)
--accent:             #FBBF24
--accent-foreground:  #000000
--destructive:        #ef4444
--destructive-foreground: #FFFFFF
--border:             rgba(0,0,0,0.08)
--input:              rgba(0,0,0,0.08)
--ring:               #FBBF24
--radius:             4px
```

### 8-Point Grid (Tailwind spacing)

```js
spacing: {
  '0.5': '4px',
  '1':  '8px',
  '2':  '16px',
  '3':  '24px',
  '4':  '32px',
  '5':  '40px',
  '6':  '48px',
  '7':  '56px',
  '8':  '64px',
}
borderRadius: {
  sm: '2px',
  md: '4px',
  lg: '8px',
}
```

## Arquitetura de Componentes

```
src/
├── components/
│   ├── ui/                    # gerado pelo shadcn/add
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── ...
│   │   └── index.ts           # barrel export
│   └── ui.stories/            # histórias Storybook
│       ├── Button.stories.tsx
│       ├── Input.stories.tsx
│       └── ...
├── stories/                   # pasta padrão do Storybook
│   └── assets/
├── styles/
│   └── globals.css            # CSS variables do tema (shadcn/ui)
└── .storybook/                # config do Storybook
    ├── main.ts
    ├── preview.ts
    └── preview-head.html      # import da fonte Inter
```

### Dependências entre componentes

Nenhum componente depende de outro — todos são independentes e importáveis individualmente. Exceções:
- `Select` usa `@radix-ui/react-select`
- `Dialog` usa `@radix-ui/react-dialog`
- `DropdownMenu` usa `@radix-ui/react-dropdown-menu`
- `Tabs` usa `@radix-ui/react-tabs`
- `Tooltip` usa `@radix-ui/react-tooltip`
- `Popover` usa `@radix-ui/react-popover`
- `Sheet` usa `@radix-ui/react-dialog`
- `Command` usa `cmdk` + `@radix-ui/react-dialog`

## Componentes — Especificação

### Fase 1 — Core

| Componente | Props principais | Variantes/Estados | Notas |
|---|---|---|---|
| **Button** | `variant`, `size`, `isLoading`, `disabled`, `children` | primary / secondary / outline / ghost / destructive / link; sm / md / lg | Spinner interno quando loading |
| **Input** | `label`, `error`, `placeholder`, `type`, `disabled` | — | Label + mensagem de erro + helper text |
| **Textarea** | `label`, `error`, `placeholder`, `rows`, `disabled` | — | Mesmo padrão do Input |
| **Select** | `label`, `error`, `placeholder`, `options`, `disabled` | — | Select nativo estilizado ou Radix |
| **Card** | `children`, `className` | — | Container com header/content/footer |
| **Dialog** | `open`, `onOpenChange`, `title`, `description`, `children` | — | Modal com overlay, aria-modal, foco preso |
| **Alert** | `variant`, `title`, `children` | default / destructive / warning / info | Borda esquerda colorida |
| **Badge** | `variant`, `children` | default / secondary / outline / destructive | Pequeno, arredondado |
| **DropdownMenu** | `children`, `items` | — | Menu dropdown, submenus, separadores |
| **Tabs** | `tabs: [{value, label, content}]` | — | Navegação por abas |
| **Table** | `columns`, `data`, `onSort` | — | Tabela com header sortável |
| **Pagination** | `page`, `totalPages`, `onPageChange` | — | Botões de página + next/prev |

### Fase 2 — Suporte

| Componente | Props principais | Notas |
|---|---|---|
| **Skeleton** | `className`, `variant` | Loading shimmer |
| **Toast (Sonner)** | `message`, `type` | Sistema de notificação via comando |
| **Tooltip** | `content`, `children`, `side` | Hover tooltip |
| **Popover** | `content`, `children` | Popover contextual |
| **Sheet** | `open`, `onOpenChange`, `side`, `children` | Drawer lateral (esquerda/direita) |
| **Separator** | `orientation`, `className` | Linha horizontal ou vertical |
| **Avatar** | `src`, `alt`, `fallback` | Círculo com imagem ou iniciais |
| **Switch** | `checked`, `onCheckedChange`, `disabled` | Toggle switch |
| **Checkbox** | `checked`, `onCheckedChange`, `label`, `disabled` | Checkbox com label |
| **Command** | `items`, `onSelect`, `placeholder` | Paleta de busca/comandos |

## Plano de Implementação

### Etapa 1: Setup (30 min)

```bash
npm install -D tailwindcss @tailwindcss/typography postcss autoprefixer
npx tailwindcss init -p
npx shadcn@latest init        # configura CSS variables + components.json
npx storybook@latest init     # configura .storybook/
```

Arquivos a modificar:
- `tailwind.config.js` — adicionar 8-point grid, font family Inter, cores
- `src/styles/globals.css` — CSS variables do tema (dark + light)
- `.storybook/preview.ts` — importar globals.css + decorator de tema
- `.storybook/preview-head.html` — import Google Fonts Inter

### Etapa 2: Componentes Core (2-3h)

Para cada componente:

```bash
npx shadcn@latest add button
```

Ajustar o tema nas CSS variables (já configurado no `globals.css`). Componentes shadcn/ui usam `var(--primary)`, `var(--destructive)`, etc. — como mapeamos os tokens, o tema já está correto.

### Etapa 3: Histórias Storybook (1-2h)

Criar `src/stories/Button.stories.tsx`, `Input.stories.tsx`, etc. mostrando:
- Meta com título e componente
- Variantes via `args`
- Estados (disabled, loading, error)

### Etapa 4: Componentes Suporte (1-2h)

Repetir Etapa 2 para componentes da Fase 2.

### Etapa 5: Verificação

```bash
npm run typecheck     # zero erros
npm run lint          # zero warnings
npm run test          # todos passando
npm run build         # build limpo
npm run storybook     # storybook abre sem erros
```

## Critérios de Sucesso

1. `npm run build` passa sem erros
2. `npm run storybook` abre e mostra todos os componentes
3. `npm run test` continua 243 passing (0 regressão)
4. Tema dark/light funcionando no Storybook via toggle
5. Todos os componentes existentes em `src/components/ui/*.tsx`
6. Barrel export em `src/components/ui/index.ts`

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| shadcn/ui gerar versão incompatível com React 18 | Verificar compatibilidade antes de `npx shadcn init`; React 18 é suportado |
| Storybook conflitar com Vite config | Usar `@storybook/builder-vite` (automático no `npx storybook init`) |
| CSS antigo sobrescrever novo | Ambos convivem; CSS do shadcn usa classes específicas, sem conflito |
| Testes quebrados | Não refatorar páginas existentes; testes continuam passando |

## Aprovação

Design aprovado pelo usuário em 16/06/2026. Próximo passo: implementação.
