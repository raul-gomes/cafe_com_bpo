import { Navbar } from '../components/ui/Navbar';
import { LoginForm } from '../components/auth/LoginForm';
import { useEffect } from 'react';
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

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/painel/tarefas');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col" data-testid="login-page">
      <Navbar />

      {/* Glow effects */}
      <div className="login-glow-top" />
      <div className="login-glow-bottom" />

      <span className="login-bpo-watermark">BPO</span>

      {/* Centered content */}
      <main className="flex-1 flex items-center justify-center px-6 pt-14">
        <div className="w-full max-w-[420px]">
          {errorParam && (
            <Alert variant="destructive" className="mb-5">
              <span>{ERROR_MESSAGES[errorParam] || 'Ocorreu um erro. Tente novamente.'}</span>
            </Alert>
          )}
          {sessionStorage.getItem('cafe_bpo_proposal') && (
            <Alert className="mb-5 text-center">
              <strong>Quase lá!</strong> Faça login ou cadastre-se para salvar sua simulação e baixar sua proposta em PDF.
            </Alert>
          )}
          <LoginForm />
          <div className="text-center mt-5 text-[13px] text-muted-foreground">
            Não possui conta?{' '}
            <a href="/cadastro" className="text-primary no-underline font-medium">
              Cadastre-se
            </a>
          </div>
          <p className="login-footer-note">
            Café com BPO © {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  );
}
