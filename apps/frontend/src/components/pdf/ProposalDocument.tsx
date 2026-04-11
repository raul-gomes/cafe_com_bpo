/**
 * ProposalDocument.tsx
 * Documento PDF da Proposta Comercial BPO.
 * Gerado inteiramente no browser via @react-pdf/renderer.
 * Dados vêm do pricingEngine local — sem chamada de rede para gerar o PDF.
 */
import React from 'react';
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';

// ─── Cores (espelho das CSS vars do design system) ────────────────────────────
const C = {
  black:       '#000000',
  surface:     '#111111',
  surface2:    '#1e1e1e',
  primary:     '#FBBF24',
  primaryDark: '#d4a017',
  white:       '#FFFFFF',
  textMuted:   '#888888',
  textSubtle:  '#555555',
  green:       '#4ade80',
  border:      '#2a2a2a',
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Layout geral
  page: {
    backgroundColor: C.black,
    color: C.white,
    fontFamily: 'Helvetica',
    padding: 0,
  },

  // ── Capa ──
  coverPage: {
    backgroundColor: C.black,
    flex: 1,
    position: 'relative',
  },
  coverAccent: {
    backgroundColor: C.primary,
    height: 6,
    width: '100%',
  },
  coverBody: {
    padding: '48px 48px 0 48px',
    flex: 1,
  },
  coverLogo: {
    width: 120,
    marginBottom: 40,
  },
  coverTag: {
    fontSize: 10,
    color: C.primary,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  coverTitle: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    lineHeight: 1.2,
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 1.5,
    marginBottom: 40,
  },
  coverDivider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 24,
  },
  coverMeta: {
    flexDirection: 'row',
    gap: 32,
  },
  coverMetaItem: {
    gap: 4,
  },
  coverMetaLabel: {
    fontSize: 9,
    color: C.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  coverMetaValue: {
    fontSize: 13,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
  },
  coverBpoWatermark: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    fontSize: 180,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff06',
    letterSpacing: -8,
  },
  coverBottomBar: {
    backgroundColor: C.surface,
    padding: '16px 48px',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  coverBottomText: {
    fontSize: 10,
    color: C.textMuted,
  },

  // ── Páginas internas ──
  innerPage: {
    backgroundColor: C.black,
    padding: '0 0 40px 0',
    flex: 1,
  },
  pageHeader: {
    backgroundColor: C.surface,
    padding: '16px 40px',
    borderBottom: `1px solid ${C.border}`,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  pageHeaderTitle: {
    fontSize: 11,
    color: C.primary,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pageHeaderSub: {
    fontSize: 10,
    color: C.textMuted,
  },
  pageBody: {
    padding: '0 40px',
  },

  // ── Seção ──
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: `1px solid ${C.border}`,
  },

  // ── Grade de operação ──
  opGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  opItem: {
    width: '30%',
    backgroundColor: C.surface,
    borderRadius: 4,
    padding: '10px 14px',
    border: `1px solid ${C.border}`,
  },
  opLabel: {
    fontSize: 9,
    color: C.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  opValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  opValueAccent: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
  },

  // ── Tabela de serviços ──
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.surface2,
    padding: '7px 10px',
    borderRadius: 3,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    color: C.textSubtle,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: '8px 10px',
    borderBottom: `1px solid ${C.border}`,
    alignItems: 'center',
  },
  tableRowActive: {
    borderLeft: `2px solid ${C.primary}`,
    paddingLeft: 8,
  },
  tableCell: {
    fontSize: 11,
    color: C.white,
  },
  tableCellMuted: {
    fontSize: 10,
    color: C.textMuted,
  },
  colName:  { flex: 3 },
  colType:  { flex: 1 },
  colQty:   { flex: 1, textAlign: 'center' },
  colValue: { flex: 1.5, textAlign: 'right' },

  badgeTime: {
    backgroundColor: '#fbbf2418',
    color: C.primary,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    padding: '2px 5px',
    borderRadius: 2,
  },
  badgeFixed: {
    backgroundColor: '#4ade8018',
    color: C.green,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    padding: '2px 5px',
    borderRadius: 2,
  },

  // ── Summary financeiro ──
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: `1px solid ${C.border}`,
    alignItems: 'baseline',
  },
  summaryLabel: {
    fontSize: 11,
    color: C.textMuted,
  },
  summaryValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  summaryDiscount: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.green,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
    borderTop: `1px solid ${C.textMuted}`,
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  summaryTotalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  finalBox: {
    backgroundColor: '#fbbf2410',
    border: `1px solid #fbbf2435`,
    borderRadius: 6,
    padding: '20px 24px',
    marginTop: 20,
    alignItems: 'center',
  },
  finalLabel: {
    fontSize: 10,
    color: C.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  finalValue: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    lineHeight: 1.1,
  },
  finalPeriod: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 4,
  },

  // Rodapé
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 9,
    color: C.textSubtle,
  },
  footerAccent: {
    fontSize: 9,
    color: C.primary,
    fontFamily: 'Helvetica-Bold',
  },
});

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
interface ProposalDocumentProps {
  form: PricingFormData;
  pricing: PricingResult;
  logoUrl: string;         // data URL ou URL pública do logo
  clientName?: string;
  generatedAt?: string;
}

