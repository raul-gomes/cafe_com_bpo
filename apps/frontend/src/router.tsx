import { createBrowserRouter } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SimulatorPage from './pages/SimulatorPage'
import UnderConstructionPage from './pages/UnderConstructionPage'

export function buildRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <HomePage />,
    },
    {
      path: '/login',
      element: <UnderConstructionPage />,
    },
    {
      path: '/simulador',
      element: <SimulatorPage />,
    },
    {
      path: '/em-construcao',
      element: <UnderConstructionPage />,
    },
    {
      path: '*',
      element: <div data-testid="not-found">Página não encontrada</div>,
    }
  ])
}
