# PDI — Product Design Interface

## Card do Gerenciador de Tarefas (Kanban)

> **Projeto:** Café com BPO — Painel do Operador Financeiro
>
> **Versão:** 1.0
>
> **Data:** 31/05/2026

---

## 1. Visão Geral

O card de tarefa é o bloco fundamental da visão Kanban do Gerenciador de Tarefas. Cada card representa uma **tarefa operacional** vinculada a um cliente e a uma fase do fluxo de trabalho.

O layout segue o **design system Café com BPO** (`index.css` / `panel.css`), com fundo escuro (`--ds-black: #000000`), superfícies em `--ds-surface: #111111` e destaque na cor primária amarela (`--ds-primary: #FBBF24`).

### Objetivos de design
- **Legibilidade imediata**: informações hierarquizadas (cliente > título > metadados)
- **Identificação visual rápida**: cor do cliente na borda esquerda, prioridade por ponto colorido
- **Ações contextuais**: botões compactos (ícone-only para cancelar/finalizar) sem poluir o card
- **Consistência com o DS**: cantos de 4px (`radius-md` / `radius-lg`), tipografia Inter, espaçamento 4-8-16-24

---

## 2. Estrutura do Card

```
┌──────────────────────────────────────────────┐
│  ▎  CLIENTE NAME                     ●       │  ← Linha 1: Cliente (uppercase) + prioridade (dot)
│  ▎                                        │
│  ▎  Título da Tarefa          [✓] [✕]    │  ← Linha 2: Título + botões de ação na mesma linha
│  ▎                                        │
│  ▎  [⚠ Atrasado 3d]           📅 31/05   │  ← Linha 3: Badge overdue + deadline
│  ▎                                        │
│  ▎  Criada 30/05          Finalizada —    │  ← Linha 4: Metadados de criação
└──────────────────────────────────────────────┘
```

### Dimensões
| Propriedade | Valor | Token |
|-------------|-------|-------|
| Largura | 100% do grid column | — |
| Padding interno | 16px | `--space-md` |
| Borda esquerda | 4px solid (cor do cliente ou fase) | — |
| Border radius | 8px | `--radius-lg` |
| Gap entre linhas | 12px / 8px / 10px | — |
| Sombra (hover) | `0 8px 24px rgba(0,0,0,0.3)` | — |

