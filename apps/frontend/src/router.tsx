import { createBrowserRouter, Navigate } from 'react-router-dom'
import React, { Suspense } from 'react'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PanelLayout } from './components/panel/PanelLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminRoute } from './components/auth/AdminRoute'

// ── Lazy-loaded pages (default exports — use React.lazy) ─────────
const HomePage = React.lazy(() => import('./pages/HomePage'))
const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const CadastroPage = React.lazy(() => import('./pages/CadastroPage'))
const SimulatorPage = React.lazy(() => import('./pages/SimulatorPage'))
const UnderConstructionPage = React.lazy(() => import('./pages/UnderConstructionPage'))
const ProposalPreviewPage = React.lazy(() => import('./pages/ProposalPreviewPage'))
const DesignSystemPage = React.lazy(() => import('./pages/panel/DesignSystemPage'))

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
export async function buildRouter() {
  // Named-export pages are loaded dynamically inside the async function
  const { OAuthCallbackPage } = await import('./pages/OAuthCallbackPage')
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
  const { TasksPage } = await import('./pages/panel/TasksPage')
  const { EmpresasPage } = await import('./pages/panel/EmpresasPage')
  const { PaymentsPage } = await import('./pages/panel/PaymentsPage')
  const { TemplateListPage } = await import('./pages/panel/TemplateListPage')
  const { TemplateDetailPage } = await import('./pages/panel/TemplateDetailPage')

  return createBrowserRouter([
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
      path: '/simulador',
      element: <SuspenseWrapper><SimulatorPage /></SuspenseWrapper>,
    },
    {
      path: '/proposta',
      element: <SuspenseWrapper><ProposalPreviewPage /></SuspenseWrapper>,
    },
    {
      path: '/em-construcao',
      element: <SuspenseWrapper><UnderConstructionPage /></SuspenseWrapper>,
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
              path: 'tarefas',
              element: <SuspenseWrapper><TasksPage /></SuspenseWrapper>,
            },
            {
              path: 'empresas',
              element: <SuspenseWrapper><EmpresasPage /></SuspenseWrapper>,
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
              path: 'design-system',
              element: <AdminRoute />,
              children: [
                { path: '', element: <SuspenseWrapper><DesignSystemPage /></SuspenseWrapper> },
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
  ])
}
