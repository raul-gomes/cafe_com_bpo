import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/ui/Navbar';
import { ProposalPreview } from '../components/proposal/ProposalPreview';
import { PricingFormData } from '../schemas/pricing';
import { PricingResult } from '../lib/pricingEngine';

const SESSION_KEY = 'cafe_bpo_proposal';

/** Estrutura salva no sessionStorage pelo PricingCalculatorLayout */
export interface ProposalSession {
  form: PricingFormData;
  pricing: PricingResult;
  clientName: string;
}

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

/** Utilitário para salvar a proposta no sessionStorage antes de navegar */
export function saveProposalSession(data: ProposalSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
