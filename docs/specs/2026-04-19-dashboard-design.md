# Design Spec: Central de Comando (Dashboard)

**Data:** 2026-04-19
**Status:** Em Revisão
**Autor:** Antigravity AI

## 1. Objetivo
Criar uma página inicial unificada para usuários logados na plataforma Café com BPO, focada em produtividade e engajamento social. A página deve priorizar tarefas críticas e centralizar interações do fórum (Network).

## 2. Requisitos de Usuário
- **Redirecionamento Pós-Login:** Todo usuário autenticado deve cair nesta página ao acessar `/painel`.
- **Atenção Imediata (Tarefas):** Exibir tarefas vencidas ou com vencimento em até 3 dias.
- **Feed de Atividades:** Mostrar notificações de comentários em posts do usuário e atualizações do sistema.
- **Ações Rápidas:** Permitir concluir tarefas e responder comentários sem sair da Home.

## 3. Arquitetura de Software

### 3.1. Frontend (React + Vite)
- **Componente:** `DashboardPage.tsx`
- **Sub-componentes:**
    - `UrgentTasksRail`: Carrossel ou lista horizontal de tarefas críticas.
    - `ActivityFeed`: Lista vertical cronológica de notificações e comentários.
    - `QuickReplyInput`: Pequeno formulário de texto para respostas rápidas no fórum.

### 3.2. Backend (FastAPI)
- **Novo Módulo:** `src/modules/dashboard`
- **Endpoint Principal:** `GET /api/dashboard/summary`
    - Retorna um objeto JSON contendo:
        ```json
        {
          "urgent_tasks": [...],
          "activities": [...],
          "stats": { "pending_budgets": 5, "active_projects": 2 }
        }
        ```
- **Lógica de Busca:**
    - Tarefas: Filtro por `user_id`, `status != 'done'` e `deadline` entre (agora - 7 dias) e (agora + 3 dias).
    - Atividades: Busca na tabela `notifications` (vinculada a `discussion_comments`).

## 4. UI/UX (Design Visual)
- **Cores:** Manter o sistema "Yellow" (Preto, Branco e Amarelo Vibrante #FFD700).
- **Cards de Tarefas:** Bordas arredondadas, sombra suave, badge de "Atrasado" em vermelho ou "Próximo" em amarelo.
- **Feed:** Design limpo com linhas divisórias sutis e tipografia clara (Inter/Roboto).

## 5. Plano de Rotas
1. `/painel` -> `DashboardPage` (Home do Usuário)
2. `/painel/orcamentos` -> `OrcamentosPage` (Antiga Home)
3. `/painel/forum` -> `NetworkPage` (Fórum completo)
