import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import React, { Suspense } from 'react'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PanelLayout } from './components/panel/PanelLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminRoute } from './components/auth/AdminRoute'
import { UpgradeProvider } from './components/ui/UpgradeModal'
import { PublicShell } from './components/auth/LoginDialogContext'

// ── Lazy-loaded pages (default exports — use React.lazy) ─────────
const HomePage = React.lazy(() => import('./pages/HomePage'))
const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const CadastroPage = React.lazy(() => import('./pages/CadastroPage'))
const SimulatorPage = React.lazy(() => import('./pages/SimulatorPage'))
const UnderConstructionPage = React.lazy(() => import('./pages/UnderConstructionPage'))
const ProposalPreviewPage = React.lazy(() => import('./pages/ProposalPreviewPage'))
const PublicProposalPage = React.lazy(() => import('./pages/PublicProposalPage'))
const DesignSystemPage = React.lazy(() => import('./pages/panel/DesignSystemPage'))
const PlansPage = React.lazy(() => import('./pages/panel/PlansPage'))
const CafesPage = React.lazy(() => import('./pages/CafesPage'))
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'))
const LegalPage = React.lazy(() => import('./pages/LegalPage'))

// ── Suspense wrapper ─────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="size-8 rounded-full border-[3px] border-border border-t-primary animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  )
}

// ── Router definition ────────────────────────────────────────────
/**
 * Monta o array de rotas aplicação. O `UpgradeProvider` vive na raiz (layout
 * sem path) — DENTRO do Router — porque o modal renderiza um `<Link>` "Assinar"
 * que precisa do contexto de Router; fora dele (ex.: wrapper no `App.tsx`) o
 * modal abre em um erro `Cannot destructure property 'basename'...` (tela preta
 * ao clicar em criar, ver regressão em `test/UpgradeModalRouter.test.tsx`).
 *
 * @returns array de rotas para `createBrowserRouter`/`createMemoryRouter`
 */
