import React from 'react';
import { useNavigate } from 'react-router';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';
import { useAuth } from '../../context/AuthContext';
import { useGeneratePDF } from '../../lib/useGeneratePDF';
import logoAsset from '../../assets/logo.png';

interface ProposalDownloadGateProps {
  form: PricingFormData;
  pricing: PricingResult;
  clientName: string;
}

export const ProposalDownloadGate: React.FC<ProposalDownloadGateProps> = ({
  form,
  pricing,
  clientName,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { generate: generatePDF, isGenerating } = useGeneratePDF();

  const handleDownloadClick = async () => {
    if (isAuthenticated) {
      await generatePDF({
        form,
        pricing,
        logoUrl: user?.company_logo_url || user?.avatar_url || logoAsset,
        clientName,
        clientEmail: '',
        provider: user
      });
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="proposal-gate">
      <button
        className="btn-download-pdf"
        onClick={handleDownloadClick}
        disabled={isGenerating}
        aria-label="Baixar proposta em PDF"
      >
        {isGenerating ? '⌛ Gerando...' : '↓ Baixar PDF'}
      </button>
    </div>
  );
};
