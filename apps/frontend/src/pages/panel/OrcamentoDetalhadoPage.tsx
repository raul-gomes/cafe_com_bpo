import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient, getApiUrl } from '../../api/client';
import { useGeneratePDF } from '../../lib/useGeneratePDF';
import logoAsset from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import { getClients, ClientData } from '../../api/clients';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Proposal {
  id: string;
  client_name: string;
  input_payload: any;
  result_payload: any;
  created_at: string;
}

export const OrcamentoDetalhadoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('+55');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { generate: generatePDF } = useGeneratePDF();

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

  const handlePrint = async () => {
    if (!proposal) return;

    const logoUrl = user?.company_logo_url || user?.avatar_url;
    const finalLogoUrl = logoUrl
      ? logoUrl.startsWith('http') ? logoUrl : `${getApiUrl()}${logoUrl}`
      : logoAsset;

    const client = clients.find(
      c => c.name.trim().toLowerCase() === proposal.client_name.trim().toLowerCase()
    );

    await generatePDF({
      form: proposal.input_payload,
      pricing: proposal.result_payload,
      logoUrl: finalLogoUrl,
      clientName: proposal.client_name,
      clientEmail: client?.email || '',
      provider: user,
    });
  };

  const handleEmail = async () => {
    if (!proposal) return;

    const clientEmail = clients.find(
      c => c.name.trim().toLowerCase() === proposal.client_name.trim().toLowerCase()
    )?.email;
    const email = clientEmail || prompt('Digite o e-mail do destinatário:');
    if (!email) return;

    try {
      await apiClient.post(`/proposals/${id}/send-email`, {
        email,
        client_name: proposal.client_name,
        message: 'Olá, segue o orçamento detalhado da nossa proposta de serviços BPO.',
      });
      toast.success('E-mail enviado com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao enviar e-mail.');
    }
  };

  const handleWhatsApp = () => {
    setWhatsappModalOpen(true);
  };

  const handleSendWhatsApp = () => {
    if (!proposal) return;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const value = formatPrice(proposal.result_payload?.final_price || 0);
    const message = `Olá ${proposal.client_name}, seguem os detalhes do orçamento: Valor: ${value}. Acesse o painel para mais informações.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setWhatsappModalOpen(false);
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
          <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
            {proposal.client_name}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Criado em {formatDate(proposal.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" onClick={handlePrint}>
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
            Imprimir PDF
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
              <span className="text-[15px] font-extrabold text-primary">
                {formatPrice(result.final_price || 0)}
              </span>
            </div>
          </div>
        </Card>

        {/* Escopo do Serviço */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">Escopo do Serviço</h2>
          <div className="space-y-3">
            {proposal.input_payload?.services?.map((service: any, idx: number) => {
              const serviceName = typeof service === 'object' ? service.name : service;
              const isActive = typeof service === 'object' ? service.active : true;

              if (!isActive && typeof service === 'object') return null;

              return (
                <div key={idx} className="flex items-center gap-2 text-[14px] text-foreground">
                  <span className="text-primary">✓</span>
                  {serviceName}
                </div>
              );
            })}
            {!proposal.input_payload?.services && (
              <p className="text-[13px] text-muted-foreground">Lista de serviços não informada.</p>
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

      {/* WhatsApp Dialog */}
      <Dialog
        open={whatsappModalOpen}
        onOpenChange={(open) => {
          if (!open) setWhatsappModalOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar via WhatsApp</DialogTitle>
            <DialogDescription>
              Digite o número do WhatsApp para {proposal?.client_name}:
            </DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+55 (11) 99999-9999"
              className="w-full"
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="ghost" onClick={() => setWhatsappModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleSendWhatsApp}
              disabled={phoneNumber.replace(/\D/g, '').length < 10}
            >
              <MessageSquare size={16} /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
