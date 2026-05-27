import React, { useState } from 'react';

interface ModalNosAjudeProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNosAjude: React.FC<ModalNosAjudeProps> = ({ isOpen, onClose }) => {
  const [donateAmount, setDonateAmount] = useState('');
  const [donateName, setDonateName] = useState('');
  const [donateEmail, setDonateEmail] = useState('');
  const [donateMethod, setDonateMethod] = useState('pix');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyPix = () => {
    navigator.clipboard.writeText('cafe@cafecombpo.com.br');
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
                <code className="donate-pix-key">cafe@cafecombpo.com.br</code>
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

          <div className="donate-divider">ou</div>

          <div className="donate-form-area">
            <h3 className="donate-form-title">Faça uma doação com cartão ou boleto</h3>
            <form className="donate-form" onSubmit={(e) => e.preventDefault()}>
              <div className="donate-amounts">
                <button type="button" className="donate-amount-btn" onClick={() => setDonateAmount('10')}>R$ 10</button>
                <button type="button" className="donate-amount-btn" onClick={() => setDonateAmount('25')}>R$ 25</button>
                <button type="button" className="donate-amount-btn" onClick={() => setDonateAmount('50')}>R$ 50</button>
                <button type="button" className="donate-amount-btn" onClick={() => setDonateAmount('100')}>R$ 100</button>
              </div>
              <div className="donate-form-row">
                <input className="donate-amount-input" type="text" placeholder="Outro valor (R$)" value={donateAmount} onChange={(e) => setDonateAmount(e.target.value)} />
                <input className="donate-name-input" type="text" placeholder="Seu nome (opcional)" value={donateName} onChange={(e) => setDonateName(e.target.value)} />
              </div>
              <div className="donate-form-row">
                <input className="donate-email-input" type="email" placeholder="Seu e-mail" value={donateEmail} onChange={(e) => setDonateEmail(e.target.value)} />
                <select className="donate-method-select" value={donateMethod} onChange={(e) => setDonateMethod(e.target.value)}>
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
              <button type="submit" className="donate-submit-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                Doar agora
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalNosAjude;
