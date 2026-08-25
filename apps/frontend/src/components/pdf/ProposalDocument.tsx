/**
 * ProposalDocument.tsx
 * Modelo whitelabel v2 — Proposta Comercial BPO.
 * Cores primária/secundária vêm do perfil do usuário; logo da empresa no header.
 */
import React from 'react';
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';
import { resolveBrandColors, resolveProviderTitle } from '../../lib/brandColors';
import { User } from '../../context/AuthContext';

// ─── Paleta neutra (fixa) ─────────────────────────────────────────────────────
const C = {
  white: '#FFFFFF',
  ink: '#1e293b',
  heading: '#0f172a',
  body: '#334155',
  grey: '#64748b',
  greyMid: '#475569',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  bgSoft: '#f8fafc',
};

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

interface ProposalDocumentProps {
  form: PricingFormData;
  pricing: PricingResult;
  logoUrl: string;
  clientName?: string;
  clientEmail?: string;
  provider?: User | null;
  /** Título resolvido (fantasia → razão social → escolha do usuário). */
  providerDisplayName?: string;
  generatedAt?: string;
}

export const ProposalDocument: React.FC<ProposalDocumentProps> = ({
  form,
  pricing,
  logoUrl,
  clientName = '',
  clientEmail = '',
  provider,
  providerDisplayName,
  generatedAt,
}) => {
  const activeServices = form.services.filter(s => s.active);
  const dateStr = generatedAt ?? new Date().toLocaleDateString('pt-BR');
  const { primary, secondary } = resolveBrandColors(provider);

  // Título: fantasia → razão social → escolha (nome pessoal ou em branco)
  const displayTitle =
    providerDisplayName !== undefined
      ? providerDisplayName
      : resolveProviderTitle(provider).title;
  const providerName = provider?.name || '';
  const providerEmail = provider?.email || '';
  const providerPhone =
    provider?.company_commercial_phone || provider?.whatsapp || '';

  // ── Estilos dependentes das cores da marca ──
  const s = StyleSheet.create({
    page: {
      backgroundColor: C.bgSoft,
      color: C.ink,
      fontFamily: 'Helvetica',
      fontSize: 10,
      paddingBottom: 40,
    },
    content: { padding: '24pt 40pt' },

    // ── Header banner ──
    headerBanner: {
      backgroundColor: primary,
      borderBottomWidth: 4,
      borderBottomColor: secondary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '26pt 40pt',
    },
    badge: {
      backgroundColor: secondary,
      color: C.white,
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      paddingVertical: 3,
      paddingHorizontal: 10,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginBottom: 10,
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: 'Helvetica-Bold',
      color: C.white,
    },
    logoBox: {
      width: 110,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: { width: 110, height: 60, objectFit: 'contain' },
    logoPlaceholder: {
      width: 110,
      height: 60,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#ffffff66',
      borderRadius: 6,
      backgroundColor: '#ffffff0d',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoPlaceholderText: {
      color: '#ffffffcc',
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
    },

    // ── Meta cards ──
    metaTable: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 18,
      marginBottom: 20,
    },
    metaCard: {
      width: '49%',
      backgroundColor: C.white,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
    },
    metaLabel: {
      fontSize: 7.5,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: C.grey,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 3,
    },
    metaValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.heading },
    metaSubtext: { fontSize: 8.5, color: C.grey, marginTop: 2 },

    // ── Seções ──
    sectionTitle: {
      fontSize: 12.5,
      fontFamily: 'Helvetica-Bold',
      color: C.heading,
      borderLeftWidth: 4,
      borderLeftColor: secondary,
      paddingLeft: 10,
      marginTop: 16,
      marginBottom: 8,
    },
    sectionIntro: {
      fontSize: 9.5,
      color: C.body,
      textAlign: 'justify',
      marginBottom: 10,
    },

    // ── Tabela de escopo ──
    featureTable: {
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      marginBottom: 14,
    },
    featureHead: {
      flexDirection: 'row',
      backgroundColor: C.borderLight,
      borderBottomWidth: 1,
      borderBottomColor: '#cbd5e1',
      padding: 9,
    },
    featureHeadService: {
      flex: 4,
      fontSize: 8.5,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: C.body,
    },
    featureHeadFreq: {
      flex: 1.6,
      fontSize: 8.5,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: C.body,
      textAlign: 'center',
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 9,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
    },
    featureRowEven: { backgroundColor: '#fafafa' },
    featureRowLast: { borderBottomWidth: 0 },
    featureService: { flex: 4, fontSize: 9.5, color: C.body },
    freqTag: {
      flex: 1.6,
      alignItems: 'center',
    },
    freqTagInner: {
      backgroundColor: C.borderLight,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 4,
      paddingVertical: 1.5,
      paddingHorizontal: 8,
    },
    freqTagText: {
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      color: C.greyMid,
    },

    // ── Investimento ──
    pricingTable: {
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      marginVertical: 10,
    },
    pricingHead: {
      backgroundColor: primary,
      flexDirection: 'row',
      padding: 11,
    },
    pricingHeadDesc: {
      flex: 3,
      color: C.white,
      fontSize: 8.5,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pricingHeadVal: {
      flex: 1,
      color: C.white,
      fontSize: 8.5,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      textAlign: 'right',
    },
    pricingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.borderLight,
      padding: 12,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    pricingDesc: { flex: 3, paddingRight: 10 },
    pricingDescTitle: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: C.heading,
    },
    pricingDescSub: { fontSize: 8, color: C.grey, marginTop: 2 },
    priceVal: {
      flex: 1,
      textAlign: 'right',
      fontSize: 13,
      fontFamily: 'Helvetica-Bold',
      color: secondary,
    },
    pricePeriod: { fontSize: 8.5, color: C.grey, fontFamily: 'Helvetica' },

    // ── Callout ──
    callout: {
      backgroundColor: C.white,
      borderWidth: 1,
      borderColor: C.border,
      borderLeftWidth: 4,
      borderLeftColor: secondary,
      borderRadius: 4,
      padding: 12,
      marginVertical: 12,
    },
    calloutText: { fontSize: 8.5, color: C.greyMid, lineHeight: 1.5 },

    // ── Assinaturas ──
    signatureTable: {
      flexDirection: 'row',
      marginTop: 30,
      marginBottom: 10,
    },
    signatureCol: {
      width: '48%',
      alignItems: 'center',
    },
    signatureSpacer: { width: '4%' },
    signatureLine: {
      borderTopWidth: 1,
      borderTopColor: '#94a3b8',
      width: '100%',
      paddingTop: 7,
      alignItems: 'center',
    },
    signatureName: {
      fontSize: 9.5,
      fontFamily: 'Helvetica-Bold',
      color: C.heading,
    },
    signatureSub: { fontSize: 8, color: C.grey, marginTop: 1 },

    // ── Footer fixo ──
    footer: {
      position: 'absolute',
      bottom: 18,
      left: 40,
      right: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerText: { fontSize: 8, color: C.grey },
  });

  return (
    <Document
      title={`Proposta Comercial — ${clientName || 'Cliente'}`}
      author={displayTitle || providerName}
    >
      <Page size="A4" style={s.page}>
        {/* HEADER BANNER */}
        <View style={s.headerBanner} fixed>
          <View style={{ flex: 1 }}>
            <Text style={s.badge}>Proposta Comercial</Text>
            <Text style={s.headerTitle}>{displayTitle}</Text>
          </View>
          <View style={s.logoBox}>
            {logoUrl ? (
              <Image src={logoUrl} style={s.logo} />
            ) : (
              <View style={s.logoPlaceholder}>
                <Text style={s.logoPlaceholderText}>SUA LOGO AQUI</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.content}>
          {/* METADADOS */}
          <View style={s.metaTable}>
            <View style={s.metaCard}>
              <Text style={s.metaLabel}>Prestador de Serviços</Text>
              <Text style={s.metaValue}>{displayTitle || '—'}</Text>
              {!!providerName && providerName !== displayTitle && (
                <Text style={s.metaSubtext}>{providerName}</Text>
              )}
              <Text style={s.metaSubtext}>
                {providerEmail}
                {providerPhone ? ` | ${fmtPhone(providerPhone)}` : ''}
              </Text>
            </View>
            <View style={s.metaCard}>
              <Text style={s.metaLabel}>Cliente / Empresa</Text>
              <Text style={s.metaValue}>{clientName || '—'}</Text>
              <Text style={s.metaSubtext}>{clientEmail || ''}</Text>
            </View>
            <View style={s.metaCard}>
              <Text style={s.metaLabel}>Data de Emissão</Text>
              <Text style={s.metaValue}>{dateStr}</Text>
            </View>
            <View style={s.metaCard}>
              <Text style={s.metaLabel}>Validade da Proposta</Text>
              <Text style={s.metaValue}>15 dias</Text>
            </View>
          </View>

          {/* 1. ESCOPO */}
          <Text style={s.sectionTitle}>1. Escopo dos Serviços</Text>
          <Text style={s.sectionIntro}>
            Esta proposta contempla a terceirização das seguintes rotinas operacionais
            e gerenciais, conforme volumes acordados:
          </Text>

          <View style={s.featureTable}>
            <View style={s.featureHead}>
              <Text style={s.featureHeadService}>Serviço Executado</Text>
              <Text style={s.featureHeadFreq}>Frequência Mensal</Text>
            </View>
            {activeServices.map((service, i) => {
              const isLast = i === activeServices.length - 1;
              return (
                <View
                  key={i}
                  style={[
                    s.featureRow,
                    ...(i % 2 === 1 ? [s.featureRowEven] : []),
                    ...(isLast ? [s.featureRowLast] : []),
                  ]}
                >
                  <Text style={s.featureService}>{service.name}</Text>
                  <View style={s.freqTag}>
                    <View style={s.freqTagInner}>
                      <Text style={s.freqTagText}>
                        {service.monthly_quantity > 0 ? `${service.monthly_quantity}x` : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* 2. INVESTIMENTO */}
          <Text style={[s.sectionTitle, { marginBottom: 4 }]}>2. Investimento</Text>
          <View style={s.pricingTable}>
            <View style={s.pricingHead}>
              <Text style={s.pricingHeadDesc}>Descrição do Investimento</Text>
              <Text style={s.pricingHeadVal}>Valor</Text>
            </View>
            <View style={s.pricingRow}>
              <View style={s.pricingDesc}>
                <Text style={s.pricingDescTitle}>Mensalidade (Contrato Mensal)</Text>
                <Text style={s.pricingDescSub}>
                  Os serviços listados acima conforme escopo acordado.
                </Text>
              </View>
              <Text style={s.priceVal}>
                {fmt(pricing.final_price)}
                <Text style={s.pricePeriod}> / mês</Text>
              </Text>
            </View>
          </View>

          {/* CONDIÇÕES */}
          <View style={s.callout}>
            <Text style={s.calloutText}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Condições comerciais:</Text>{' '}
              Pagamento Mensal · Forma: a combinar.{'\n'}
              Serviços adicionais ou alterações de volume serão orçados separadamente.
            </Text>
          </View>

          {/* ASSINATURAS */}
          <View style={s.signatureTable}>
            <View style={s.signatureCol}>
              <View style={s.signatureLine}>
                <Text style={s.signatureName}>{displayTitle}</Text>
                <Text style={s.signatureSub}>{providerEmail}</Text>
              </View>
            </View>
            <View style={s.signatureSpacer} />
            <View style={s.signatureCol}>
              <View style={s.signatureLine}>
                <Text style={s.signatureName}>{clientName || 'Cliente'}</Text>
                <Text style={s.signatureSub}>De Acordo / Aceite do Cliente</Text>
              </View>
            </View>
          </View>
        </View>

        {/* FOOTER FIXO */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {displayTitle}
            {providerEmail ? ` | ${providerEmail}` : ''}
            {providerPhone ? ` | ${fmtPhone(providerPhone)}` : ''}
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};