export async function buildRoutes() {
  // Named-export pages are loaded dynamically inside the async function
  const { OAuthCallbackPage } = await import('./pages/OAuthCallbackPage')
  const { InvitationAcceptPage } = await import('./pages/InvitationAcceptPage')
  const { ForgotPasswordPage } = await import('./pages/ForgotPasswordPage')
  const { ResetPasswordPage } = await import('./pages/ResetPasswordPage')
  const { DashboardPage } = await import('./pages/panel/DashboardPage')
  const { OrcamentosPage } = await import('./pages/panel/OrcamentosPage')
  const { OrcamentoNovoPage } = await import('./pages/panel/OrcamentoNovoPage')
  const { OrcamentoDetalhadoPage } = await import('./pages/panel/OrcamentoDetalhadoPage')
  const { PerfilPage } = await import('./pages/panel/PerfilPage')
  const { GaleriaArquivosPage } = await import('./pages/panel/GaleriaArquivosPage')
  const { NetworkPage } = await import('./pages/panel/NetworkPage')
  const { NetworkPostPage } = await import('./pages/panel/NetworkPostPage')
  const { MemberProfilePage } = await import('./pages/panel/MemberProfilePage')
  const { ConversationPage } = await import('./pages/panel/ConversationPage')
  const { ProjectGroupPage } = await import('./pages/panel/ProjectGroupPage')
  const { TasksPage } = await import('./pages/panel/TasksPage')
  const { EmpresasPage } = await import('./pages/panel/EmpresasPage')
  const { ContatosPage } = await import('./pages/panel/ContatosPage')
  const { ProspectosPage } = await import('./pages/panel/ProspectosPage')
  const { GovernancaPage } = await import('./pages/panel/GovernancaPage')
  const { ContratosPage } = await import('./pages/panel/ContratosPage')
  const { ContratoDetalhePage } = await import('./pages/panel/ContratoDetalhePage')
  const { VisualizarContratoPage } = await import('./pages/panel/VisualizarContratoPage')
  const { PaymentsPage } = await import('./pages/panel/PaymentsPage')
  const { TemplateListPage } = await import('./pages/panel/TemplateListPage')
  const { TemplateDetailPage } = await import('./pages/panel/TemplateDetailPage')
  const { UnderConstructionPanelPage } = await import('./pages/panel/UnderConstructionPanelPage')
  const { ProjetosPage } = await import('./pages/panel/ProjetosPage')
  const { ProjetoDetalhePage } = await import('./pages/panel/ProjetoDetalhePage')
  const { SettingsPage } = await import('./pages/panel/SettingsPage')
  const { LessonsPage } = await import('./pages/panel/LessonsPage')
  const { BetaSignupsPage } = await import('./pages/panel/BetaSignupsPage')
  const { AdminHomePage } = await import('./pages/panel/admin/AdminHomePage')
  const { AdminAnnouncementsPage } = await import('./pages/panel/admin/AdminAnnouncementsPage')
  const { AdminLessonsPage } = await import('./pages/panel/admin/AdminLessonsPage')
  const { AdminSitePage } = await import('./pages/panel/admin/AdminSitePage')
  const { AdminUsersPage } = await import('./pages/panel/admin/AdminUsersPage')

  return [
    {
      element: (
        <UpgradeProvider>
          <Outlet />
        </UpgradeProvider>
      ),
      children: [
    {
      // Public pages: shared header and the login dialog (PublicShell).
      element: <PublicShell />,
      children: [
        {
          path: '/',
          element: <SuspenseWrapper><HomePage /></SuspenseWrapper>,
        },
        {
          path: '/login',
          element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
        },
        {
          path: '/cadastro',
          element: <SuspenseWrapper><CadastroPage /></SuspenseWrapper>,
        },
        {
          path: '/simulador',
          element: <SuspenseWrapper><SimulatorPage /></SuspenseWrapper>,
        },
        {
          path: '/proposta',
          element: <SuspenseWrapper><ProposalPreviewPage /></SuspenseWrapper>,
        },
        {
          path: '/orcamento/:hash',
          element: <SuspenseWrapper><PublicProposalPage /></SuspenseWrapper>,
        },
        {
          path: '/em-construcao',
          element: <SuspenseWrapper><UnderConstructionPage /></SuspenseWrapper>,
        },
        {
          // New name of the calculator (the old /simulador address keeps working).
          path: '/precificacao',
          element: <SuspenseWrapper><SimulatorPage /></SuspenseWrapper>,
        },
        {
          path: '/cafes',
          element: <SuspenseWrapper><CafesPage /></SuspenseWrapper>,
        },
        {
          path: '/produtos',
          element: <SuspenseWrapper><ProductsPage /></SuspenseWrapper>,
        },
        {
          path: '/termos-de-uso',
          element: <SuspenseWrapper><LegalPage document="terms" /></SuspenseWrapper>,
        },
        {
          path: '/politica-de-privacidade',
          element: <SuspenseWrapper><LegalPage document="privacy" /></SuspenseWrapper>,
        },
      ],
    },
    {
      path: '/auth/callback',
      element: <SuspenseWrapper><OAuthCallbackPage /></SuspenseWrapper>,
    },
    {
      path: '/esqueci-minha-senha',
      element: <SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper>,
    },
    {
      path: '/redefinir-senha',
      element: <SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>,
    },
    {
      path: '/invitations/accept',
      element: <SuspenseWrapper><InvitationAcceptPage /></SuspenseWrapper>,
    },
    {
      path: '/dashboard',
      element: <Navigate to="/painel" replace />,
    },
    {
      path: '/painel',
      element: <ProtectedRoute />,
      children: [
        {
          path: '',
          element: <ErrorBoundary><PanelLayout /></ErrorBoundary>,
          children: [
            {
              path: '',
              element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
            },
            {
              path: 'orcamentos',
              element: <SuspenseWrapper><OrcamentosPage /></SuspenseWrapper>,
            },
            {
              path: 'novo-orcamento',
              element: <SuspenseWrapper><OrcamentoNovoPage /></SuspenseWrapper>,
            },
            {
              path: 'editar-orcamento/:id',
              element: <SuspenseWrapper><OrcamentoNovoPage /></SuspenseWrapper>,
            },
            {
              path: 'orcamento/:id',
              element: <SuspenseWrapper><OrcamentoDetalhadoPage /></SuspenseWrapper>,
            },
            {
              path: 'perfil',
              element: <SuspenseWrapper><PerfilPage /></SuspenseWrapper>,
            },
            {
              path: 'galeria',
              element: <SuspenseWrapper><GaleriaArquivosPage /></SuspenseWrapper>,
            },
            {
              path: 'forum',
              element: <SuspenseWrapper><NetworkPage /></SuspenseWrapper>,
            },
            {
              path: 'forum/:id',
              element: <SuspenseWrapper><NetworkPostPage /></SuspenseWrapper>,
            },
            {
              path: 'membros/:userId',
              element: <SuspenseWrapper><MemberProfilePage /></SuspenseWrapper>,
            },
            {
              path: 'conversas/:id',
              element: <SuspenseWrapper><ConversationPage /></SuspenseWrapper>,
            },
            {
              path: 'grupos/:id',
              element: <SuspenseWrapper><ProjectGroupPage /></SuspenseWrapper>,
            },
            {
              path: 'tarefas',
              element: <SuspenseWrapper><TasksPage /></SuspenseWrapper>,
            },
            {
              path: 'empresas',
              element: <SuspenseWrapper><EmpresasPage /></SuspenseWrapper>,
            },
            {
              path: 'prospectos',
              element: <SuspenseWrapper><ProspectosPage /></SuspenseWrapper>,
            },
            {
              path: 'governanca',
              element: <SuspenseWrapper><GovernancaPage /></SuspenseWrapper>,
            },
            {
              path: 'pagamentos',
              element: <SuspenseWrapper><PaymentsPage /></SuspenseWrapper>,
            },
            {
              path: 'templates-atividades',
              element: <SuspenseWrapper><TemplateListPage /></SuspenseWrapper>,
            },
            {
              path: 'templates-atividades/:id',
              element: <SuspenseWrapper><TemplateDetailPage /></SuspenseWrapper>,
            },
            {
              path: 'contratos',
              element: <SuspenseWrapper><ContratosPage /></SuspenseWrapper>,
            },
            {
              path: 'contrato/:id',
              element: <SuspenseWrapper><ContratoDetalhePage /></SuspenseWrapper>,
            },
            {
              path: 'contrato/:id/visualizar',
              element: <SuspenseWrapper><VisualizarContratoPage /></SuspenseWrapper>,
            },
            {
              path: 'contatos',
              element: <SuspenseWrapper><ContatosPage /></SuspenseWrapper>,
            },
            {
              path: 'gestao-equipes',
              element: <SuspenseWrapper><UnderConstructionPanelPage /></SuspenseWrapper>,
            },
            {
              path: 'projetos',
              element: <SuspenseWrapper><ProjetosPage /></SuspenseWrapper>,
            },
            {
              path: 'projetos/:id',
              element: <SuspenseWrapper><ProjetoDetalhePage /></SuspenseWrapper>,
            },
            {
              path: 'configuracoes',
              element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper>,
            },
            // Aulas: first steps in the tool, BPO for beginners and mentoring.
            { path: 'aulas', element: <Navigate to="/painel/aulas/primeiros-passos" replace /> },
            { path: 'aulas/primeiros-passos', element: <SuspenseWrapper><LessonsPage section="primeiros-passos" /></SuspenseWrapper> },
            { path: 'aulas/bpo-primeiros-passos', element: <SuspenseWrapper><LessonsPage section="bpo-primeiros-passos" /></SuspenseWrapper> },
            { path: 'aulas/mentorias', element: <SuspenseWrapper><LessonsPage section="mentorias" /></SuspenseWrapper> },
            // Placeholder modules (under construction): Notas Fiscais and Certificados Digitais.
            { path: 'notas-fiscais', element: <SuspenseWrapper><UnderConstructionPanelPage /></SuspenseWrapper> },
            { path: 'notas-fiscais/emitir', element: <SuspenseWrapper><UnderConstructionPanelPage /></SuspenseWrapper> },
            { path: 'certificados', element: <SuspenseWrapper><UnderConstructionPanelPage /></SuspenseWrapper> },
            { path: 'certificados/vencimentos', element: <SuspenseWrapper><UnderConstructionPanelPage /></SuspenseWrapper> },
            {
              path: 'admin',
              element: <AdminRoute />,
              children: [
                { path: '', element: <SuspenseWrapper><AdminHomePage /></SuspenseWrapper> },
                { path: 'mensagens', element: <SuspenseWrapper><AdminAnnouncementsPage /></SuspenseWrapper> },
                { path: 'aulas', element: <SuspenseWrapper><AdminLessonsPage /></SuspenseWrapper> },
                { path: 'site', element: <SuspenseWrapper><AdminSitePage /></SuspenseWrapper> },
                { path: 'usuarios', element: <SuspenseWrapper><AdminUsersPage /></SuspenseWrapper> },
              ],
            },
            {
              path: 'inscricoes-beta',
              element: <AdminRoute />,
              children: [{ path: '', element: <SuspenseWrapper><BetaSignupsPage /></SuspenseWrapper> }],
            },
            {
              path: 'design-system',
              element: <AdminRoute />,
              children: [
                { path: '', element: <SuspenseWrapper><DesignSystemPage /></SuspenseWrapper> },
              ],
            },
            {
              path: 'planos',
              element: <AdminRoute />,
              children: [
                { path: '', element: <SuspenseWrapper><PlansPage /></SuspenseWrapper> },
              ],
            },
          ]
        }
      ]
    },
    {
      path: '*',
      element: <div data-testid="not-found">Página não encontrada</div>,
    }
      ],
    },
  ]
}

/**
 * Cria o router de produção a partir das rotas montadas por `buildRoutes()`.
 *
 * @returns router do `createBrowserRouter`, pronto para o `RouterProvider`
 */
export async function buildRouter() {
  return createBrowserRouter(await buildRoutes())
}
