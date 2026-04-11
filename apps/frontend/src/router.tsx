import { createBrowserRouter } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SimulatorPage from './pages/SimulatorPage'
import UnderConstructionPage from './pages/UnderConstructionPage'
import ProposalPreviewPage from './pages/ProposalPreviewPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

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
      element: <ProtectedRoute />,
      children: [
        {
          path: '',
          element: <DashboardPage />,
        }
      ]
    },
    {
      path: '*',
      element: <div data-testid="not-found">Página não encontrada</div>,
    }
  ])
}
