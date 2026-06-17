import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppProviders } from './providers/AppProviders'
/* ─── Tailwind + Design Tokens (must be first) ─── */
import './styles/globals.css'
import './tokens.css'

/* ─── Design System Components ─── */
import './ds-components.css'

/* ─── Panel Structure ─── */
import './panel-layout.css'
import './sidebar.css'

/* ─── Page-Specific ─── */
import './proposals.css'
import './profile.css'
import './calculator.css'
import './tutorial.css'

/* ─── Standalone (kept as-is) ─── */
import './forms.css'
import './login.css'
import './proposal.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