### Superfície
- **Background**: `var(--ds-surface-2)` (#222222)
- **Background (dragging)**: `var(--ds-surface-3)` (mais claro)
- **Borda**: `1px solid rgba(255,255,255,0.07)` (via `.ds-card`)

---

## 3. Componentes Internos

### 3.1 Linha do Cliente

| Elemento | Estilo |
|----------|--------|
| Texto | `font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em` |
| Cor | `client?.color` ou `col.color` (fallback) |
| Margem inferior | 6px |

### 3.2 Indicador de Prioridade

Localizado no canto superior direito do card.

| Prioridade | Cor | Token |
|------------|-----|-------|
| Alta (high) | `#ef4444` | `--ds-error` |
| Média (medium) | `#FBBF24` | `--ds-warning` |
| Baixa (low) | `#22c55e` | `--ds-success` |

Forma: círculo de 6px de diâmetro.

### 3.3 Título da Tarefa

| Propriedade | Valor |
|-------------|-------|
| Font weight | 600 |
| Font size | 14px |
| Line height | 1.4 |
| Cor | `var(--ds-text)` (#FFFFFF) |
| Margem inferior | 12px |

### 3.4 Botões de Ação (Ícone-Only)

#### 3.4.1 Botão Finalizar (✓)

| Estado | Estilo |
|--------|--------|
| **Default** | Background `rgba(34,197,94,0.1)`, cor `#22c55e` |
| **Hover** | Background `rgba(34,197,94,0.2)` |
| **Ícone** | `Check` (lucide-react), 14px |
| **Tooltip** | "Mover para Concluído" |

**Exibição condicional**: apenas quando `getTaskStatus(task) !== doneColumnId`.

**Comportamento**: `onFinalize(task.id)` → move para a última fase + `status: 'done'`.

#### 3.4.2 Botão Cancelar (✕)

| Estado | Estilo |
|--------|--------|
| **Default** | Background `rgba(239,68,68,0.1)`, cor `#ef4444` |
| **Hover** | Background `rgba(239,68,68,0.2)` |
| **Ícone** | `XCircle` (lucide-react), 14px |
| **Tooltip** | "Cancelar tarefa" |
| **Confirmação** | `window.confirm("Tem certeza que deseja cancelar ...?")` |

**Exibição condicional**: apenas quando `getTaskStatus(task) !== doneColumnId && task.status !== 'cancelled' && !task.cancelled_at`.

#### 3.4.3 Container dos Botões

```css
display: flex;
gap: 6px;
margin-bottom: 10px;
```

Cada botão:
```css
background: rgba(34,197,94,0.1);
border: none;
border-radius: var(--radius-sm);
cursor: pointer;
display: inline-flex;
align-items: center;
justify-content: center;
width: 28px;
height: 28px;
transition: all 0.15s ease;
```

> **Nota:** Os botões usam `e.stopPropagation()` para não disparar `onEdit` ao clicar.

### 3.5 Badge de Atraso

| Elemento | Estilo |
|----------|--------|
| Container | `display: inline-flex; align-items: center; gap: 4px` |
| Texto | `font-size: 10px; font-weight: 700` |
| Cor | `var(--ds-error)` (#ef4444) |
| Background | `rgba(239, 68, 68, 0.12)` |
| Padding | `2px 8px` |
| Border radius | 12px |
| Ícone | `AlertTriangle` (lucide-react), 10px |

**Fórmula do atraso**: `Math.floor((today - deadline) / (1000 * 60 * 60 * 24))` dias.

**Exibição**: apenas quando `isTaskOverdue(task) === true` (deadline passou e não está na coluna final).

### 3.6 Deadline

| Elemento | Estilo |
|----------|--------|
| Texto | `font-size: 11px; color: var(--ds-text-subtle)` |
| Ícone | `CalendarIcon` (lucide-react), 12px |
| Formato | `dd/mm` (locale `pt-BR`) |

### 3.7 Metadados de Criação / Finalização

| Elemento | Estilo |
|----------|--------|
| Texto | `font-size: 10px; color: var(--ds-text-muted); opacity: 0.7` |
| Formato | `dd/mm` |

- Card não finalizado: mostra `Criada em dd/mm`
- Card finalizado: mostra `Criada em dd/mm` + `Finalizada em dd/mm`

### 3.8 Borda Esquerda Colorida

```css
border-left: 4px solid ${client?.color || col.color};
```

- Se o cliente tem uma cor definida (`client.color`), usa essa cor.
- Caso contrário, usa a cor da coluna (fase).
- Isso dá identidade visual imediata por cliente.

---

## 4. Estados do Card

### 4.1 Normal (Default)
```css
background: var(--ds-surface-2);
border: 1px solid rgba(255,255,255,0.07);
border-radius: var(--radius-lg);
```

### 4.2 Hover
```css
box-shadow: 0 8px 24px rgba(0,0,0,0.3);
```

A transição é suave: `transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease;`

### 4.3 Dragging (sendo arrastado)
```css
background: var(--ds-surface-3);
transform: rotate(2deg) scale(1.02);
z-index: 999;
```

### 4.4 Atrasado (overdue)
```css
box-shadow: 0 0 0 2px var(--ds-error), 0 4px 16px rgba(239, 68, 68, 0.15);
```

No hover:
```css
box-shadow: 0 0 0 2px var(--ds-error), 0 8px 24px rgba(239, 68, 68, 0.25);
```

### 4.5 Finalizado / Concluído

O card concluído permanece visualmente ativo (não reduz opacidade), mas os botões "Finalizar" e "Cancelar" são ocultados.

---

## 5. Paleta de Cores (Café com BPO)

As cores abaixo são extraídas do design system (`:root` em `index.css`):

| Token | Valor | Uso |
|-------|-------|-----|
| `--ds-black` | `#000000` | Background da página |
| `--ds-surface` | `#111111` | Superfície de cards, sidebar |
| `--ds-surface-2` | `#222222` | Superfície elevada (card body) |
| `--ds-primary` | `#FBBF24` | Destaques, botões primários, acentos |
| `--ds-primary-dark` | `#d4a017` | Hover/dark do primary |
| `--ds-primary-text` | `#000000` | Texto sobre primary |
| `--ds-text` | `#FFFFFF` | Texto principal |
| `--ds-text-muted` | `rgba(255,255,255,0.55)` | Texto secundário |
| `--ds-text-subtle` | `rgba(255,255,255,0.35)` | Texto terciário |
| `--ds-error` | `#ef4444` | Erro, atraso, cancelar |
| `--ds-success` | `#22c55e` | Sucesso, finalizar |
| `--ds-warning` | `#FBBF24` | Alerta, prioridade média |

### Cores de Cliente (Dinâmicas)

Cada cliente pode ter uma cor própria armazenada no backend. O card usa `client.color` como fallback da borda esquerda.

---

## 6. Tipografia

| Elemento | Font | Weight | Size | Line Height |
|----------|------|--------|------|-------------|
| Cliente | Inter | 900 | 10px | 1.2 |
| Título | Inter | 600 | 14px | 1.4 |
| Botões ação | Inter | 700 | — | — |
| Badge atraso | Inter | 700 | 10px | 1.2 |
| Deadline | Inter | 400 | 11px | 1.4 |
| Metadados | Inter | 400 | 10px | 1.4 |
| Contador coluna | Inter | 700 | 10px | 1.2 |

A família padrão é `'Inter', -apple-system, sans-serif`.

---

## 7. Filtros

### 7.1 Filtro por Fase

Localizado acima do Kanban.

| Elemento | Estilo |
|----------|--------|
| Label | `font-size: 11px; font-weight: 700; color: var(--ds-text-muted)` |
| Select | `background: var(--ds-surface-2); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 4px 8px; color: var(--ds-text); font-size: 12px` |
| Opções | "Todas" (default) + lista de fases ordenadas |

**Estado**: `phaseFilter` (string), default `'all'`.

**Comportamento**: filtra `tasks.filter(t => phaseFilter === 'all' || t.phase_id === phaseFilter)`.

### 7.2 Filtro por Data (Datepicker — Dia ou Período)

**Layout**: dois inputs de data lado a lado com labels "De" e "Até".

| Elemento | Estilo |
|----------|--------|
| Label "De" | `font-size: 11px; font-weight: 700; color: var(--ds-text-muted)` |
| Input "De" | `type="date"`, `value={dateFrom}`, `onChange → setDateFrom` |
| Label "Até" | Mesmo estilo |
| Input "Até" | `type="date"`, `value={dateTo}`, `onChange → setDateTo` |
| Botão "Limpar filtros" | `font-size: 11px; color: var(--ds-primary); background: none; border: none; cursor: pointer; font-weight: 700` |

**Estados**:
- **Nenhum selecionado**: mostra todos os cards
- **Apenas "De"**: cards com deadline >= `dateFrom`
- **Apenas "Até"**: cards com deadline <= `dateTo`
- **"De" + "Até"**: cards com deadline entre as duas datas
- **Botão "Limpar"**: aparece apenas quando há filtro ativo, reseta `dateFrom`, `dateTo` e `phaseFilter`

### 7.3 Section Filter (Tabs)

Filtros rápidos acima do Kanban:

| Tab | Descrição | Ícone | Contador |
|-----|-----------|-------|----------|
| Todas | Sem filtro | — | — |
| Hoje | Deadline = hoje | — | ✅ |
| Em andamento | Fase "Em Andamento" ou status `doing` | — | ✅ |
| Atrasadas | Deadline < hoje (não concluídas) | — | ✅ |

Visual: tabs em `display: flex` com `background: var(--ds-surface-2)`, active state com `background: var(--ds-surface); color: var(--ds-primary)`.

---

## 8. Responsividade

### 8.1 Grid de Colunas Kanban

Atualmente as colunas usam `grid-template-columns: repeat(N, 1fr)` onde N é o número de fases.

**Breakpoints planejados**:

| Largura | Grid |
|---------|------|
| > 1200px | `repeat(N, 1fr)` (N colunas) |
| 900px – 1200px | `repeat(auto-fit, minmax(280px, 1fr))` |
| < 900px | `1fr` (coluna única com scroll horizontal) |

### 8.2 Card em Mobile

- Padding: reduz de 16px → 12px
- Título: mantém 14px
- Botões de ação: mantêm 28×28px (touch target mínimo)
- Badge de atraso: mantém tamanho
- Metadados: podem ser ocultados em telas < 480px

---

## 9. Comportamento Drag & Drop

Biblioteca: `@hello-pangea/dnd`.

- **Drag handle**: o card inteiro (via `{...provided.dragHandleProps}`)
- **Ao soltar**: `onDragEnd` dispara `updateTaskStatus.mutate({ id, phase_id: destination.droppableId })`
- **Drop zone**: cada coluna Kanban é um `Droppable`
- **Visual feedback**: coluna alvo ganha classe `kanban-column--dragging-over` (background mais claro)

---

## 10. Acessibilidade

| Requisito | Implementação |
|-----------|---------------|
| Contraste mínimo | Cards: #222222 bg com texto branco (#FFFFFF) → ratio 15.3:1 (AAA) |
| Foco visível | Botões têm `outline` ou `border` no focus |
| ARIA labels | Botões devem ter `aria-label` nos ícones-only |
| Tooltips | `title` nos botões de ação descreve a ação |
| Ordem de tabulação | Botões de ação → card → drop zone |
| Touch target | Botões ≥ 28×28px (ideal 44px) |
| Drag & Drop | Suporte a teclado (nativo do `@hello-pangea/dnd`) |

---

## 11. Animações

| Elemento | Animação | Duração | Timing |
|----------|----------|---------|--------|
| Card hover | `box-shadow` + `transform` | 0.2s | ease |
| Card dragging | `rotate(2deg) scale(1.02)` | 0.2s | cubic-bezier |
| Kanban fade in | `panelFadeIn` | 0.4s | ease-out |
| Slide in (macro calendar) | `slideInRight` | 0.3s | ease-out |
| View toggle active | `background` + `color` | 0.2s | ease |

---

## 12. Nomenclatura de Classes e Componentes

### CSS Classes (existentes + propostas)

| Classe | Elemento |
|--------|----------|
| `.task-card` | Card individual |
| `.task-card--overdue` | Card com atraso |
| `.kanban-column` | Coluna do Kanban |
| `.kanban-column--dragging-over` | Coluna recebendo drag |
| `.overdue-badge` | Badge de atraso |
| `.finalize-btn` | Botão finalizar |
| `.cancel-btn` | Botão cancelar |
| `.vt-btn` | View toggle / tab button |
| `.vt-btn.active` | View toggle ativo |

### Componentes React

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `TasksPage` | `pages/panel/TasksPage.tsx` | Página principal com filtros e grid |
| `TaskKanban` | `pages/panel/TasksPage.tsx` | Grid de colunas com drag & drop |
| `TaskCalendar` | `pages/panel/TasksPage.tsx` | Visão calendário |
| `TaskTimeline` | `pages/panel/TasksPage.tsx` | Visão timeline |
| `TaskModal` | `components/tasks/TaskModal.tsx` | Modal de edição/criação |
| `PhaseManager` | `components/tasks/PhaseManager.tsx` | Gerenciador de fases |
| `TaskCard` | **(proposto)** | Extrair card para componente próprio |

---

## 13. Próximos Passos (Implementação)

1. [x] **Extrair `TaskCard` para componente próprio** em `components/tasks/TaskCard.tsx`
2. [x] **Converter botões para ícone-only** (Finalizar: `Check`, Cancelar: `XCircle`)
3. [x] **Adicionar tooltips** (`title` + `aria-label`) nos botões de ação
4. [x] **Melhorar datepicker** com wrapper estilizado + `color-scheme: dark`
5. [x] **Adicionar suporte a período** (presets: "Hoje", "Semana", "Mês")
6. [x] **Responsividade do grid Kanban** (auto-fit + scroll horizontal em mobile)
7. [x] **Testes** (Vitest) para o componente `TaskCard` (21 testes)

---

## 14. Referências

- Design System: `apps/frontend/src/index.css` (tokens)
- Panel Styles: `apps/frontend/src/panel.css`
- Código atual: `apps/frontend/src/pages/panel/TasksPage.tsx`
- Imagem de referência: `docs/image-1.png`
