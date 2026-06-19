import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import type { Router } from '@remix-run/router'
import { buildRouter } from './router'

function App() {
  const [router, setRouter] = useState<Router | null>(null)

  useEffect(() => {
    buildRouter().then(setRouter)
  }, [])

  if (!router) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground text-base">
        <div className="size-8 rounded-full border-[3px] border-border border-t-primary animate-spin" />
      </div>
    )
  }

  return <RouterProvider router={router} />
}

export default App
