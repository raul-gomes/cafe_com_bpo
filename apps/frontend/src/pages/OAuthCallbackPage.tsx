import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/login?error=${error}`);
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    login(token)
      .then((result: { syncedProposalId?: string } | void) => {
        if (result && (result as any).syncedProposalId) {
          navigate(`/painel/orcamento/${(result as any).syncedProposalId}`);
        } else {
          navigate('/painel');
        }
      })
      .catch(() => {
        navigate('/login?error=auth_failed');
      });
  }, [searchParams, navigate, login]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground text-base">
      <div className="text-center">
        <div className="size-8 rounded-full border-[3px] border-border border-t-primary animate-spin mx-auto mb-4" />
        <p>Autenticando...</p>
      </div>
    </div>
  );
};
