# PRD Macro – Plataforma Café com BPO

## 1. Visão geral do produto

O Café com BPO é uma comunidade para operadores de BPO financeiro que rejeitam fórmulas mágicas e buscam prática real, bastidores e discussão honesta sobre operação e precificação.

O projeto atual transforma o site em uma plataforma com três pilares:
- **Site público** para posicionamento, conteúdo institucional e aquisição de novos membros.
- **Calculadora de precificação** aberta, usada como gerador de valor e de leads.
- **Área de membros autenticada**, concentrando comunidade, conteúdos e ferramentas (incluindo uma versão avançada da calculadora).

Toda a solução será implementada em um **monorepo** com backend, frontend e infraestrutura Docker, com deploy em uma VPS da Hostinger.

---

## 2. Objetivos do projeto

- Explicar com clareza, em poucos segundos, o que é o Café com BPO e para quem ele existe.
- Aumentar a conversão de visitantes em leads e membros pagantes por meio da calculadora de precificação e de uma home mais objetiva.
- Criar uma área de membros escalável para receber novas ferramentas e conteúdos ao longo do tempo.
- Centralizar fluxo de autenticação, dados de usuários e cenários de precificação em uma arquitetura sólida e fácil de manter (monorepo + Docker + VPS Hostinger).

---

## 3. Público-alvo e posicionamento

### 3.1 Público principal

- Donos e operadores de BPO financeiro.
- Contadores e profissionais de finanças que prestam serviços recorrentes.
- Profissionais que sentem na prática o peso da operação, da precificação e da solidão na tomada de decisão.

### 3.2 Posicionamento

- Tom de voz anti-guru, anti-hype e pró "ética do trabalho real".
- Enfoque em mostrar cicatrizes, erros, testes e decisões difíceis de operação, não apenas cases polidos.
- Comunidade e ferramentas como um "laboratório de sobrevivência" do BPO financeiro, não como promessa de sucesso instantâneo.

Implica em um design sóbrio, copy direta e foco em utilidade – evitando estética típica de lançamentos e promessas exageradas.

---

## 4. Arquitetura macro do sistema

### 4.1 Monorepo

O projeto será organizado em um monorepo, por exemplo:

- `apps/backend/` – API, autenticação, lógica de negócios, cálculo e geração do relatório da calculadora.
- `apps/frontend/` – site público, área de membros, páginas e componentes de UI.
- `packages/` (opcional) – bibliotecas compartilhadas (tipos, regras de negócio, helpers de cálculo, etc.).
- Arquivos de infraestrutura na raiz (`docker-compose.yml`, Dockerfiles, scripts de deploy).

### 4.2 Serviços Docker

A stack será empacotada com Docker e orquestrada com Docker Compose:

- **web** (frontend):
  - Build do app frontend.
  - Serve site público e área de membros.

- **api** (backend):
  - Exposição de API para autenticação, CRUD de usuários, cenários de precificação, cálculo e geração de relatórios.

- **db** (banco de dados relacional):
  - Armazena usuários, cenários, registros de uso e demais entidades.
  - Container com volume para persistência.

- (Opcional) **proxy** (Nginx/Caddy):
  - Terminação TLS, roteamento `/` → frontend, `/api` → backend.

### 4.3 Deploy em VPS Hostinger

- Ambiente alvo: VPS Linux com Docker instalado.
- Uso de Docker Compose/Docker Manager da Hostinger para subir `web`, `api` e `db` com um único manifesto.
- Configurações sensíveis via variáveis de ambiente.
- Processo de deploy pensado para se integrar facilmente com CI/CD (por exemplo, GitHub Actions chamando o servidor da VPS para atualizar o compose).

---

## 5. Macro das áreas do produto

### 5.1 Site público

**Objetivo:** posicionar o Café com BPO, explicar a proposta de valor e capturar interesse (principalmente via calculadora de precificação e CTA de comunidade).

Principais páginas:

- **Home**
  - Hero com headline forte e clara, subheadline explicando a essência da comunidade e CTA principal (entrar na comunidade / acessar calculadora).
  - Sessão "Para quem é / Para quem não é".
  - Manifesto (zona livre de gurus, foco em bastidores e trabalho real).
  - Sobre o anfitrião (contexto e autoridade, mas mantendo o posicionamento de "par de trincheira").
  - Benefícios da comunidade (o que o membro ganha depois de entrar).
  - Destaque da área de membros e das ferramentas (especialmente a calculadora).
  - FAQ.

- **Login / Cadastro** (`/login` ou `/entrar`)
  - Login por e-mail/senha.
  - Login social (Google/Gmail e Microsoft/Outlook).
  - Fluxos de criação de conta e recuperação de senha.

