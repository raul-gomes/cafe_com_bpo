import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/ui/Navbar';
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
      <div style={{ minHeight: '100vh', background: 'var(--ds-black)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--ds-text-muted)' }}>
        <Navbar />
        <p style={{ fontSize: '16px' }}>Nenhuma proposta encontrada.</p>
        <button
          onClick={() => navigate('/simulador')}
          style={{ color: 'var(--ds-primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
        >
          ← Voltar ao simulador
        </button>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ds-black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Navbar />
        <span style={{ color: 'var(--ds-text-muted)' }}>Carregando proposta...</span>
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

