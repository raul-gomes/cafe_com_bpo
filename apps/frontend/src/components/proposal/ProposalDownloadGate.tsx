import React, { useState } from 'react';
import { RegisterModal } from '../auth/RegisterModal';
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
  const [modalOpen, setModalOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { generate: generatePDF, isGenerating } = useGeneratePDF();

  const handleDownloadClick = async () => {
    if (isAuthenticated) {
      // Já logado: baixa direto
      await generatePDF({
        form,
        pricing,
        logoUrl: logoAsset,
        clientName
      });
    } else {
      // Não logado: abre o gate (modal de registro)
      setModalOpen(true);
    }
  };

  return (
    <>
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

      {modalOpen && (
        <RegisterModal
          onClose={() => setModalOpen(false)}
          form={form}
          pricing={pricing}
          clientName={clientName}
        />
      )}
    </>
  );
};
