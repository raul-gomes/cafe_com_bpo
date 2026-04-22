/**
 * ProposalDocument.tsx
 * Novo modelo de Proposta Comercial BPO (Single Page).
 */
import React from 'react';
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';
import { User } from '../../context/AuthContext';

// ─── Design System (Clean/White) ──────────────────────────────────────────────
const C = {
  black: '#000000',
  white: '#FFFFFF',
  greyDark: '#333333',
  grey: '#666666',
  greyLight: '#999999',
  border: '#E5E5E5',
  borderDark: '#000000',
  bgBox: '#F9F9F9',
};

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    color: C.black,
    fontFamily: 'Helvetica',
    padding: '40pt 50pt',
    fontSize: 10,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  headerMeta: {
    textAlign: 'right',
    gap: 2,
  },
  proposalTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  metaLabel: {
    color: C.grey,
    fontSize: 9,
  },
  metaValue: {
    color: C.greyDark,
    fontSize: 9,
  },

  divider: {
    height: 1.5,
    backgroundColor: C.black,
    width: '100%',
    marginVertical: 15,
  },

  // ── Provider Info ──
  providerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  providerLeft: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  providerRight: {
    textAlign: 'right',
    gap: 2,
  },
  providerName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  providerDetail: {
    fontSize: 9,
    color: C.grey,
  },

  // ── Client Box ──
  clientBox: {
    borderBottom: `1pt solid ${C.border}`,
    paddingBottom: 10,
    flexDirection: 'row',
    marginBottom: 30,
    gap: 40,
  },
  clientField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 8,
    color: C.greyLight,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 10,
    color: C.black,
  },

  // ── Services Section ──
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: `1pt solid ${C.border}`,
    paddingBottom: 5,
    marginBottom: 10,
  },
  tableColService: {
    flex: 4,
    fontSize: 8,
    color: C.greyLight,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  tableColFreq: {
    flex: 1,
    textAlign: 'right',
    fontSize: 8,
    color: C.greyLight,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottom: `0.5pt solid ${C.border}`,
  },
  rowServiceName: {
    flex: 4,
    fontSize: 10,
  },
  rowServiceFreq: {
    flex: 1,
    textAlign: 'right',
    fontSize: 10,
  },

  // ── Investment ──
  investmentContainer: {
    marginTop: 30,
    alignItems: 'flex-end',
  },
  investmentLabel: {
    fontSize: 9,
    color: C.greyLight,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  investmentValue: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: C.greyDark,
  },
  investmentPeriod: {
    fontSize: 9,
    color: C.greyLight,
    marginTop: 2,
  },

  // ── Commercial Conditions ──
  conditionsBox: {
    border: `1pt solid ${C.border}`,
    borderRadius: 6,
    padding: 15,
    marginTop: 40,
  },
  conditionsTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  conditionText: {
    fontSize: 9,
    color: C.grey,
    lineHeight: 1.4,
    marginBottom: 4,
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    gap: 4,
  },
  footerMain: {
    fontSize: 8,
    color: C.grey,
  },
  footerSub: {
    fontSize: 8,
    color: C.greyLight,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

// ─── Props ────────────────────────────────────────────────────────────────────
interface ProposalDocumentProps {
  form: PricingFormData;
  pricing: PricingResult;
  logoUrl: string;
  clientName?: string;
  clientEmail?: string;
  provider?: User | null;
  generatedAt?: string;
}

// ─── Documento ────────────────────────────────────────────────────────────────
export const ProposalDocument: React.FC<ProposalDocumentProps> = ({
  form,
  pricing,
  logoUrl,
  clientName = '',
  clientEmail = '',
  provider,
  generatedAt,
}) => {
  const activeServices = form.services.filter(s => s.active);
  const dateStr = generatedAt ?? new Date().toLocaleDateString('pt-BR');
  
  const providerCompany = provider?.company || 'Minha empresa';
  const providerName = provider?.name || 'Meu nome';
  const providerEmail = provider?.email || 'meu@email.com';
  const providerPhone = '111111111111111';

  return (
    <Document
      title={`Proposta de Serviços — ${clientName || 'Cliente'}`}
      author={providerName}
    >
      <Page size="A4" style={s.page}>
        {/* HEADER */}
        <View style={s.header}>
          {logoUrl ? (
             <Image src={logoUrl} style={s.logo} />
          ) : (
             <View style={s.logo} /> // Espaço reservado se não houver logo
          )}
          <View style={s.headerMeta}>
            <Text style={s.proposalTitle}>Proposta de Serviços</Text>
            <Text style={s.metaValue}>Data: <Text style={s.metaValue}>{dateStr}</Text></Text>
            <Text style={s.metaValue}>Validade: <Text style={s.metaValue}>15 dias</Text></Text>
            <Text style={s.metaValue}>Contrato: <Text style={s.metaValue}>Mensal</Text></Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* PROVIDER INFO */}
        <View style={s.providerInfo}>
          <Text style={s.providerLeft}>{providerCompany}</Text>
          <View style={s.providerRight}>
            <Text style={s.providerName}>{providerName}</Text>
            <Text style={s.providerDetail}>{providerEmail}</Text>
            <Text style={s.providerDetail}>{providerPhone}</Text>
          </View>
        </View>

        {/* CLIENT DATA BOX */}
        <View style={s.clientBox}>
          <View style={s.clientField}>
            <Text style={s.fieldLabel}>NOME / EMPRESA</Text>
            <Text style={s.fieldValue}>{clientName || ' '}</Text>
          </View>
          <View style={s.clientField}>
            <Text style={s.fieldLabel}>E-MAIL</Text>
            <Text style={s.fieldValue}>{clientEmail || ' '}</Text>
          </View>
        </View>

        {/* SERVICES */}
        <View style={{ marginBottom: 20 }}>
          <Text style={s.sectionTitle}>Escopo dos Serviços</Text>
          
          <View style={s.tableHeader}>
            <Text style={s.tableColService}>Serviço</Text>
            <Text style={s.tableColFreq}>Freq. Mensal</Text>
          </View>

          {activeServices.map((service, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.rowServiceName}>{service.name}</Text>
              <Text style={s.rowServiceFreq}>{service.monthly_quantity > 0 ? `${service.monthly_quantity}x` : '—'}</Text>
            </View>
          ))}
        </View>

        {/* INVESTMENT */}
        <View style={s.investmentContainer}>
          <Text style={s.investmentLabel}>Investimento</Text>
          <Text style={s.investmentValue}>{fmt(pricing.final_price)}</Text>
          <Text style={s.investmentPeriod}>/ mês</Text>
        </View>

        {/* COMMERCIAL CONDITIONS */}
        <View style={s.conditionsBox}>
          <Text style={s.conditionsTitle}>Condições comerciais</Text>
          <Text style={s.conditionText}>Pagamento: Mensal · Forma: a combinar</Text>
          <Text style={s.conditionText}>
            Esta proposta contempla os serviços listados acima conforme escopo acordado. Serviços adicionais ou alterações de volume serão orçados separadamente.
          </Text>
          <Text style={s.conditionText}>
            Proposta válida por 15 dias a partir da data de emissão.
          </Text>
        </View>

        {/* FOOTER */}
        <View style={s.footer}>
          <Text style={s.footerMain}>
            {providerCompany} · {providerEmail} · {providerPhone}
          </Text>
          <Text style={s.footerSub}>Desenvolvido com Café com BPO</Text>
        </View>
      </Page>
    </Document>
  );
};
