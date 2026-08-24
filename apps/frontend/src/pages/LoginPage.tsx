import { useState, useEffect } from 'react';
import { Navbar } from '../components/ui/Navbar';
import { LoginForm } from '../components/auth/LoginForm';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui/alert';

const ERROR_MESSAGES: Record<string, string> = {
  state_invalid: 'Sessão expirada. Tente fazer login novamente.',
  auth_failed: 'Falha na autenticação. Tente novamente.',
  session_expired: 'Sua sessão expirou. Faça login novamente.',
};

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');
  const [showForgotPw, setShowForgotPw] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/painel/tarefas');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col" data-testid="login-page">
      <Navbar />

      <div className="login-glow-top" />
      <div className="login-glow-bottom" />

      <span className="login-bpo-watermark">BPO</span>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[480px]">
          {errorParam && (
            <Alert variant="destructive" className="mb-5">
              <span>{ERROR_MESSAGES[errorParam] || 'Ocorreu um erro. Tente novamente.'}</span>
            </Alert>
          )}
          {sessionStorage.getItem('cafe_bpo_proposal') && (
            <Alert className="mb-5 text-center">
              <strong>Quase lá!</strong> Faça login para salvar sua simulação e baixar sua proposta em PDF.
            </Alert>
          )}
          <LoginForm onForgotPassword={() => setShowForgotPw(true)} />
          <p className="login-footer-note">
            Café com BPO © {new Date().getFullYear()}
          </p>
        </div>
      </main>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal open={showForgotPw} onOpenChange={setShowForgotPw} />
    </div>
  );
}
