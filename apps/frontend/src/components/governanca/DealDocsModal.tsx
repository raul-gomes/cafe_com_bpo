import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import {
  getContract,
  previewContract,
  ContractData,
  ContractSection,
} from '../../api/contracts';
import { Deal } from '../../api/governanca';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { ContractDocument } from '../contracts/ContractDocument';
import { formatBRL } from '../../lib/formatters';

interface ProposalDetail {
  id: string;
  client_name: string;
  number?: number | null;
  input_payload: any;
  result_payload: any;
  created_at: string;
}

interface DealDocsModalProps {
  deal: Deal;
  kind: 'proposal' | 'contract';
  onClose: () => void;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const safeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

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

export const DealDocsModal: React.FC<DealDocsModalProps> = ({ deal, kind, onClose }) => {
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [contract, setContract] = useState<ContractData | null>(null);
  const [sections, setSections] = useState<ContractSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        if (kind === 'proposal' && deal.proposal?.id) {
          const resp = await apiClient.get<ProposalDetail>(`/proposals/${deal.proposal.id}`);
          if (!cancelled) setProposal(resp.data);
        } else if (kind === 'contract' && deal.contract?.id) {
          const [data, preview] = await Promise.all([
            getContract(deal.contract.id),
            previewContract(deal.contract.id),
          ]);
          if (!cancelled) {
            setContract(data);
            setSections(preview.sections);
          }
        } else {
          if (!cancelled) setError(true);
        }
      } catch (err) {
        console.error('Erro ao carregar documento:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [deal, kind]);

  const title =
    kind === 'proposal'
      ? `Orçamento${proposal?.number != null ? ` nº ${String(proposal.number).padStart(4, '0')}` : ''} - ${proposal?.client_name ?? deal.name}`
      : `Contrato nº ${deal.contract?.number != null ? String(deal.contract.number).padStart(4, '0') : '—'}`;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-4xl" data-testid="deal-docs-modal">
        <DialogHeader>
          <DialogTitle data-testid="deal-docs-title">{title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-3" data-testid="deal-docs-loading">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-[14px] text-muted-foreground">
            Não foi possível carregar este documento. Tente novamente.
          </div>
        ) : kind === 'proposal' && proposal ? (
          <ProposalView proposal={proposal} deal={deal} />
        ) : kind === 'contract' && contract ? (
          <ContractView contract={contract} sections={sections} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const ProposalView: React.FC<{ proposal: ProposalDetail; deal: Deal }> = ({ proposal, deal }) => {
  const result = proposal.result_payload || {};
  const services: any[] = proposal.input_payload?.services || [];
  const activeServices = services.filter(
    s => (typeof s === 'object' ? s.active !== false : true),
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border p-4">
        <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
          Resumo Financeiro
        </span>
        <div className="mt-2 text-[28px] font-extrabold text-foreground">
          {formatBRL(safeNumber(result.final_price))}
        </div>
        <div className="mt-1 text-[12px] text-muted-foreground">Valor mensal estimado</div>

        <div className="mt-4 space-y-2">
          {result.breakdown ? (
            <>
              <Row label="Custo Operacional" value={formatBRL(safeNumber(result.breakdown.total_service_cost))} />
              <Row label="Margem de Lucro" value={`+${formatBRL(safeNumber(result.breakdown.profit_amount))}`} />
              <Row label="Impostos / Comissões" value={`+${formatBRL(safeNumber(result.breakdown.tax_amount))}`} />
            </>
          ) : (
            <>
              <Row label="Base de Cálculo" value={formatBRL(safeNumber(result.base_price))} />
              <Row
                label={`Complexidade (${proposal.input_payload?.complexity || 'N/A'})`}
                value={`x ${safeNumber(result.complexity_multiplier).toFixed(2)}`}
              />
            </>
          )}
          <div className="my-2 border-t border-border" />
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-foreground">Total Sugerido</span>
            <span className="text-[15px] font-extrabold text-primary-strong">
              {formatBRL(safeNumber(result.final_price))}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
          Escopo do Serviço
        </span>
        <div className="mt-3 space-y-2">
          {activeServices.length > 0 ? (
            activeServices.map((service, idx) => {
              const serviceName = typeof service === 'object' ? service.name : service;
              return (
                <div key={idx} className="flex items-center gap-2 text-[14px] text-foreground">
                  <span className="text-primary-strong">✓</span>
                  {serviceName}
                </div>
              );
            })
          ) : (
            <p className="text-[13px] text-muted-foreground">Lista de serviços não informada.</p>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dados do Cliente
          </span>
          <div className="mt-2 space-y-1.5">
            <Field label="Empresa" value={proposal.client_name || deal.name} />
            <Field label="Criado em" value={formatDate(proposal.created_at)} />
            {proposal.input_payload?.operation ? (
              <>
                <Field
                  label="Custo Operacional Mensal"
                  value={formatBRL(safeNumber(proposal.input_payload.operation.total_cost))}
                />
                <Field
                  label="Margem Desejada"
                  value={`${safeNumber(proposal.input_payload.desired_profit_margin * 100).toFixed(0)}%`}
                />
              </>
            ) : (
              <>
                <Field label="Complexidade" value={proposal.input_payload?.complexity || 'Não informado'} />
                <Field label="Faturamento Mensal" value={formatBRL(safeNumber(proposal.input_payload?.revenue))} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ContractView: React.FC<{ contract: ContractData; sections: ContractSection[] }> = ({ contract, sections }) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      <Badge variant={contract.status === 'finalized' ? 'secondary' : 'default'}>
        {contract.status === 'finalized' ? 'Finalizado' : 'Rascunho'}
      </Badge>
      <span className="text-[13px] text-muted-foreground">Cliente: {contract.client_name}</span>
      {contract.finalized_at && (
        <span className="text-[13px] text-muted-foreground">Finalizado em {formatDate(contract.finalized_at)}</span>
      )}
    </div>
    <div className="max-h-80 overflow-y-auto rounded-xl border border-border p-4">
      <ContractDocument clientName={contract.client_name} sections={sections} />
    </div>
  </div>
);