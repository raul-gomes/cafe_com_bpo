import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, LogIn } from 'lucide-react';
import { acceptInvitation } from '../api/team';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import logo from '../assets/logo.png';

type Phase = 'loading' | 'login_needed' | 'accepted' | 'error';

export const InvitationAcceptPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [phase, setPhase] = useState<Phase>('loading');
  const [clientName, setClientName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailMismatch, setEmailMismatch] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const processed = useRef(false);

  useEffect(() => {
    const rawToken = searchParams.get('token');
    if (rawToken) {
      tokenRef.current = rawToken;
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || processed.current) return;
    const token = tokenRef.current;
    if (!token) {
      processed.current = true;
      setErrorMsg('Link de convite inválido ou expirado.');
      setPhase('error');
      return;
    }

    // Validate the token (and get client name) before deciding the flow.
    acceptInvitation(token)
      .then((res) => {
        processed.current = true;
        if (res.data.status === 'accepted') {
          setClientName(res.data.client_name ?? null);
          setPhase('accepted');
          return;
        }
        if (res.data.status === 'redirect') {
          setClientName(res.data.client_name ?? null);
          if (isAuthenticated) {
            navigate(`/login?invite_token=${encodeURIComponent(token)}`);
          } else {
            setPhase('login_needed');
          }
          return;
        }
        setErrorMsg('Não foi possível aceitar o convite.');
        setPhase('error');
      })
      .catch((error: any) => {
        processed.current = true;
        const detail = error.response?.data?.detail || 'Link de convite inválido ou expirado.';
        setErrorMsg(detail);
        setEmailMismatch(String(detail).includes('Faça login com essa conta'));
        setPhase('error');
      });
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="login-glow-top" />
      <div className="login-glow-bottom" />
      <Card className="mx-auto max-w-[420px]">
        <CardContent className="pt-9 px-8 pb-8 text-center">
          <img src={logo} alt="Café com BPO" className="h-10 mx-auto mb-4" />

          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="size-8 rounded-full border-[3px] border-border border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Validando convite...</p>
            </div>
          )}

          {phase === 'login_needed' && (
            <>
              <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Você foi convidado!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {clientName
                  ? <>Você foi convidado para fazer parte da equipe de <strong>{clientName}</strong>.</>
                  : 'Você foi convidado para fazer parte de uma equipe.'}
                {' '}Faça login para aceitar o convite.
              </p>
              <Button
                className="w-full"
                onClick={() => navigate(`/login?invite_token=${encodeURIComponent(tokenRef.current ?? '')}`)}
              >
                <LogIn size={15} />
                Fazer login
              </Button>
            </>
          )}

          {phase === 'accepted' && (
            <>
              <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Convite aceito!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {clientName
                  ? <>Você agora faz parte da equipe de <strong>{clientName}</strong>.</>
                  : 'Você agora faz parte da equipe.'}
              </p>
              <Button className="w-full" onClick={() => navigate('/painel/tarefas')}>
                Ir para o painel
              </Button>
            </>
          )}

          {phase === 'error' && (
            <>
              <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Não foi possível aceitar</h2>
              <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
              {emailMismatch && (
                <Button
                  className="w-full mb-3"
                  onClick={async () => {
                    await logout();
                    navigate(`/login?invite_token=${encodeURIComponent(tokenRef.current ?? '')}`);
                  }}
                >
                  <LogIn size={15} />
                  Entrar com outra conta
                </Button>
              )}
              <Link to="/" className="text-primary-strong no-underline text-sm">Voltar ao início</Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
