/**
 * Pricing study PDF of the public calculator (free, no login).
 *
 * Talks to another business owner: "here is the base to build your proposal".
 * The numbers (operation, scenarios, floor price, capacity) and tips, with the
 * Café visual; the last page invites them to do the rest inside the Café —
 * proposal with their own brand, sent and managed in one place, at no cost.
 */
import React from 'react';
import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { STUDY_TERMS, type PricingStudy } from '../../lib/pricingStudy';

// Kit V4 colors (fixed: a PDF has no light/dark mode).
const K = {
  deep: '#35291F',
  onDeep: '#FFF9F1',
  yellow: '#FFC72C',
  yellowSoft: '#FFF1C6',
  blue: '#2F7FDB',
  ink: '#29241F',
  inkSoft: '#4D453D',
  muted: '#7A7066',
  line: '#E6DFD4',
  canvas: '#F8F5EF',
  white: '#FFFFFF',
};

const SIGNUP_URL = 'https://cafecombpo.cloud/#quero-ser-beta';

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const pct = (value: number) => `${Math.round(value * 100)}%`;
/** Share of capacity: one decimal below 10%, so a small client never reads '0%'. */
const share = (value: number) =>
  value < 0.1 ? `${(value * 100).toFixed(1).replace('.', ',')}%` : pct(value);
const hours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
};

const s = StyleSheet.create({
  page: { paddingBottom: 56, fontFamily: 'Helvetica', fontSize: 10, color: K.ink, backgroundColor: K.white },
  band: { backgroundColor: K.deep, paddingVertical: 28, paddingHorizontal: 40, borderBottomWidth: 4, borderBottomColor: K.yellow },
  bandLogo: { width: 132, marginBottom: 22 },
  kicker: { fontSize: 8, letterSpacing: 1.6, color: K.yellow, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  title: { marginTop: 6, fontSize: 26, color: K.onDeep, fontFamily: 'Times-Roman' },
  subtitle: { marginTop: 6, fontSize: 11, color: K.onDeep, opacity: 0.85, lineHeight: 1.4 },
  body: { paddingHorizontal: 40, paddingTop: 24 },
  h2: { fontSize: 15, fontFamily: 'Times-Roman', color: K.ink, marginBottom: 4 },
  lead: { fontSize: 9.5, color: K.inkSoft, lineHeight: 1.45, marginBottom: 12 },
  kpis: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  kpi: { flex: 1, padding: 10, backgroundColor: K.canvas, borderLeftWidth: 3, borderLeftColor: K.yellow },
  kpiLabel: { fontSize: 7.5, color: K.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  kpiValue: { marginTop: 4, fontSize: 14, fontFamily: 'Helvetica-Bold', color: K.ink },
  kpiHint: { marginTop: 2, fontSize: 7.5, color: K.muted },
  table: { borderWidth: 1, borderColor: K.line, marginBottom: 18 },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: K.line },
  th: { flexDirection: 'row', backgroundColor: K.canvas },
  thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: K.muted, textTransform: 'uppercase', letterSpacing: 0.6, padding: 7 },
  td: { padding: 7, fontSize: 9.5 },
  chosenRow: { backgroundColor: K.yellowSoft },
  floor: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 18, borderWidth: 1, borderColor: K.line, borderLeftWidth: 4, borderLeftColor: '#A33B31' },
  tip: { flexDirection: 'row', marginBottom: 8 },
  tipMark: { width: 16, fontFamily: 'Helvetica-Bold', color: K.yellow, fontSize: 11 },
  tipText: { flex: 1, fontSize: 9.5, lineHeight: 1.45, color: K.inkSoft },
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: K.muted },
  cta: { margin: 40, marginTop: 28, padding: 28, backgroundColor: K.deep, borderRadius: 10 },
  ctaTitle: { fontSize: 22, fontFamily: 'Times-Roman', color: K.onDeep, lineHeight: 1.2 },
  ctaItem: { flexDirection: 'row', marginTop: 10 },
  ctaCheck: { width: 18, color: K.yellow, fontFamily: 'Helvetica-Bold' },
  ctaText: { flex: 1, color: K.onDeep, fontSize: 10.5, lineHeight: 1.45 },
  ctaButton: { marginTop: 22, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: K.yellow, borderRadius: 6, color: K.deep, fontFamily: 'Helvetica-Bold', fontSize: 11, textDecoration: 'none' },
});

