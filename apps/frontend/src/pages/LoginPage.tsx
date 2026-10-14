import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterModal } from '../components/auth/RegisterModal';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { Alert } from '../components/ui/alert';
import { getPublicSite } from '../api/platform';
import type { LoginNotice } from '../schemas/platform';
import { safeReturnTo } from '../lib/returnTo';
import { usePageMeta } from '../lib/seo';

/** Shown while the editable notice loads (and if the API is unreachable). */
const DEFAULT_NOTICE: LoginNotice = {
  title: 'Bem-vindo de volta.',
  message: 'Seu escritório de BPO em um lugar só.',
  link_label: null,
  link_url: null,
};

const ERROR_MESSAGES: Record<string, string> = {
  state_invalid: 'Sessão expirada. Tente fazer login novamente.',
  auth_failed: 'Falha na autenticação. Tente novamente.',
  session_expired: 'Sua sessão expirou. Faça login novamente.',
};

/**
 * /login: standalone page split in two — the brand on the left, the form on the
 * right. Whoever lands here from a link, invitation or expired session sees the
 * same page the public header button opens. "Cadastre-se" opens the registration
 * modal on top.
 *
 * @returns The page.
 */
export default function LoginPage() {
  usePageMeta({ title: 'Login', description: 'Entre na sua conta do Café com BPO.', path: '/login', noindex: true });

  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The expired-session redirect sends session_expired=true, not error=… .
  const errorParam = searchParams.get('error') ?? (searchParams.get('session_expired') ? 'session_expired' : null);
  const returnTo = safeReturnTo(searchParams.get('return_to'));
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const { data: site } = useQuery({ queryKey: ['public-site'], queryFn: getPublicSite, staleTime: 5 * 60_000 });
  const notice = site?.login_notice ?? DEFAULT_NOTICE;

  // Already signed in: the login makes no sense, go straight to the panel —
  // unless the sign-up flow is open (the auto-login of the registration must
  // not tear down the subscription offer before the new user decides).
  useEffect(() => {
    if (!isLoading && isAuthenticated && !showRegister) navigate(returnTo ?? '/painel');
  }, [isAuthenticated, isLoading, navigate, returnTo, showRegister]);

  return (
    <div className="login-page" data-testid="login-page">
      {/* Brand column: keeps the page readable at a glance. */}
      <aside className="login-page-brand">
        <img src="/brand/kit-v4/logo-cafe-colorida.svg" alt="Café com BPO" className="login-page-logo" />
        {/* Editable in Admin › Site e encontros: a good spot for notices and promotions. */}
        <div>
          <h1 className="login-page-title">{notice.title}</h1>
          <p className="login-page-lead">{notice.message}</p>
          {notice.link_url && notice.link_label && (
            <a href={notice.link_url} className="login-page-notice-link" target="_blank" rel="noopener noreferrer">
              {notice.link_label}
            </a>
          )}
        </div>
        <p className="login-page-beta">
          Ainda não tem acesso?{' '}
          <Link to="/#quero-ser-beta">Quero ser Beta</Link>
        </p>
      </aside>

      <main className="login-page-form">
        {errorParam && (
          <Alert variant="destructive" className="mb-[12px]">
            <span>{ERROR_MESSAGES[errorParam] || 'Ocorreu um erro. Tente novamente.'}</span>
          </Alert>
        )}
        <LoginForm onForgotPassword={() => setShowForgotPw(true)} onRegisterClick={() => setShowRegister(true)} compact />
      </main>

      <ForgotPasswordModal open={showForgotPw} onOpenChange={setShowForgotPw} />
      <RegisterModal open={showRegister} onOpenChange={setShowRegister} />
    </div>
  );
}
