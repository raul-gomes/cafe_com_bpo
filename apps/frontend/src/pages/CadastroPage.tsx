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
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      <div className="login-glow-top" />
      <div className="login-glow-bottom" />
      <span className="login-bpo-watermark">BPO</span>

      <main className="flex-1 flex items-center justify-center px-6 pt-14 pb-14">
        <div className="w-full max-w-[420px]">
          {sessionStorage.getItem('cafe_bpo_proposal') && (
            <Alert className="mb-5 text-center">
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
      </main>
    </div>
  );
}
