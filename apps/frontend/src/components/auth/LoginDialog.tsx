import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoginForm } from './LoginForm';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { Alert } from '../ui/alert';
import { CafeIcon } from '../../brand/CafeIcon';
import { useQuery } from '@tanstack/react-query';
import { getPublicSite } from '../../api/platform';
import type { LoginNotice } from '../../schemas/platform';
import { safeReturnTo } from '../../lib/returnTo';

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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab / Shift+Tab inside the dialog: from the last control it wraps to
 * the first and back. Without it, keyboard focus walked to the page behind the
 * modal despite aria-modal (AUD-036).
 *
 * @param event - The Tab keydown.
 * @param panel - The dialog element.
 */
function trapFocus(event: KeyboardEvent, panel: HTMLElement | null): void {
  if (!panel) return;
  const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  const outside = !panel.contains(active);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

interface LoginDialogProps {
  onClose: () => void;
}

/**
 * Login as a floating dialog: screen center, dimmed background, compact
 * enough to fit without scrolling. Escape or a click outside closes it.
 *
 * @returns The dialog.
 */
export const LoginDialog: React.FC<LoginDialogProps> = ({ onClose }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The expired-session redirect sends session_expired=true, not error=… .
  const errorParam = searchParams.get('error') ?? (searchParams.get('session_expired') ? 'session_expired' : null);
  const returnTo = safeReturnTo(searchParams.get('return_to'));
  const [showForgotPw, setShowForgotPw] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: site } = useQuery({ queryKey: ['public-site'], queryFn: getPublicSite, staleTime: 5 * 60_000 });
  const notice = site?.login_notice ?? DEFAULT_NOTICE;

  // Already signed in: the login makes no sense, go straight to the panel.
  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate(returnTo ?? '/painel');
  }, [isAuthenticated, isLoading, navigate, returnTo]);

  // Escape closes; the background does not scroll while the dialog is open.
  // Focus goes back to whatever opened the dialog (the Login button) on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (showForgotPw) return; // the forgot-password modal handles its own keys
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') trapFocus(event, panelRef.current);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, showForgotPw]);

  return (
    <div
      className="login-dialog-backdrop"
      // Only a direct click on the backdrop closes: events of portal dialogs (forgot
      // password, terms) also bubble up the React tree to here.
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-testid="login-page"
    >
      <div ref={panelRef} className="login-dialog" role="dialog" aria-modal="true" aria-label="Login">
        {/* Brand column: keeps the dialog horizontal and readable at a glance. */}
        <div className="login-dialog-brand">
          <img src="/brand/kit-v4/logo-cafe-colorida.svg" alt="Café com BPO" className="login-dialog-logo" />
          {/* Editable in Admin › Site e encontros: a good spot for notices and promotions. */}
          <div>
            <h2 className="login-dialog-title">{notice.title}</h2>
            <p className="login-dialog-lead">{notice.message}</p>
            {notice.link_url && notice.link_label && (
              <a href={notice.link_url} className="login-dialog-notice-link" target="_blank" rel="noopener noreferrer">
                {notice.link_label}
              </a>
            )}
          </div>
          <p className="login-dialog-beta">
            Ainda não tem acesso?{' '}
            <Link to="/#quero-ser-beta" onClick={onClose}>Quero ser Beta</Link>
          </p>
        </div>

        <div className="login-dialog-form">
          <button type="button" onClick={onClose} className="login-dialog-close" aria-label="Fechar">
            <CafeIcon name="fechar" />
          </button>
          {errorParam && (
            <Alert variant="destructive" className="mb-[12px]">
              <span>{ERROR_MESSAGES[errorParam] || 'Ocorreu um erro. Tente novamente.'}</span>
            </Alert>
          )}
          <LoginForm onForgotPassword={() => setShowForgotPw(true)} compact />
        </div>
      </div>
      <ForgotPasswordModal open={showForgotPw} onOpenChange={setShowForgotPw} />
    </div>
  );
};
