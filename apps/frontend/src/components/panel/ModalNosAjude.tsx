import React, { useState } from 'react';
import { PIX_KEY } from '../../config/env';
import { CafeIcon } from '../../brand/CafeIcon';

interface ModalNosAjudeProps {
  isOpen: boolean;
  onClose: () => void;
}

/** "Colabore": convite para fazer parte (não pedido de ajuda), com PIX. */
export const ModalNosAjude: React.FC<ModalNosAjudeProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-[16px]" onClick={onClose}>
      <div
        className="relative w-full max-w-[460px] rounded-lg border border-border bg-card p-[clamp(24px,4vw,36px)] text-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="colabore-titulo"
      >
        <button
          type="button"
          className="absolute right-[12px] top-[12px] grid size-[40px] place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onClose}
          aria-label="Fechar"
        >
          <CafeIcon name="fechar" />
        </button>

        <p className="flex items-center gap-[8px] text-xs font-bold uppercase tracking-[0.11em] text-primary-strong">
          <CafeIcon name="coracao" className="size-[18px]" /> Faça parte
        </p>
        <h2 id="colabore-titulo" className="mt-[10px] font-editorial text-[1.875rem] font-medium leading-[1.1] tracking-[-0.02em]">
          Sem você, isso não seria possível.
        </h2>
        <p className="mt-[14px] text-[0.9375rem] leading-relaxed text-muted-foreground">
          O Café com BPO é construído por quem vive o BPO de verdade. Este projeto é maior do que
          cada um de nós — e, quando todo mundo coloca um pouco, chegar lá fica mais leve e mais rápido.
        </p>

        {PIX_KEY ? (
          <div className="mt-[22px] rounded-md border border-border bg-muted p-[16px]">
            <p className="text-xs font-bold uppercase tracking-[0.11em] text-muted-foreground">PIX</p>
            <p className="mt-[4px] text-sm text-muted-foreground">Contribua com o valor que fizer sentido para você.</p>
            <div className="mt-[12px] flex items-center gap-[10px]">
              <code className="min-w-0 flex-1 truncate rounded-sm bg-card px-[10px] py-[8px] text-sm">{PIX_KEY}</code>
              <button
                type="button"
                className="flex shrink-0 items-center gap-[6px] rounded-md bg-primary px-[14px] py-[8px] text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
                onClick={handleCopyPix}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-[22px] text-sm text-muted-foreground">A chave PIX ainda não foi configurada.</p>
        )}
      </div>
    </div>
  );
};

export default ModalNosAjude;