- **Página pública da Calculadora** (`/calculadora-de-precificacao`)
  - Explica rapidamente o objetivo da ferramenta.
  - Formulário em etapas com campos simplificados, inspirado na planilha interna.
  - Geração de um relatório HTML na tela com o resultado da precificação.
  - Call-to-action para baixar/salvar o relatório – exigindo login na plataforma.

### 5.2 Área de membros (app web)

**Objetivo:** concentrar valor contínuo para o assinante: comunidade, conteúdos e ferramentas.

Macro do menu de navegação (pode ser lateral ou superior):

- **Dashboard**
  - Visão geral: boas-vindas, atalhos para calculadora, conteúdos recentes e link para comunidade.

- **Ferramentas**
  - Lista de ferramentas disponíveis.
  - **Calculadora de Precificação** (versão avançada, com histórico e cenários salvos).

- **Conteúdos**
  - Biblioteca de vídeos, aulas e materiais, com filtros básicos.

- **Comunidade**
  - Links/detalhes da comunidade (WhatsApp/Discord/etc.).
  - Regras e expectativas.

- **Biblioteca**
  - Modelos, checklists, planilhas e recursos úteis.

- **Suporte**
  - FAQ, canais de contato e orientações.

- **Perfil**
  - Dados pessoais, preferências, conexões de login social.

---

## 6. Macro da calculadora de precificação

### 6.1 Versão pública (sem login obrigatório)

**Roteiro de uso:**

1. Usuário acessa a rota pública da calculadora.
2. Informa dados essenciais da operação (custos internos, equipe, horas, alíquota de tributo).
3. Seleciona serviços prestados ao cliente (por exemplo: emissão de NF, boletos, registros de pagamentos/recebimentos, reunião mensal, etc.) e informa tempo e quantidade.
4. Define o percentual de lucro desejado.
5. O sistema calcula custo total, lucro, tributo estimado e valor final sugerido da mensalidade.
6. Um relatório HTML é exibido na tela com resumo e detalhamento dos cálculos.
7. Para baixar o relatório (PDF) ou salvar o cenário, o usuário é convidado a criar conta ou fazer login no Café com BPO.

### 6.2 Versão membros (dentro da área logada)

A versão interna da calculadora reaproveita a lógica da pública, mas adiciona:

- Histórico de cenários salvos por cliente.
- Edição e duplicação de cenários para simular reajustes.
- Organização por nome de cliente, segmento ou porte.
- Download de relatórios em PDF ou formato adequado para anexar a propostas.

Fluxos principais dentro da área logada:

- Acessar lista de cenários de precificação.
- Criar novo cenário.
- Abrir relatório de um cenário existente.
- Duplicar cenário para simular mudanças.
- Excluir cenários.

---

## 7. Fluxos de autenticação (macro)

- Login/cadastro unificados em uma experiência simples.
- Suporte a:
  - Login tradicional (e-mail/senha).
  - Login com Google (Gmail).
  - Login com Microsoft (Outlook).
- Após login bem-sucedido:
  - Redirecionar para o Dashboard.
  - Caso o usuário venha da calculadora pública, associar o cenário atual à conta e permitir o download imediato.

---

## 8. Requisitos não funcionais (alto nível)

- **Performance:** páginas públicas rápidas, com foco em carregamento leve e uso cuidadoso de imagens.
- **Responsividade:** experiência first-class em mobile, sem comprometer clareza do conteúdo.
- **Acessibilidade:** contraste adequado, navegação por teclado, textos alternativos em imagens importantes.
- **Segurança:** autenticação segura, criptografia adequada de senhas e proteção das rotas de API.
- **Escalabilidade:** monorepo e arquitetura em serviços Docker preparada para evolução (novas ferramentas, mais conteúdo, mais usuários).

---

## 9. Roadmap macro (fases sugeridas)

1. **Fase 1 – Fundamentos da plataforma**
   - Setup do monorepo, containers (web, api, db) e deploy inicial na VPS Hostinger.
   - Implementação do login/cadastro e da área de membros vazia (apenas estrutura).

2. **Fase 2 – Calculadora pública + membros**
   - Construção da calculadora pública com relatório HTML.
   - Gating de download/salvamento via login.
   - Integração da versão avançada da calculadora na área de membros (cenários salvos).

3. **Fase 3 – Home e experiência de aquisição**
   - Refatoração da home para alinhar comunicação, posicionamento e CTAs ao novo produto.
   - Ajustes finos de copy, SEO e performance.

4. **Fase 4 – Expansão de conteúdo e ferramentas**
   - Estruturar melhor Conteúdos, Biblioteca e novas ferramentas conforme feedback da comunidade.
