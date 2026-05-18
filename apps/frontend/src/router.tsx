import { createBrowserRouter, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import CadastroPage from './pages/CadastroPage'
import SimulatorPage from './pages/SimulatorPage'
import UnderConstructionPage from './pages/UnderConstructionPage'
import ProposalPreviewPage from './pages/ProposalPreviewPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PanelLayout } from './components/panel/PanelLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DashboardPage } from './pages/panel/DashboardPage'
import { OrcamentosPage } from './pages/panel/OrcamentosPage'
import { OrcamentoNovoPage } from './pages/panel/OrcamentoNovoPage'
import { OrcamentoDetalhadoPage } from './pages/panel/OrcamentoDetalhadoPage'
import { PerfilPage } from './pages/panel/PerfilPage'
import { GaleriaArquivosPage } from './pages/panel/GaleriaArquivosPage'
import { NetworkPage } from './pages/panel/NetworkPage'
import { NetworkPostPage } from './pages/panel/NetworkPostPage'
import { TasksPage } from './pages/panel/TasksPage'
import { EmpresasPage } from './pages/panel/EmpresasPage'
import { PaymentsPage } from './pages/panel/PaymentsPage'
import { TemplateListPage } from './pages/panel/TemplateListPage'
import { TemplateDetailPage } from './pages/panel/TemplateDetailPage'

export function buildRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <HomePage />,
    },
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      path: '/cadastro',
      element: <CadastroPage />,
    },
    {
      path: '/auth/callback',
      element: <OAuthCallbackPage />,
    },
    {
      path: '/esqueci-minha-senha',
      element: <ForgotPasswordPage />,
    },
    {
      path: '/redefinir-senha',
      element: <ResetPasswordPage />,
    },
    {
      path: '/simulador',
      element: <SimulatorPage />,
    },
    {
      path: '/proposta',
      element: <ProposalPreviewPage />,
    },
    {
      path: '/em-construcao',
      element: <UnderConstructionPage />,
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
              element: <DashboardPage />,
            },
            {
              path: 'orcamentos',
              element: <OrcamentosPage />,
            },
            {
              path: 'novo-orcamento',
              element: <OrcamentoNovoPage />,
            },
            {
              path: 'editar-orcamento/:id',
              element: <OrcamentoNovoPage />,
            },
            {
              path: 'orcamento/:id',
              element: <OrcamentoDetalhadoPage />,
            },
            {
              path: 'perfil',
              element: <PerfilPage />,
            },
            {
              path: 'galeria',
              element: <GaleriaArquivosPage />,
            },
            {
              path: 'forum',
              element: <NetworkPage />,
            },
            {
              path: 'forum/:id',
              element: <NetworkPostPage />,
            },
            {
              path: 'tarefas',
              element: <TasksPage />,
            },
            {
              path: 'empresas',
              element: <EmpresasPage />,
            },
            {
              path: 'pagamentos',
              element: <PaymentsPage />,
            },
            {
              path: 'templates-atividades',
              element: <TemplateListPage />,
            },
            {
              path: 'templates-atividades/:id',
              element: <TemplateDetailPage />,
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
