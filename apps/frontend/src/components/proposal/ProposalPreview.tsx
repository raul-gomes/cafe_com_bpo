import React from 'react';
import logoAsset from '../../assets/logo.png';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';
import { ProposalDownloadGate } from './ProposalDownloadGate';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

const termLabels: Record<number, string> = {
  0:    'por mês',
  0.05: 'a cada 3 meses',
  0.10: 'por ano',
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ProposalPreviewProps {
  form: PricingFormData;
  pricing: PricingResult;
  clientName: string;
  generatedAt: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export const ProposalPreview: React.FC<ProposalPreviewProps> = ({
  form,
  pricing,
  clientName,
  generatedAt,
}) => {
  const { user } = useAuth();
  const activeServices = form.services.filter(s => s.active);
  const termLabel = termLabels[form.term_discount] ?? 'por mês';

  // Informações da "Minha Empresa" (Logado)
  const myCompany = user?.company || 'Minha empresa';
  const myName = user?.name || 'Meu nome';
  const myEmail = user?.email || 'meu@email.com';
  const myWhatsapp = '111111111111111'; // Placeholder conforme PDF

  return (
    <div className="proposal-container-v2">
      <div className="proposal-content-v2">
        {/* HEADER */}
        <header className="prop-header-v2">
          <div className="prop-header-left">
            <img src={logoAsset} alt="Logo" className="prop-logo-v2" />
          </div>
          <div className="prop-header-right">
            <h1>Proposta de Serviços</h1>
            <div className="prop-header-meta-v2">
              <div className="prop-meta-row"><span>Data:</span> {generatedAt}</div>
              <div className="prop-meta-row"><span>Validade:</span> 15 dias</div>
              <div className="prop-meta-row"><span>Contrato:</span> Mensal</div>
            </div>
          </div>
        </header>

        <div className="prop-divider-v2" />

        {/* INFO EMPRESA */}
        <div className="prop-info-v2">
          <div className="prop-info-left">
            <h3>{myCompany}</h3>
          </div>
          <div className="prop-info-right">
            <p className="prop-info-name">{myName}</p>
            <p>{myEmail}</p>
            <p>{myWhatsapp}</p>
          </div>
        </div>

        {/* DADOS DO CLIENTE */}
        <div className="prop-client-card-v2">
          <p className="prop-card-label">DADOS DO CLIENTE</p>
          <div className="prop-client-grid">
            <div className="prop-client-field">
              <span>NOME / EMPRESA</span>
              <p>{clientName}</p>
            </div>
            <div className="prop-client-field">
              <span>E-MAIL</span>
              <p>email@cliente.com</p>
            </div>
          </div>
        </div>

        {/* ESCOPO */}
        <div className="prop-scope-v2">
          <h3>ESCOPO DOS SERVIÇOS</h3>
          <table className="prop-table-v2">
            <thead>
              <tr>
                <th>SERVIÇO</th>
                <th style={{ textAlign: 'right' }}>FREQ. MENSAL</th>
              </tr>
            </thead>
            <tbody>
              {pricing.breakdown.service_costs.map((item, i) => (
                <tr key={i}>
                  <td>{item.name}</td>
                  <td style={{ textAlign: 'right' }}>{item.monthly_quantity ? `${item.monthly_quantity}x` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* INVESTIMENTO */}
        <div className="prop-investment-v2">
          <p className="prop-investment-label">INVESTIMENTO</p>
          <div className="prop-investment-value">
            {fmt(pricing.final_price)}
            <span> / mês</span>
          </div>
        </div>

        {/* CONDIÇÕES */}
        <div className="prop-conditions-v2">
          <h4>Condições comerciais</h4>
          <ul>
            <li>Pagamento: Mensal · Forma: a combinar</li>
            <li>Esta proposta contempla os serviços listados acima conforme escopo acordado. Serviços adicionais ou alterações de volume serão orçados separadamente.</li>
            <li>Proposta válida por 15 dias a partir da data de emissão.</li>
          </ul>
        </div>

        {/* FOOTER */}
        <footer className="prop-footer-v2">
          <div className="prop-footer-line" />
          <p>{myCompany} · {myEmail} · {myWhatsapp}</p>
          <p className="prop-footer-brand">Desenvolvido com Café com BPO</p>
        </footer>
      </div>

      <ProposalDownloadGate
        form={form}
        pricing={pricing}
        clientName={clientName}
      />
    </div>
  );
};
