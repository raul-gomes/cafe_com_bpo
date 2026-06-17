import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/button';
import { ProposalPreview } from '../components/proposal/ProposalPreview';

import { SESSION_KEY, ProposalSession } from '../schemas/proposalSession';

export default function ProposalPreviewPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [proposal, setProposal] = useState<ProposalSession | null>(null);
  const [notFound, setNotFound]  = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/painel/novo-orcamento');
      return;
    }

    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      setNotFound(true);
      return;
    }
    try {
      setProposal(JSON.parse(raw) as ProposalSession);
    } catch {
      setNotFound(true);
    }
  }, [isAuthenticated, navigate]);

  const generatedAt = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Navbar />
        <p className="text-base">Nenhuma proposta encontrada.</p>
        <Button variant="link" onClick={() => navigate('/simulador')}>
          ← Voltar ao simulador
        </Button>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Navbar />
        <span className="text-muted-foreground">Carregando proposta...</span>
      </div>
    );
  }

  return (
    <div className="proposal-page">
      <Navbar />
      <ProposalPreview
        form={proposal.form}
        pricing={proposal.pricing}
        clientName={proposal.clientName}
        generatedAt={generatedAt}
      />
    </div>
  );
}
