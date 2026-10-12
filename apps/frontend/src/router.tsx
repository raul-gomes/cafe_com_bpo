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
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'))
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
  // Named-export pages load on demand (React.lazy): awaiting every panel page
  // here made the first render wait for the whole panel, public pages included.
  const OAuthCallbackPage = React.lazy(() => import('./pages/OAuthCallbackPage').then(m => ({ default: m.OAuthCallbackPage })))
  const InvitationAcceptPage = React.lazy(() => import('./pages/InvitationAcceptPage').then(m => ({ default: m.InvitationAcceptPage })))
  const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
  const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
  const DashboardPage = React.lazy(() => import('./pages/panel/DashboardPage').then(m => ({ default: m.DashboardPage })))
  const OrcamentosPage = React.lazy(() => import('./pages/panel/OrcamentosPage').then(m => ({ default: m.OrcamentosPage })))
  const OrcamentoNovoPage = React.lazy(() => import('./pages/panel/OrcamentoNovoPage').then(m => ({ default: m.OrcamentoNovoPage })))
  const OrcamentoDetalhadoPage = React.lazy(() => import('./pages/panel/OrcamentoDetalhadoPage').then(m => ({ default: m.OrcamentoDetalhadoPage })))
  const PerfilPage = React.lazy(() => import('./pages/panel/PerfilPage').then(m => ({ default: m.PerfilPage })))
  const GaleriaArquivosPage = React.lazy(() => import('./pages/panel/GaleriaArquivosPage').then(m => ({ default: m.GaleriaArquivosPage })))
  const NetworkPage = React.lazy(() => import('./pages/panel/NetworkPage').then(m => ({ default: m.NetworkPage })))
  const NetworkPostPage = React.lazy(() => import('./pages/panel/NetworkPostPage').then(m => ({ default: m.NetworkPostPage })))
  const MemberProfilePage = React.lazy(() => import('./pages/panel/MemberProfilePage').then(m => ({ default: m.MemberProfilePage })))
  const ConversationPage = React.lazy(() => import('./pages/panel/ConversationPage').then(m => ({ default: m.ConversationPage })))
  const ProjectGroupPage = React.lazy(() => import('./pages/panel/ProjectGroupPage').then(m => ({ default: m.ProjectGroupPage })))
  const TasksPage = React.lazy(() => import('./pages/panel/TasksPage').then(m => ({ default: m.TasksPage })))
  const EmpresasPage = React.lazy(() => import('./pages/panel/EmpresasPage').then(m => ({ default: m.EmpresasPage })))
  const ContatosPage = React.lazy(() => import('./pages/panel/ContatosPage').then(m => ({ default: m.ContatosPage })))
  const ProspectosPage = React.lazy(() => import('./pages/panel/ProspectosPage').then(m => ({ default: m.ProspectosPage })))
  const GovernancaPage = React.lazy(() => import('./pages/panel/GovernancaPage').then(m => ({ default: m.GovernancaPage })))
  const ContratosPage = React.lazy(() => import('./pages/panel/ContratosPage').then(m => ({ default: m.ContratosPage })))
  const ContratoDetalhePage = React.lazy(() => import('./pages/panel/ContratoDetalhePage').then(m => ({ default: m.ContratoDetalhePage })))
  const VisualizarContratoPage = React.lazy(() => import('./pages/panel/VisualizarContratoPage').then(m => ({ default: m.VisualizarContratoPage })))
  const PaymentsPage = React.lazy(() => import('./pages/panel/PaymentsPage').then(m => ({ default: m.PaymentsPage })))
  const TemplateListPage = React.lazy(() => import('./pages/panel/TemplateListPage').then(m => ({ default: m.TemplateListPage })))
  const TemplateDetailPage = React.lazy(() => import('./pages/panel/TemplateDetailPage').then(m => ({ default: m.TemplateDetailPage })))
  const UnderConstructionPanelPage = React.lazy(() => import('./pages/panel/UnderConstructionPanelPage').then(m => ({ default: m.UnderConstructionPanelPage })))
  const ProjetosPage = React.lazy(() => import('./pages/panel/ProjetosPage').then(m => ({ default: m.ProjetosPage })))
  const ProjetoDetalhePage = React.lazy(() => import('./pages/panel/ProjetoDetalhePage').then(m => ({ default: m.ProjetoDetalhePage })))
  const SettingsPage = React.lazy(() => import('./pages/panel/SettingsPage').then(m => ({ default: m.SettingsPage })))
  const LessonsPage = React.lazy(() => import('./pages/panel/LessonsPage').then(m => ({ default: m.LessonsPage })))
  const BetaSignupsPage = React.lazy(() => import('./pages/panel/BetaSignupsPage').then(m => ({ default: m.BetaSignupsPage })))
  const AdminHomePage = React.lazy(() => import('./pages/panel/admin/AdminHomePage').then(m => ({ default: m.AdminHomePage })))
  const AdminAnnouncementsPage = React.lazy(() => import('./pages/panel/admin/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage })))
  const AdminLessonsPage = React.lazy(() => import('./pages/panel/admin/AdminLessonsPage').then(m => ({ default: m.AdminLessonsPage })))
  const AdminSitePage = React.lazy(() => import('./pages/panel/admin/AdminSitePage').then(m => ({ default: m.AdminSitePage })))
  const AdminUsersPage = React.lazy(() => import('./pages/panel/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))

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
              element: <SuspenseWrapper><UnderConstructionPanelPage area="equipes" /></SuspenseWrapper>,
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
            { path: 'notas-fiscais', element: <SuspenseWrapper><UnderConstructionPanelPage area="notas-fiscais" /></SuspenseWrapper> },
            { path: 'notas-fiscais/emitir', element: <SuspenseWrapper><UnderConstructionPanelPage area="notas-fiscais" /></SuspenseWrapper> },
            { path: 'certificados', element: <SuspenseWrapper><UnderConstructionPanelPage area="certificados" /></SuspenseWrapper> },
            { path: 'certificados/vencimentos', element: <SuspenseWrapper><UnderConstructionPanelPage area="certificados" /></SuspenseWrapper> },
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
      element: <SuspenseWrapper><NotFoundPage /></SuspenseWrapper>,
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
