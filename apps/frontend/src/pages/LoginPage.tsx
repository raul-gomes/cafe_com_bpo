import { Navbar } from '../components/ui/Navbar';
import { LoginForm } from '../components/auth/LoginForm';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <div className="login-page" data-testid="login-page">
      <Navbar />

      <div className="login-glow-top" />
      <div className="login-glow-bottom" />

      <span className="login-bpo-watermark">BPO</span>

      <div className="login-content">
        {errorParam && (
          <div className="ds-alert ds-alert-error" style={{ marginBottom: '20px' }}>
            <span>{ERROR_MESSAGES[errorParam] || 'Ocorreu um erro. Tente novamente.'}</span>
          </div>
        )}
        {sessionStorage.getItem('cafe_bpo_proposal') && (
          <div className="ds-alert ds-alert-warning" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <strong>Quase lá!</strong> Faça login ou cadastre-se para salvar sua simulação e baixar sua proposta em PDF.
          </div>
        )}
        <LoginForm />
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--ds-text-subtle)' }}>
          Não possui conta?{' '}
          <a href="/cadastro" style={{ color: 'var(--ds-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Cadastre-se
          </a>
        </div>
        <p className="login-footer-note">
          Café com BPO © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
