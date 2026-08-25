import React, { useEffect, useState } from 'react';
import logoAsset from '../../assets/logo.png';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';
import { resolveBrandColors, resolveProviderTitle } from '../../lib/brandColors';
import { useConfirm } from '../ui/ConfirmDialog';
import { ProposalDownloadGate } from './ProposalDownloadGate';
import { useAuth } from '../../context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const fmtPhone = (v: string): string => {
  const digits = v.replace(/\D/g, '');
  if (digits.length < 10) return v;
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
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
  const { primary, secondary } = resolveBrandColors(user);
  const askConfirm = useConfirm();

  // Regra do título: fantasia → razão social → diálogo (nome pessoal ou branco)
  const resolution = resolveProviderTitle(user);
  const [personalChoiceMade, setPersonalChoiceMade] = useState(false);
  const [usePersonalName, setUsePersonalName] = useState(false);

  useEffect(() => {
    if (!resolution.requiresChoice || personalChoiceMade) return;
    let active = true;
    askConfirm({
      title: 'Nome empresarial não cadastrado',
      message:
        'Você não possui nome empresarial cadastrado no perfil.\n' +
        `Deseja utilizar seu nome pessoal ("${resolution.personalName}") na proposta?`,
      confirmLabel: 'Sim, usar meu nome',
      cancelLabel: 'Não, deixar em branco',
      variant: 'warning',
    }).then((usePersonal) => {
      if (!active) return;
      setUsePersonalName(usePersonal);
      setPersonalChoiceMade(true);
    });
    return () => {
      active = false;
    };
  }, [askConfirm, resolution.requiresChoice, resolution.personalName, personalChoiceMade]);

  const displayTitle = resolution.requiresChoice
    ? (personalChoiceMade && usePersonalName ? resolution.personalName || '' : '')
    : resolution.title;

  // Informações do prestador (BPO)
  const providerName = user?.name || '';
  const providerEmail = user?.email || '';
  const providerPhoneRaw =
    user?.company_commercial_phone || user?.whatsapp || '';
  const providerPhone = providerPhoneRaw ? fmtPhone(providerPhoneRaw) : '';
  const logoUrl = user?.company_logo_url || user?.avatar_url || logoAsset;

  const activeServices = form.services.filter(s => s.active);

  return (
    <div
      className="proposal-container-v2"
      style={{ '--cor-1': primary, '--cor-2': secondary } as React.CSSProperties}
    >
      <div className="proposal-content-v2">
        {/* HEADER BANNER */}
        <header className="prop-header-banner">
          <div>
            <span className="prop-badge">Proposta Comercial</span>
            <h1 className="prop-header-title">{displayTitle}</h1>
          </div>
          <div className="prop-logo-box">
            <img src={logoUrl} alt="Logo da empresa" className="prop-logo-img" />
          </div>
        </header>

        <div className="prop-body">
          {/* METADADOS */}
          <div className="prop-meta-grid">
            <div className="prop-meta-card">
              <div className="prop-meta-label">Prestador de Serviços</div>
              <div className="prop-meta-value">{displayTitle || '—'}</div>
              <div className="prop-meta-subtext">
                {[providerName !== displayTitle ? providerName : '', providerEmail, providerPhone]
                  .filter(Boolean).join(' | ')}
              </div>
            </div>
            <div className="prop-meta-card">
              <div className="prop-meta-label">Cliente / Empresa</div>
              <div className="prop-meta-value">{clientName || '—'}</div>
            </div>
            <div className="prop-meta-card">
              <div className="prop-meta-label">Data de Emissão</div>
              <div className="prop-meta-value">{generatedAt}</div>
            </div>
            <div className="prop-meta-card">
              <div className="prop-meta-label">Validade da Proposta</div>
              <div className="prop-meta-value">15 dias</div>
            </div>
          </div>

          {/* 1. ESCOPO */}
          <h2 className="prop-section-title">1. Escopo dos Serviços</h2>
          <p className="prop-section-intro">
            Esta proposta contempla a terceirização das seguintes rotinas operacionais
            e gerenciais, conforme volumes acordados:
          </p>

          <table className="prop-feature-table">
            <thead>
              <tr>
                <th>Serviço Executado</th>
                <th style={{ textAlign: 'center', width: 130 }}>Frequência Mensal</th>
              </tr>
            </thead>
            <tbody>
              {activeServices.map((service, i) => (
                <tr key={i}>
                  <td>{service.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="prop-tag-freq">
                      {service.monthly_quantity > 0 ? `${service.monthly_quantity}x` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 2. INVESTIMENTO */}
          <h2 className="prop-section-title" style={{ marginBottom: 4 }}>
            2. Investimento
          </h2>
          <table className="prop-pricing-table">
            <thead>
              <tr>
                <th>Descrição do Investimento</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="prop-pricing-total">
                <td>
                  <strong>Mensalidade (Contrato Mensal)</strong>
                  <br />
                  <span style={{ fontSize: 11, fontWeight: 'normal', color: '#64748b' }}>
                    Os serviços listados acima conforme escopo acordado.
                  </span>
                </td>
                <td className="prop-price-val">
                  {fmt(pricing.final_price)}{' '}
                  <span className="prop-price-period">/ mês</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* CONDIÇÕES */}
          <div className="prop-callout">
            <strong>Condições comerciais:</strong> Pagamento Mensal · Forma: a combinar.
            <br />
            Serviços adicionais ou alterações de volume serão orçados separadamente.
          </div>

          {/* ASSINATURAS */}
          <div className="prop-signature-row">
            <div className="prop-signature-col">
              <div className="prop-signature-line">
                {displayTitle}
                <div className="prop-signature-sub">{providerEmail}</div>
              </div>
            </div>
            <div className="prop-signature-col">
              <div className="prop-signature-line">
                {clientName || 'Cliente'}
                <div className="prop-signature-sub">De Acordo / Aceite do Cliente</div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="prop-footer">
          <span>
            {[displayTitle, providerEmail, providerPhone].filter(Boolean).join(' | ')}
          </span>
          <span>Café com BPO</span>
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
