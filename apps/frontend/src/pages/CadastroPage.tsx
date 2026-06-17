import { Navbar } from '../components/ui/Navbar';
import { RegisterForm } from '../components/auth/RegisterForm';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui/alert';

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
          <Alert className="mb-5 text-center mx-auto max-w-[420px]">
            <strong>Quase lá!</strong> Cadastre-se para salvar sua simulação e baixar sua proposta em PDF.
          </Alert>
        )}
        
        <RegisterForm />
        
        <div className="text-center mt-6 text-[13px] text-muted-foreground">
          Já possui conta?{' '}
          <a href="/login" className="text-primary no-underline font-medium">
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
