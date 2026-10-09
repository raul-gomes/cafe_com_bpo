import { useCallback, useEffect, useState } from 'react';
import { Navbar } from '../components/ui/Navbar';
import { RegisterForm } from '../components/auth/RegisterForm';
import { LoginForm } from '../components/auth/LoginForm';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui/alert';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { usePlans } from '../api/hooks/usePlans';
import { SignupPlanOffer } from '../components/payments/SignupPlanOffer';

export default function CadastroPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const { data: plans, isLoading: plansLoading } = usePlans();

  const activePlan = plans?.find(p => p.is_active) ?? plans?.[0] ?? null;

  const handleRegistered = useCallback(() => setShowOffer(true), []);
  const handleContinue = useCallback(() => {
    setShowOffer(false);
    navigate('/painel');
  }, [navigate]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !showOffer) {
      navigate('/painel/tarefas');
    }
  }, [isAuthenticated, isLoading, navigate, showOffer]);

  useEffect(() => {
    // Sem plano ativo não há investimento a mostrar: segue direto para o painel.
    if (showOffer && !plansLoading && !activePlan) {
      navigate('/painel');
    }
  }, [showOffer, plansLoading, activePlan, navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      <div className="login-glow-top" />
      <div className="login-glow-bottom" />
      <span className="login-bpo-watermark">BPO</span>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[480px]">
          {sessionStorage.getItem('cafe_bpo_proposal') && (
            <Alert className="mb-5 text-center">
              <strong>Quase lá!</strong> Cadastre-se para salvar sua simulação e baixar sua proposta em PDF.
            </Alert>
          )}
          
          {showOffer ? (
            plansLoading || !activePlan ? (
              <div className="flex h-44 items-center justify-center text-[14px] text-muted-foreground">
                Preparando seu espaço…
              </div>
            ) : (
              <SignupPlanOffer plan={activePlan} onContinue={handleContinue} />
            )
          ) : (
            <RegisterForm onRegistered={handleRegistered} />
          )}
          
          <div className="text-center mt-6 text-[13px] text-muted-foreground">
            Já possui conta?{' '}
            <button type="button" onClick={() => setShowLogin(true)} className="text-primary-strong no-underline font-medium bg-transparent border-none cursor-pointer hover:underline">
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
        <DialogContent className="sm:!max-w-[480px] p-0 border-0 bg-transparent ring-0 max-h-[85vh] overflow-y-auto">
          <LoginForm onForgotPassword={() => { setShowLogin(false); setShowForgotPw(true); }} />
        </DialogContent>
      </Dialog>

      {/* Forgot Password Modal (from inside login modal) */}
      <ForgotPasswordModal open={showForgotPw} onOpenChange={setShowForgotPw} />
    </div>
  );
}
