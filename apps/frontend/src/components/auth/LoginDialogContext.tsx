import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LoginDialog } from './LoginDialog';

interface LoginDialogApi {
  openLogin: () => void;
}

const LoginDialogContext = createContext<LoginDialogApi | null>(null);

/**
 * Opens the login as a dialog over the current page. Outside the PublicShell
 * (e.g. a component rendered alone in a test) it falls back to the /login
 * route, which shows the landing page with the dialog open.
 *
 * @returns The login dialog API.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useLoginDialog(): LoginDialogApi {
  const context = useContext(LoginDialogContext);
  const navigate = useNavigate();
  return context ?? { openLogin: () => navigate('/login') };
}

/**
 * Public pages layout: renders the page and, when asked, the login on top.
 *
 * @returns The layout.
 */
export const PublicShell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const openLogin = useCallback(() => setOpen(true), []);
  const api = useMemo(() => ({ openLogin }), [openLogin]);

  return (
    <LoginDialogContext.Provider value={api}>
      <Outlet />
      {open && <LoginDialog onClose={() => setOpen(false)} />}
    </LoginDialogContext.Provider>
  );
};
