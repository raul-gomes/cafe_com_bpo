import { RouterProvider } from 'react-router-dom'
import { buildRouter } from './router'

const router = buildRouter()

function App() {
  return <RouterProvider router={router} />
}

export default App
