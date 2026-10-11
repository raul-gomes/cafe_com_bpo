import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LoginDialog } from './LoginDialog';

interface LoginDialogApi {
  openLogin: () => void;
}

const LoginDialogContext = createContext<LoginDialogApi | null>(null);

/**
 * Abre o login como janela suspensa sobre a página atual. Fora do
 * PublicShell (ex.: componente isolado em teste) cai para a rota /login,
 * que mostra a página inicial com a janela aberta.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useLoginDialog(): LoginDialogApi {
  const context = useContext(LoginDialogContext);
  const navigate = useNavigate();
  return context ?? { openLogin: () => navigate('/login') };
}

/** Layout das páginas públicas: renderiza a página e, quando pedido, o login por cima. */
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