// ─── Documento ────────────────────────────────────────────────────────────────
export const ProposalDocument: React.FC<ProposalDocumentProps> = ({
  form,
  pricing,
  logoUrl,
  clientName = 'Cliente',
  generatedAt,
}) => {
  const activeServices = form.services.filter(s => s.active);
  const dateStr = generatedAt ?? new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const termLabel = termLabels[form.term_discount] ?? 'por mês';

  return (
    <Document
      title={`Proposta Comercial BPO — ${clientName}`}
      author="Café com BPO"
      subject="Proposta de precificação BPO"
      creator="Café com BPO — Simulador"
    >
      {/* ════════════════════ PÁGINA 1 — CAPA ════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.coverPage}>
          <View style={s.coverAccent} />
          <View style={s.coverBody}>
            <Image src={logoUrl} style={s.coverLogo} />

            <Text style={s.coverTag}>Proposta Comercial</Text>
            <Text style={s.coverTitle}>Precificação{'\n'}BPO Personalizada</Text>
            <Text style={s.coverSubtitle}>
              Simulação detalhada do custo de operação gerada{'\n'}
              dinamicamente com base na realidade do seu negócio.
            </Text>

            <View style={s.coverDivider} />

            <View style={s.coverMeta}>
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Cliente</Text>
                <Text style={s.coverMetaValue}>{clientName}</Text>
              </View>
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Data</Text>
                <Text style={s.coverMetaValue}>{dateStr}</Text>
              </View>
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Serviços</Text>
                <Text style={s.coverMetaValue}>{activeServices.length} ativados</Text>
              </View>
              <View style={s.coverMetaItem}>
                <Text style={s.coverMetaLabel}>Valor sugerido</Text>
                <Text style={[s.coverMetaValue, { color: C.primary }]}>
                  {fmt(pricing.final_price)}
                </Text>
              </View>
            </View>

            {/* Watermark BPO */}
            <Text style={s.coverBpoWatermark}>BPO</Text>
          </View>

          <View style={s.coverBottomBar}>
            <Text style={s.coverBottomText}>café com bpo · simulador de precificação</Text>
            <Text style={[s.coverBottomText, { color: C.primary }]}>
              Documento gerado em {dateStr}
            </Text>
          </View>
        </View>
      </Page>

      {/* ════════════════════ PÁGINA 2 — OPERAÇÃO ════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.innerPage}>
          <View style={s.pageHeader}>
            <Text style={s.pageHeaderTitle}>Contexto Operacional</Text>
            <Text style={s.pageHeaderSub}>{clientName} · {dateStr}</Text>
          </View>

          <View style={s.pageBody}>
            {/* Grade de operação */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Estrutura da Equipe</Text>
              <View style={s.opGrid}>
                {[
                  { label: 'Custo Total Mensal',  value: fmt(form.operation.total_cost) },
                  { label: 'Pessoas na Operação', value: `${form.operation.people_count} pessoa(s)` },
                  { label: 'Horas / Mês',         value: `${form.operation.hours_per_month}h` },
                  { label: 'Simples Nacional',    value: pct(form.operation.tax_rate) },
                  { label: 'Comissão de Vendas',  value: pct(form.operation.commission_rate || 0) },
                  { label: 'Custo / Hora',        value: fmt(pricing.breakdown.cost_per_hour), accent: true },
                ].map(item => (
                  <View key={item.label} style={s.opItem}>
                    <Text style={s.opLabel}>{item.label}</Text>
                    <Text style={item.accent ? s.opValueAccent : s.opValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Cenário de precificação */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Cenário de Precificação</Text>
              <View style={s.opGrid}>
                {[
                  { label: 'Margem de Lucro',   value: pct(form.desired_profit_margin), accent: true },
                  { label: 'Prazo de Pagamento', value: termLabel },
                  { label: 'Desconto de Prazo',  value: pct(form.term_discount) },
                ].map(item => (
                  <View key={item.label} style={s.opItem}>
                    <Text style={s.opLabel}>{item.label}</Text>
                    <Text style={item.accent ? s.opValueAccent : s.opValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Custo/minuto destaque */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Indicadores de Custo Base</Text>
              <View style={s.opGrid}>
                {[
                  { label: 'Custo por Minuto', value: fmt(pricing.breakdown.cost_per_minute), accent: true },
                  { label: 'Custo por Hora',   value: fmt(pricing.breakdown.cost_per_hour),   accent: true },
                  { label: 'Total Horas/Mês',  value: `${(form.operation.people_count * form.operation.hours_per_month).toFixed(0)}h (equipe)` },
                ].map(item => (
                  <View key={item.label} style={s.opItem}>
                    <Text style={s.opLabel}>{item.label}</Text>
                    <Text style={item.accent ? s.opValueAccent : s.opValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Café com BPO · Proposta Confidencial</Text>
            <Text style={s.footerAccent}>{fmt(pricing.final_price)} {termLabel}</Text>
          </View>
        </View>
      </Page>

      {/* ════════════════════ PÁGINA 3 — SERVIÇOS + FINANCEIRO ════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.innerPage}>
          <View style={s.pageHeader}>
            <Text style={s.pageHeaderTitle}>Serviços & Proposta Financeira</Text>
            <Text style={s.pageHeaderSub}>{clientName} · {dateStr}</Text>
          </View>

          <View style={s.pageBody}>
            {/* Tabela de serviços */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Serviços Contratados ({activeServices.length})</Text>

              {/* Cabeçalho */}
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, s.colName]}>Serviço</Text>
                <Text style={[s.tableHeaderCell, s.colType]}>Tipo</Text>
                <Text style={[s.tableHeaderCell, s.colQty]}>Qtd/mês</Text>
                <Text style={[s.tableHeaderCell, s.colValue]}>Custo Est.</Text>
              </View>

              {/* Linhas */}
              {pricing.breakdown.service_costs.map((item, i) => (
                <View key={i} style={[s.tableRow, s.tableRowActive]}>
                  <View style={s.colName}>
                    <Text style={s.tableCell}>{item.name}</Text>
                  </View>
                  <View style={s.colType}>
                    <Text style={item.type === 'time' ? s.badgeTime : s.badgeFixed}>
                      {item.type === 'time' ? 'Tempo' : 'Fixo'}
                    </Text>
                  </View>
                  <Text style={[s.tableCellMuted, s.colQty]}>{item.monthly_quantity}x</Text>
                  <Text style={[s.tableCell, s.colValue]}>{fmt(item.cost)}</Text>
                </View>
              ))}
            </View>

            {/* Breakdown financeiro */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Composição do Valor</Text>

              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Custo Operacional Total</Text>
                <Text style={s.summaryValue}>{fmt(pricing.breakdown.total_service_cost)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>
                  Margem de Lucro ({pct(form.desired_profit_margin)})
                </Text>
                <Text style={s.summaryValue}>{fmt(pricing.breakdown.profit_amount)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Impostos + Comissão</Text>
                <Text style={s.summaryValue}>{fmt(pricing.breakdown.tax_amount)}</Text>
              </View>
              <View style={s.summaryTotalRow}>
                <Text style={s.summaryTotalLabel}>Subtotal</Text>
                <Text style={s.summaryTotalValue}>{fmt(pricing.price_before_discount)}</Text>
              </View>
              {pricing.discount_amount > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Desconto de Prazo ({pct(form.term_discount)})</Text>
                  <Text style={s.summaryDiscount}>− {fmt(pricing.discount_amount)}</Text>
                </View>
              )}

              {/* Valor final */}
              <View style={s.finalBox}>
                <Text style={s.finalLabel}>Valor Final Sugerido</Text>
                <Text style={s.finalValue}>{fmt(pricing.final_price)}</Text>
                <Text style={s.finalPeriod}>{termLabel}</Text>
              </View>
            </View>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Café com BPO · Proposta Confidencial · {dateStr}</Text>
            <Text style={s.footerAccent}>café com bpo</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
