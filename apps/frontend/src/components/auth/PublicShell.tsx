import React, { useCallback, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

interface LoginApi {
  openLogin: () => void;
}

/**
 * Sends the visitor to the standalone login page. Kept as a hook (instead of a
 * direct `navigate` in each caller) so the public header and the homepage CTAs
 * share a single entry point to the login.
 *
 * @returns The login API.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useLogin(): LoginApi {
  const navigate = useNavigate();
  const openLogin = useCallback(() => navigate('/login'), [navigate]);
  return useMemo(() => ({ openLogin }), [openLogin]);
}

/**
 * Public pages layout: the routes that share the public header. The login is
 * its own page now (it used to be a dialog over the current page), so this is a
 * passthrough wrapper.
 *
 * @returns The layout.
 */
export const PublicShell: React.FC = () => <Outlet />;