interface PricingStudyDocumentProps {
  study: PricingStudy;
  /** Name typed in the calculator (the prospect), when there is one. */
  clientName?: string;
  /** Absolute URLs of the PNG logos (react-pdf does not read SVG). */
  logoOnDeepUrl: string;
  logoUrl: string;
}

const Footer: React.FC = () => (
  <View style={s.footer} fixed>
    <Text>Estudo gerado na Precificação gratuita do Café com BPO · cafecombpo.cloud</Text>
    <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
  </View>
);

export const PricingStudyDocument: React.FC<PricingStudyDocumentProps> = ({ study, clientName, logoOnDeepUrl, logoUrl }) => {
  const today = new Date().toLocaleDateString('pt-BR');
  const chosenScenario = study.scenarios.find(scenario => scenario.chosen);

  return (
    <Document title="Estudo de precificação — Café com BPO" author="Café com BPO" language="pt-BR">
      {/* 1 · The operation */}
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <Image src={logoOnDeepUrl} style={s.bandLogo} />
          <Text style={s.kicker}>Estudo de precificação · {today}</Text>
          <Text style={s.title}>A base para montar a sua proposta{clientName ? ` para ${clientName}` : ''}.</Text>
          <Text style={s.subtitle}>
            Preço justo não é chute: é o custo real do seu tempo, a margem que sustenta o seu negócio e os impostos
            por dentro. Aqui estão os números da sua operação e os cenários para você negociar com segurança.
          </Text>
        </View>

        <View style={s.body}>
          <Text style={s.h2}>Sua operação</Text>
          <Text style={s.lead}>O ponto de partida de qualquer preço: quanto custa uma hora do seu time.</Text>
          <View style={s.kpis}>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Custo da hora</Text>
              <Text style={s.kpiValue}>{brl(study.costPerHour)}</Text>
              <Text style={s.kpiHint}>custo mensal ÷ horas do time</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Horas do time no mês</Text>
              <Text style={s.kpiValue}>{Math.round(study.capacityHours)}h</Text>
              <Text style={s.kpiHint}>sua capacidade produtiva</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Este cliente usa</Text>
              <Text style={s.kpiValue}>{hours(study.totalMinutes)}</Text>
              <Text style={s.kpiHint}>{share(study.capacityShare)} do mês do time</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Cabem no time</Text>
              <Text style={s.kpiValue}>{study.clientsThatFit} clientes</Text>
              <Text style={s.kpiHint}>do mesmo tamanho</Text>
            </View>
          </View>

          <Text style={s.h2}>Serviços e tempo de cada um</Text>
          <Text style={s.lead}>O tempo por mês é o que você vende. Se ele estiver subestimado, todo o resto também estará.</Text>
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.thText, { flex: 3 }]}>Serviço</Text>
              <Text style={[s.thText, { flex: 1, textAlign: 'right' }]}>Tempo/mês</Text>
              <Text style={[s.thText, { flex: 1.3, textAlign: 'right' }]}>Custo/mês</Text>
            </View>
            {study.services.map(service => (
              <View key={service.name} style={s.tr}>
                <Text style={[s.td, { flex: 3 }]}>{service.name}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{service.minutesPerMonth ? hours(service.minutesPerMonth) : 'valor fixo'}</Text>
                <Text style={[s.td, { flex: 1.3, textAlign: 'right' }]}>{brl(service.cost)}</Text>
              </View>
            ))}
            <View style={[s.tr, { backgroundColor: K.canvas }]}>
              <Text style={[s.td, { flex: 3, fontFamily: 'Helvetica-Bold' }]}>Total</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{hours(study.totalMinutes)}</Text>
              <Text style={[s.td, { flex: 1.3, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{brl(study.totalCost)}</Text>
            </View>
          </View>
        </View>
        <Footer />
      </Page>

      {/* 2 · Scenarios and tips */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <Text style={s.kicker}>Cenários</Text>
          <Text style={[s.h2, { fontSize: 20, marginTop: 4 }]}>Quanto cobrar, em cada cenário</Text>
          <Text style={s.lead}>
            Mensalidade com impostos (já por dentro), para cada margem de lucro e prazo de contrato. A linha em
            destaque é a que você escolheu na calculadora: {pct(study.chosenMargin)} de margem, contrato {study.chosenTerm.toLowerCase()}.
          </Text>
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.thText, { flex: 1.4 }]}>Margem</Text>
              {STUDY_TERMS.map(term => (
                <Text key={term.label} style={[s.thText, { flex: 1, textAlign: 'right' }]}>
                  {term.label}{term.discount ? ` (-${pct(term.discount)})` : ''}
                </Text>
              ))}
            </View>
            {study.scenarios.map(scenario => (
              <View key={scenario.margin} style={[s.tr, scenario.chosen ? s.chosenRow : {}]}>
                <Text style={[s.td, { flex: 1.4, fontFamily: scenario.chosen ? 'Helvetica-Bold' : 'Helvetica' }]}>
                  {pct(scenario.margin)}{scenario.chosen ? '  · sua escolha' : ''}
                </Text>
                {scenario.prices.map((price, index) => (
                  <Text key={index} style={[s.td, { flex: 1, textAlign: 'right', fontFamily: scenario.chosen ? 'Helvetica-Bold' : 'Helvetica' }]}>
                    {brl(price)}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          <View style={s.floor}>
            <View style={{ flex: 1 }}>
              <Text style={s.kpiLabel}>Preço mínimo (sem lucro)</Text>
              <Text style={[s.kpiValue, { fontSize: 16 }]}>{brl(study.floorPrice)} / mês</Text>
              <Text style={[s.kpiHint, { fontSize: 8.5 }]}>
                Abaixo disso, você paga para trabalhar. É o seu limite na negociação, nunca o seu preço.
              </Text>
            </View>
            <View style={{ width: 180, paddingLeft: 12 }}>
              <Text style={s.kpiLabel}>Lucro por hora deste cliente</Text>
              <Text style={[s.kpiValue, { fontSize: 16 }]}>{brl(study.profitPerHour)}</Text>
            </View>
          </View>

          <Text style={s.h2}>Dicas para montar a proposta</Text>
          {[
            `Apresente primeiro o valor do cenário escolhido${chosenScenario ? ` (${brl(chosenScenario.prices[0])} no mensal)` : ''}. Desconto só em troca de prazo: trimestral ou anual.`,
            'Mostre o escopo em tempo e entregas, não só o preço. O cliente entende o que está comprando e para de comparar com “o sobrinho que faz planilha”.',
            'Combine prazos de envio de documentos pelo cliente. Atraso dele vira hora extra sua, e hora extra sem cobrança corrói a margem.',
            'Reveja o tempo real depois de 60 dias. Se o cliente usa mais horas do que o estudo previu, é hora de reajustar.',
            `Planeje a capacidade: este cliente ocupa ${share(study.capacityShare)} do mês do time. Antes de fechar o próximo, veja se ainda cabe.`,
          ].map((tip, index) => (
            <View key={index} style={s.tip}>
              <Text style={s.tipMark}>{index + 1}</Text>
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
        <Footer />
      </Page>

      {/* 3 · The invitation */}
      <Page size="A4" style={s.page}>
        <View style={[s.body, { paddingTop: 40 }]}>
          <Image src={logoUrl} style={{ width: 120 }} />
        </View>
        <View style={s.cta}>
          <Text style={s.kicker}>Próximo passo</Text>
          <Text style={[s.ctaTitle, { marginTop: 8 }]}>Agora transforme este estudo numa proposta com a cara da sua empresa.</Text>
          {[
            'Proposta em PDF com a sua logo e as suas cores, pronta para enviar ao cliente.',
            'Link para o cliente aprovar online, e você acompanha cada orçamento num lugar só.',
            'Depois do sim: contrato, rotinas mensais por cliente e o tempo de cada atividade.',
            'Uma comunidade de quem opera BPO de verdade, com cafés toda semana.',
          ].map(item => (
            <View key={item} style={s.ctaItem}>
              <Text style={s.ctaCheck}>•</Text>
              <Text style={s.ctaText}>{item}</Text>
            </View>
          ))}
          <Text style={[s.ctaText, { marginTop: 18, fontFamily: 'Helvetica-Bold' }]}>
            Sem pagar nada para começar: entre para o Beta do Café com BPO.
          </Text>
          <Link src={SIGNUP_URL} style={s.ctaButton}>Quero ser Beta: cafecombpo.cloud</Link>
        </View>
        <View style={s.body}>
          <Text style={[s.lead, { textAlign: 'center' }]}>
            Feito por quem opera, para quem quer escalar o BPO financeiro sem endoidar.
          </Text>
        </View>
        <Footer />
      </Page>
    </Document>
  );
};
