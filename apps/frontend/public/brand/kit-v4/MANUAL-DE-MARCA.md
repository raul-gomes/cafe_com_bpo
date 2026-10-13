# Café com BPO — manual de trabalho V4

Ghuto César define e aprova a estética. Este é o manual corrente; substitui as orientações visuais V3/V3.1/V3.2/V3.3 quando houver conflito. O kit é completo para reutilizar o que foi construído, e permanece em desenvolvimento estético.

## Direção e decisões

A referência é matéria de trabalho: caderno, ficha, arquivo, documento e conversa. Tecnologia aparece em passagens de composição; valores e ações continuam claros.

| Elemento | Estado | Regra |
|---|---|---|
| Logo original e transparência | Requisito | Preservar desenho; versão por contraste |
| Seis atmosferas | Requisito | Café/verde/azul, light/dark |
| Aba de fichário | Direção bem recebida por Ghuto | Orienta ações documentais de destaque; ajustes ainda revisáveis |
| Recorte e trilho | Alternativas | Uso pontual, sem competir com fichário |
| Menu lateral/setas/drawer | Implementado para avaliação | Mesmo significado nos tamanhos; teclado e estado explícito |
| 48 ícones | Biblioteca candidata | Operação conhecida + família café para composição |
| Vidro, pixels, grão, luz, esfumaçado | Experimentos | Compor cenas; não aplicar atrás de toda tabela |
| Cartelas/storyboard | Estruturas de trabalho | Não são vídeo final exportado |

Pesquisa de referência não determina gosto. A revisão crítica é responsabilidade de quem projeta, e não vira conteúdo da interface do produto.

## Logo

Colorida para assinatura reconhecível sobre fundo com contraste; preta em superfície clara/uma tinta; branca em superfície escura. Na UI, colorida no claro e branca no escuro é o ponto de partida. Fotografia exige escolha pela região de fundo. Não recolorir a versão colorida pela família de UI.

Sem caixa branca involuntária. Área de proteção proposta: altura da linha COM BPO em cada lado. Largura digital inicial de 140 px: conferir a leitura na aplicação real. Não há símbolo compacto oficial aprovado. SVGs/PNGs transparentes são derivados do raster original para tela; master vetorial e mínimos de impressão ainda precisam do original de criação.

## Temas, tipo e leitura

CSS de base + cafe-themes.css são a fonte dos tokens. data-cafe-palette aceita cafe, verde, azul; data-cafe-mode aceita light, dark. Cada escuro recebe fundos da sua família. --cafe-brand-yellow conserva #FFC72C; --cafe-accent é a ação da família. --cafe-module orienta módulo; --cafe-success/warning/danger orientam estado com palavras.

DM Sans é a tipografia operacional: menus, campos, status, tabela e números. Newsreader é editorial: abertura, apresentação, citação e cartela. Pesos e escala vêm do CSS. Números tabulares para comparar; dinheiro com moeda e periodicidade. Não usar textura forte atrás de dados ou texto contínuo. Fontes locais com suas licenças acompanham o kit.

## Botões, linhas e profundidade

Fichário: contorno 1 px, margem de acento 3 px, aba superior de 10 px e sombra de 4 px. A aba conecta o gesto aos documentos. cafe-command + cafe-command-tab. Uma ação principal por contexto; não repetir fichário em todos os comandos secundários. Controles menores ou secundários podem usar cafe-button.

Recorte: canto 16 px, divisão 1 px e base 3 px; alternativa direta. Trilho: linha 2 px/acento 4 px, tipografia editorial; pode se parecer com um link, preferir composição e apresentação. Nenhuma alternativa é obrigatória.

Linhas gerais: 1 px para detalhes/tabelas; 2 px para agrupar; 4 px para sinal de marca em seção, margem ou cartela. Ajustar em vídeo à escala e resolução. Não aplicar borda grossa em cada campo.

Excluir: superfície neutra, texto claro, margem de risco. Uma exclusão real pede identificação do item e confirmação apropriada. Salvando: opacidade 1, rótulo e progresso; bloqueia repetição. Indisponível é outro estado. Foco visível não depende de brilho ou sombra.

## Navegação e ícones

Menu lateral de 240 px no desktop; 76 px recolhido. Rótulo acessível continua presente no modo compacto. Uma seta flutuante atravessa a margem; alvo 44 px. No celular, drawer com diálogo nativo, título, fechar e Escape. Navegação deve conservar seção ativa, contexto e acesso constante às tarefas.

Menu amplo é uma experiência editorial; não é substituição obrigatória da navegação operacional. Ações flutuantes recebem rótulo/contexto, aria-expanded e fechamento previsível. Não esconder ação principal atrás delas.

48 ícones: 42 de operação e navegação + 6 de café. Matriz de 24, traço 1,6, terminações e ritmo comuns; aberturas pequenas como gesto da família. Em 16 px conferir leitura óptica; não presumir que simples escala resolve. Xícara, grão, vapor, coador, pausa e conversa de café entram em comunidade/composição. Conta, pagamento e nota mantêm significado reconhecível. Usar rótulo nas funções; controles só com ícone precisam de aria-label.

## Matéria e movimento

Plano limpo para operação. Grão/pauta para apresentação. Esfumaçado tem origem e direção na cena. Luz é borda/linha pontual; placa fosca cria camada. Evitar acumulação automática de grão, fumaça, vidro e brilho. Aprovar a composição inteira.

Resposta de controle: 120–180 ms. Entrada de camada: 800 ms. Atmosfera: 1.800 ms. Dissolução: 2.500 ms, sem loop, superfície original coexistindo com máscara progressiva e pequenos fragmentos da mesma região. A captura dos fragmentos reproduz cor e texto de um painel simples; não é uma biblioteca de screenshot de qualquer HTML. Não aplicar a dados financeiros que precisam permanecer presentes.

Recomposição suave de 500 ms; interrupção limpa. Movimento reduzido entrega o estado sem partículas ou transições. Prefira efeito após gesto explícito e repouso final. Letras entram por palavra em aberturas, não em campos, tabelas e alertas.

## Peças, vídeos e documentos

Cartelas: abertura, identificação de pessoa, dados e encerramento. Storyboard de nove segundos em 16:9 e 9:16. Proposta imprimível em HTML. SVGs de placa, luz e esfumaçado: camadas transparentes 1920 × 1080. O SVG da placa não desfoca o vídeo atrás; configurar o desfoque no editor de vídeo. As camadas entregues usam café/amarelo; adaptar deliberadamente à família escolhida.

Vídeos exportados, trilha, fotografia e master de impressão não foram produzidos nesta etapa. Novas peças precisam de composição, áreas seguras do destino e tempo de leitura; não transformar um print do app em template universal.

## Continuidade

Leia INSTRUCAO-PARA-NOVOS-PROJETOS.md. Reutilize código/assets; atualize uma versão central do kit em vez de criar bases concorrentes para cada aplicativo. CSS de demonstração não é CSS de produto. backend, regras financeiras e permissões pertencem ao projeto específico.

Registrar futuras decisões: escolhido/ajustado/descartado, data e comentário de Ghuto, exemplo e limite. DECISOES-V4.json acompanha o estado corrente. Verificar seis atmosferas, celular, teclado, contraste e redução de movimento. Verificação técnica não substitui a aprovação estética.