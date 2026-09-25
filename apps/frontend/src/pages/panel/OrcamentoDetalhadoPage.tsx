import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient, getApiUrl } from '../../api/client';
import { useGeneratePDF } from '../../lib/useGeneratePDF';
import { serviceMonthlyValue } from '../../lib/pricingEngine';
import logoAsset from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import { getClients, ClientData } from '../../api/clients';
import { CLIENT_DECISION_LABELS, ClientDecision } from '../../api/proposals';
import { generateShareLink, ShareLinkResponse } from '../../api/proposals';
import { DealTimeline } from '../../components/governanca/DealTimeline';
import { TimelineEvent } from '../../api/governanca';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { MessageSquare, Link2, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Proposal {
  id: string;
  client_name: string;
  number?: number | null;
  input_payload: any;
  result_payload: any;
  created_at: string;
  public_hash?: string | null;
  public_hash_expires_at?: string | null;
  shared_at?: string | null;
  shared_count?: number;
  client_decision?: ClientDecision | null;
  client_observation?: string | null;
  client_decided_at?: string | null;
  decision_history?: DecisionHistoryEntry[] | null;
}

interface DecisionHistoryEntry {
  decision: ClientDecision;
  observation?: string | null;
  decided_at?: string | null;
}

export const OrcamentoDetalhadoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState<ShareLinkResponse | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { generate: generatePDF, isGenerating, error: pdfError } = useGeneratePDF();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [proposalResp, clientsResp] = await Promise.all([
        apiClient.get<Proposal>(`/proposals/${id}`),
        getClients(),
      ]);
      setProposal(proposalResp.data);
      setClients(clientsResp);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  const handleGenerateShareLink = async () => {
    if (!proposal) return;
    try {
      const link = await generateShareLink(proposal.id);
      setShareLink(link);
      toast.success('Link de análise gerado!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao gerar o link de análise.');
    }
  };

  const handleCopyLink = async () => {
    if (!proposal) return;
    try {
      let url = shareLink?.url || null;
      if (!url) {
        const link = await generateShareLink(proposal.id);
        setShareLink(link);
        url = link.url;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado para a área de transferência!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível copiar o link.');
    }
  };

  const handlePrint = async () => {
    if (!proposal) return;

    const logoUrl = user?.company_logo_url || user?.avatar_url;
    const finalLogoUrl = logoUrl
      ? logoUrl.startsWith('http') ? logoUrl : `${getApiUrl()}${logoUrl}`
      : logoAsset;

    const client = clients.find(
      c => c.name.trim().toLowerCase() === proposal.client_name.trim().toLowerCase()
    );

    const ok = await generatePDF({
      form: proposal.input_payload,
      pricing: proposal.result_payload,
      logoUrl: finalLogoUrl,
      clientName: proposal.client_name,
      clientEmail: client?.email || '',
      provider: user,
      proposalNumber: proposal.number,
    });

    if (ok) {
      toast.success('Proposta gerada em PDF!');
    } else {
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    }
  };

  const handleEmail = async () => {
    if (!proposal) return;

    const client = clients.find(
      c => c.name.trim().toLowerCase() === proposal.client_name.trim().toLowerCase()
    );
    const email = client?.email;

    if (!email) {
      toast.error(
        `Nenhum e-mail cadastrado para ${proposal.client_name}. Cadastre o contato em Meus Clientes.`
      );
      return;
    }

    try {
      let shareUrl = shareLink?.url;
      if (!shareUrl) {
        const link = await generateShareLink(proposal.id);
        setShareLink(link);
        shareUrl = link.url;
      }
      await apiClient.post(`/proposals/${id}/send-email`, {
        email,
        client_name: proposal.client_name,
        message: 'Olá, segue o orçamento detalhado da nossa proposta de serviços BPO.',
        share_url: shareUrl,
      });
      fetchData();
      toast.success(`E-mail enviado para ${email}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao enviar e-mail.');
    }
  };

  const handleWhatsApp = async () => {
    if (!proposal) return;

    const client = clients.find(
      c => c.name.trim().toLowerCase() === proposal.client_name.trim().toLowerCase()
    );
    const phone = client?.phone;

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error(
        `Nenhum telefone cadastrado para ${proposal.client_name}. Cadastre o contato em Meus Clientes.`
      );
      return;
    }

    try {
      let shareUrl = shareLink?.url;
      if (!shareUrl) {
        const link = await generateShareLink(proposal.id);
        setShareLink(link);
        shareUrl = link.url;
      }
      handlePrint();
      const cleanPhone = phone.replace(/\D/g, '');
      const value = formatPrice(proposal.result_payload?.final_price || 0);
      const message = `Olá ${proposal.client_name}, seguem os detalhes do orçamento: Valor: ${value}. Acesse o link para dar seu parecer: ${shareUrl}`;
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao preparar o envio.');
    }
  };

  const safeNumber = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(value));

  const formatNumber = (value: unknown, decimals = 2): string => {
    return safeNumber(value).toFixed(decimals);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="animate-[panelFadeIn_0.4s_ease-out]">
        <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Orçamento Detalhado' }]} />
        <div className="mb-6 mt-8">
          <Skeleton className="h-8 w-[200px]" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="animate-[panelFadeIn_0.4s_ease-out]">
        <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Orçamento Detalhado' }]} />
        <Card className="p-12 text-center">
          <h3 className="mb-2 text-[16px] font-bold text-foreground">Orçamento não encontrado</h3>
          <Button variant="default" onClick={() => navigate('/painel')}>
            Voltar para Orçamentos
          </Button>
        </Card>
      </div>
    );
  }

  const result = proposal.result_payload || {};

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb
        items={[
          { label: 'Painel', to: '/painel' },
          { label: 'Orçamentos', to: '/painel/orcamentos' },
          { label: 'Orçamento Detalhado' },
        ]}
      />

      {/* Header */}
      <div className="mb-8 mt-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
              {proposal.client_name}
            </h1>
            {proposal.number != null && (
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-[12px] font-bold text-muted-foreground">
                Orçamento nº {String(proposal.number).padStart(4, '0')}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[13px] text-muted-foreground">
              Criado em {formatDate(proposal.created_at)}
            </p>
            {proposal.client_decision && (
              <ClientDecisionTag decision={proposal.client_decision} />
            )}
          </div>
          {proposal.client_observation && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="font-bold">Observação do cliente: </span>
              {proposal.client_observation}
            </div>
          )}
          {pdfError && (
            <p className="mt-2 text-[13px] font-semibold text-red-500">⚠️ {pdfError}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleCopyLink}>
            <Link2 size={16} />
            {shareLink ? 'Copiar Link' : 'Copiar Link de Análise'}
          </Button>
          <Button
            variant="default"
            onClick={() => navigate(`/painel/editar-orcamento/${id}`)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar Orçamento
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={isGenerating}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            {isGenerating ? 'Gerando...' : 'Imprimir PDF'}
          </Button>
          <Button variant="outline" onClick={handleEmail}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            E-mail
          </Button>
          <Button variant="outline" onClick={handleWhatsApp}>
            <MessageSquare size={16} />
            Enviar via WhatsApp
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Resumo Financeiro */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">Resumo Financeiro</h2>
          <div className="text-[32px] font-extrabold text-foreground">
            {formatPrice(result.final_price || 0)}
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground">Valor mensal estimado</div>

          <div className="mt-6 space-y-3">
            {result.breakdown ? (
              <>
                <Row label="Custo Operacional" value={formatPrice(result.breakdown.total_service_cost || 0)} />
                <Row label="Margem de Lucro" value={`+${formatPrice(result.breakdown.profit_amount || 0)}`} />
                <Row label="Impostos / Comissões" value={`+${formatPrice(result.breakdown.tax_amount || 0)}`} />
              </>
            ) : (
              <>
                <Row label="Base de Cálculo" value={formatPrice(result.base_price || 0)} />
                <Row
                  label={`Complexidade (${proposal.input_payload?.complexity || 'N/A'})`}
                  value={`x ${formatNumber(result.complexity_multiplier, 2) || '1.00'}`}
                />
              </>
            )}
            <div className="my-2 border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-foreground">Total Sugerido</span>
              <span className="text-[15px] font-extrabold text-primary-strong">
                {formatPrice(result.final_price || 0)}
              </span>
            </div>
          </div>
        </Card>

        {/* Escopo do Serviço */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">
            Escopo do Serviço
          </h2>
          <div className="space-y-3">
            {proposal.input_payload?.services?.map((service: any, idx: number) => {
              const serviceName = typeof service === 'object' ? service.name : service;
              const isActive = typeof service === 'object' ? service.active : true;

              if (!isActive && typeof service === 'object') return null;

              const cost =
                result.breakdown?.service_costs?.find(
                  (sc: any) => sc.name === serviceName,
                )?.cost ?? 0;
              const value = serviceMonthlyValue(cost, result);

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 text-[14px] text-foreground"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-primary-strong">✓</span>
                    <span className="truncate">{serviceName}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[12px]">
                    {typeof service === 'object' && service.monthly_quantity > 0 && (
                      <span className="rounded bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                        {service.monthly_quantity}x/mês
                      </span>
                    )}
                    <span className="font-bold text-foreground">
                      {value > 0 ? formatPrice(value) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
            {!proposal.input_payload?.services && (
              <p className="text-[13px] text-muted-foreground">
                Lista de serviços não informada.
              </p>
            )}
          </div>
        </Card>

        {/* Envio e avaliação do cliente */}
        <Card className="col-span-2 p-5">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">
            Envio e avaliação do cliente
          </h2>

          {shareLink ? (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <input
                readOnly
                value={shareLink.url}
                aria-label="Link de análise do orçamento"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none"
              />
              <Button size="sm" variant="outline" onClick={handleCopyLink}>
                <Copy size={14} /> Copiar
              </Button>
              <span className="text-[12px] text-muted-foreground">
                Expira em {formatDate(shareLink.expires_at)}
              </span>
            </div>
          ) : (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border p-4">
              <p className="text-[13px] text-muted-foreground">
                {proposal.shared_at
                  ? 'Enviado ao cliente anteriormente. Gere um novo link (o anterior será cancelado).'
                  : 'Ainda não enviado ao cliente. Envie o link por e-mail, WhatsApp ou copie.'}
              </p>
              <Button variant="outline" size="sm" onClick={handleGenerateShareLink}>
                <Link2 size={14} />
                Gerar link de análise
              </Button>
            </div>
          )}

          <ProposalShareTimeline
            sharedAt={proposal.shared_at}
            decisionHistory={proposal.decision_history}
            decision={proposal.client_decision}
            decidedAt={proposal.client_decided_at}
          />

          <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
            <span>Enviado {proposal.shared_count || 0} vez(es)</span>
            {proposal.shared_at && (
              <span>Último envio: {formatDate(proposal.shared_at)}</span>
            )}
          </div>
        </Card>

        {/* Dados do Cliente e Simulação */}
        <Card className="col-span-2 p-5">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">Dados do Cliente e Simulação</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Empresa" value={proposal.client_name} />
            {proposal.input_payload?.operation ? (
              <>
                <Field
                  label="Custo Operacional Mensal"
                  value={formatPrice(proposal.input_payload.operation.total_cost || 0)}
                />
                <Field
                  label="Capacidade (Horas/Mês)"
                  value={`${safeNumber(
                    proposal.input_payload.operation.people_count *
                      proposal.input_payload.operation.hours_per_month
                  )}h`}
                />
                <Field
                  label="Margem Desejada"
                  value={`${formatNumber(proposal.input_payload.desired_profit_margin * 100, 0)}%`}
                />
              </>
            ) : (
              <>
                <Field label="Complexidade" value={proposal.input_payload?.complexity || 'Não informado'} />
                <Field label="Faturamento Mensal" value={formatPrice(proposal.input_payload?.revenue || 0)} />
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

/** Small helper components */
const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-[13px] text-muted-foreground">{label}</span>
    <span className="text-[13px] font-medium text-foreground">{value}</span>
  </div>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <span className="text-[14px] text-foreground">{value}</span>
  </div>
);

const DECISION_TAG_STYLES: Record<ClientDecision, string> = {
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  changes: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

const ClientDecisionTag = ({ decision }: { decision: ClientDecision }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${DECISION_TAG_STYLES[decision]}`}
  >
    <CheckCircle2 size={12} />
    {CLIENT_DECISION_LABELS[decision]}
  </span>
);

const DECISION_EVENT_TYPE: Record<ClientDecision, TimelineEvent['type']> = {
  approved: 'approved',
  changes: 'changes',
  rejected: 'rejected',
};

interface ShareTimelineProps {
  sharedAt?: string | null;
  decisionHistory?: DecisionHistoryEntry[] | null;
  decision?: ClientDecision | null;
  decidedAt?: string | null;
}

const ProposalShareTimeline: React.FC<ShareTimelineProps> = ({
  sharedAt,
  decisionHistory,
  decision,
  decidedAt,
}) => {
  const events: TimelineEvent[] = [];
  if (sharedAt) {
    events.push({ type: 'sent', label: 'Enviado ao cliente para análise', date: sharedAt });
  }

  const history =
    decisionHistory && decisionHistory.length > 0
      ? decisionHistory
      : decision && decidedAt
        ? [{ decision, decided_at: decidedAt }]
        : [];

  history.forEach(entry => {
    events.push({
      type: DECISION_EVENT_TYPE[entry.decision],
      label: `Cliente respondeu: ${CLIENT_DECISION_LABELS[entry.decision]}`,
      date: entry.decided_at,
    });
  });

  return (
    <div>
      <DealTimeline events={events} />
      {events.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          Envie o orçamento ao cliente para acompanhar o parecer.
        </p>
      )}
    </div>
  );
};
