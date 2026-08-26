import React, { useState } from 'react';
import { PIX_KEY } from '../../config/env';

interface ModalNosAjudeProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNosAjude: React.FC<ModalNosAjudeProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-nos-ajude"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Nos Ajude"
      >
        <button
          className="modal-nos-ajude__close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="modal-nos-ajude__content">
          <p className="section-label" style={{ justifyContent: 'center', color: 'rgba(255,255,255,0.25)' }}>
            Nos ajude
          </p>
          <h2 className="donate-headline" style={{ fontSize: '22px' }}>
            Ajude o Café com BPO<br />
            a <em>continuar crescendo.</em>
          </h2>
          <p className="donate-body">
            Sua contribuição mantém essa plataforma viva, gratuita e em constante evolução.
            Cada centavo vai direto para manter o servidor, as ferramentas e a comunidade funcionando.
          </p>

          <div className="donate-pix-area">
            <div className="donate-pix-card">
              <div className="donate-pix-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M7 15h0M2 9h20" />
                  <path d="M12 15v-3" />
                </svg>
              </div>
              <p className="donate-pix-label">PIX</p>
              <div className="donate-pix-copy">
                <code className="donate-pix-key">{PIX_KEY}</code>
                <button className="donate-copy-btn" onClick={handleCopyPix}>
                  {copied ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copiado!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalNosAjude;
