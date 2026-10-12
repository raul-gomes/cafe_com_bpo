import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoginForm } from './LoginForm';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { Alert } from '../ui/alert';
import { CafeIcon } from '../../brand/CafeIcon';

const ERROR_MESSAGES: Record<string, string> = {
  state_invalid: 'Sessão expirada. Tente fazer login novamente.',
  auth_failed: 'Falha na autenticação. Tente novamente.',
  session_expired: 'Sua sessão expirou. Faça login novamente.',
};

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
  const errorParam = searchParams.get('error');
  const [showForgotPw, setShowForgotPw] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Already signed in: the login makes no sense, go straight to the panel.
  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/painel/tarefas');
  }, [isAuthenticated, isLoading, navigate]);

  // Escape closes; the background does not scroll while the dialog is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showForgotPw) onClose();
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
          <div>
            <h2 className="login-dialog-title">Bem-vindo de volta.</h2>
            <p className="login-dialog-lead">Seu escritório de BPO em um lugar só.</p>
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
