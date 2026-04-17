import { Navbar } from '../components/ui/Navbar';
import { RegisterForm } from '../components/auth/RegisterForm';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CadastroPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/painel/tarefas');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="login-page">
      <Navbar />

      <div className="login-glow-top" />
      <div className="login-glow-bottom" />
      <span className="login-bpo-watermark">BPO</span>

      <div className="login-content" style={{ marginTop: '80px', marginBottom: '80px' }}>
        {sessionStorage.getItem('cafe_bpo_proposal') && (
          <div className="ds-alert ds-alert-warning" style={{ marginBottom: '20px', textAlign: 'center', width: '100%', maxWidth: '420px', margin: '0 auto 20px' }}>
            <strong>Quase lá!</strong> Cadastre-se para salvar sua simulação e baixar sua proposta em PDF.
          </div>
        )}
        
        <RegisterForm />
        
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--ds-text-subtle)' }}>
          Já possui conta?{' '}
          <a href="/login" style={{ color: 'var(--ds-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Fazer login
          </a>
        </div>
        
        <p className="login-footer-note" style={{ marginTop: '32px' }}>
          Café com BPO © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
