import React, { useState } from 'react';
import { RegisterModal } from '../auth/RegisterModal';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';

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

  return (
    <>
      <div className="proposal-gate">
        <p className="proposal-gate-hint">
          Sua proposta está pronta. Crie uma conta gratuita para baixar o PDF
          e guardar este resultado no seu portal.
        </p>
        <button
          className="btn-download-pdf"
          onClick={() => setModalOpen(true)}
          aria-label="Baixar proposta em PDF"
        >
          ↓ Baixar PDF
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
