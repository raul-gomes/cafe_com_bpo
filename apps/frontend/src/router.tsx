import { createBrowserRouter } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SimulatorPage from './pages/SimulatorPage'
import UnderConstructionPage from './pages/UnderConstructionPage'
import ProposalPreviewPage from './pages/ProposalPreviewPage'
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
          element: <div className="p-10 text-2xl" data-testid="dashboard-content">Dashboard Privado da BPO (Apenas autenticados)</div>,
        }
      ]
    },
    {
      path: '*',
      element: <div data-testid="not-found">Página não encontrada</div>,
    }
  ])
}
