# Guia técnico — kit Café com BPO V4

Esta é a orientação corrente. COMECE-AQUI.md atende ao usuário; este guia atende à implementação. Sem dependências de framework. Fontes locais em fonts/.

## Ordem de CSS

1. cafe-design-system.css: tokens/base/componentes.
2. cafe-themes.css: seis atmosferas e ajustes de estado.
3. cafe-expression.css: fichário, recorte, trilho, matéria e movimento.
4. cafe-navigation.css: menu lateral, drawer e setas flutuantes.

Use body class cafe-theme. No html, data-cafe-palette=cafe|verde|azul e data-cafe-mode=light|dark. theme-init.js é um exemplo de preferência local; adapte ao perfil do aplicativo. Suas paletas não mudam o desenho do logo.

## JavaScript de produto

- cafe-navigation.js: expansão, drawer e ações flutuantes. data-cafe-collapse no botão dentro de cafe-workspace; data-cafe-drawer e data-cafe-fan apontam para IDs únicos. Não muda dados de negócio.
- cafe-motion.js: new CafeDissolve(panel,canvas,status). play() e restore(animate). Usa o painel DOM simples, uma máscara e fragmentos do mesmo plano. Canvas precisa estar dentro do contêiner da composição. Usa movimento reduzido automaticamente.

catalogo.js, manual.js, expressao.js e identidade.js são da demonstração. Não transportar como lógica financeira. NOVO-PROJETO.html mostra um começo de app com as dependências mínimas e comentários de integração.

## Classes principais

Layout: cafe-container, cafe-stack, cafe-cluster, cafe-grid-2/3/4, cafe-main-aside.
Tipo: cafe-app-title, cafe-headline, cafe-display, cafe-lead, cafe-caption, cafe-mono.
Ações: cafe-button + primary/secondary/text/module/danger; cafe-command + cafe-command-tab/cut/rail.
Campos: cafe-field, cafe-field-label, cafe-input, cafe-select, cafe-textarea, cafe-input-group, cafe-check.
Dados: cafe-table-scroll, cafe-table, cafe-stat-number, cafe-tag, cafe-alert, cafe-empty, cafe-progress.
Navegação V4: cafe-workspace, cafe-rail, cafe-rail-link, cafe-workspace-content, cafe-floating-arrow, cafe-fan-panel.
Proposta: cafe-document, cafe-document-header, cafe-document-total.
Composição: cafe-frost, cafe-pixel-canvas, cafe-texture-paper/rule, cafe-steam, cafe-light-seam.

Sprite icones-assinatura.svg: usar use href=icones-assinatura.svg#ID em servidor. Ícones individuais em icones/. Lista em icones-manifesto.json. O catálogo e a tela inicial incorporam os symbols para visualização local. Preserve rótulos; ícone isolado exige nome acessível.

## Integração e revisão

Links navegam, botões executam ações. Campos têm label; placeholder não substitui rótulo. Erros vinculados por aria-describedby, aria-invalid só no estado real. Dinâmicas anunciadas por role=status. Dados/estado com palavra além da cor. Diálogos têm título e fechamento. Tabelas têm caption, cabeçalhos e scroll limitado à região no celular.

A camada temática ajusta salvar em andamento: opacidade 1. Atributos nativos disabled/aria-busy precisam ser controlados pela lógica real. Cor de módulo não presume texto branco em todas as atmosferas. Confira pares efetivamente renderizados.

Não carregar catalogo.css, expressao.css, manual.css ou identidade.css como base de produto: são layouts de catálogo. Em uma nova aplicação, crie o layout sobre os quatro CSS de produto e os tokens.

Sirva fontes/CSS/SVGs no mesmo projeto. O kit inclui fontes e licenças; preserve os arquivos. A proposta-exemplo.html tem perfil próprio de impressão: conferir A4/paginação antes de uma proposta real.

A regra de criação está em INSTRUCAO-PARA-NOVOS-PROJETOS.md. Este guia não define outra paleta, aprovação ou proibição de efeitos.