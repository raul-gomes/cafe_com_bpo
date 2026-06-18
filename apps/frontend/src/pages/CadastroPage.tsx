import { useState, useEffect } from 'react';
import { Navbar } from '../components/ui/Navbar';
import { RegisterForm } from '../components/auth/RegisterForm';
import { LoginForm } from '../components/auth/LoginForm';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui/alert';
import { Dialog, DialogContent } from '../components/ui/dialog';

export default function CadastroPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);

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
            <button type="button" onClick={() => setShowLogin(true)} className="text-primary no-underline font-medium bg-transparent border-none cursor-pointer hover:underline">
              Fazer login
            </button>
          </div>
          
          <p className="login-footer-note" style={{ marginTop: '32px' }}>
            Café com BPO © {new Date().getFullYear()}
          </p>
        </div>
      </main>

      {/* Login Modal */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="sm:max-w-[420px] p-0 border-0 bg-transparent ring-0 max-h-[85vh] overflow-y-auto">
          <LoginForm onForgotPassword={() => { setShowLogin(false); setShowForgotPw(true); }} />
        </DialogContent>
      </Dialog>

      {/* Forgot Password Modal (from inside login modal) */}
      <ForgotPasswordModal open={showForgotPw} onOpenChange={setShowForgotPw} />
    </div>
  );
}
