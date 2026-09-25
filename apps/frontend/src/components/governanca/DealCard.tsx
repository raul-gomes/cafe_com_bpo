import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Deal } from '../../api/governanca';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { formatBRL, maskCNPJ, maskCPF, maskPhone } from '../../lib/formatters';
import { DealTimeline } from './DealTimeline';
import { DealDocsModal } from './DealDocsModal';
import { cn } from '../../lib/utils';

interface DealCardProps {
  deal: Deal;
  onUnreprove?: (deal: Deal) => void;
}

const STATUS_META: Record<
  string,
  { label: string; badge: string }
> = {
  conquistado: {
    label: 'Conquistado',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  em_negociacao: {
    label: 'Em negociação',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  },
  perdido: {
    label: 'Perdido',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  },
};

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={cn('size-4 transition-transform', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const InfoRow = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground normal-case">{value}</span>
    </div>
  ) : null;

export const DealCard: React.FC<DealCardProps> = ({ deal, onUnreprove }) => {
  const [expanded, setExpanded] = useState(false);
  const [docsModal, setDocsModal] = useState<'proposal' | 'contract' | null>(null);
  const status = STATUS_META[deal.status] || STATUS_META.em_negociacao;

  return (
    <Card className="cursor-pointer p-0 transition-colors" data-testid="deal-card">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        data-testid="deal-card-toggle"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: deal.color || '#4287f5' }} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold text-foreground">{deal.name}</span>
              <Badge className={status.badge}>{status.label}</Badge>
              {deal.contract?.number != null && (
                <span className="text-[11px] text-muted-foreground">Contrato nº {String(deal.contract.number).padStart(4, '0')}</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-muted-foreground">
              {deal.segment && <span>{deal.segment}</span>}
              {deal.cnpj && <span>{maskCNPJ(deal.cnpj)}</span>}
              {deal.city && <span>{deal.city}{deal.state ? `/${deal.state}` : ''}</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {deal.proposal?.final_price != null && (
            <span className="text-[15px] font-semibold text-foreground">
              {formatBRL(deal.proposal.final_price)}
            </span>
          )}
          <ChevronDown className={expanded ? 'rotate-180 text-muted-foreground' : 'text-muted-foreground'} />
        </div>
      </button>

      {expanded && (
        <div className="grid gap-5 border-t px-4 pb-4 pt-4 md:grid-cols-[1fr_240px]" data-testid="deal-detail">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              <InfoRow label="Segmento" value={deal.segment} />
              <InfoRow label="E-mail" value={deal.email} />
              <InfoRow label="Telefone" value={deal.phone ? maskPhone(deal.phone) : undefined} />
              <InfoRow label="Cidade" value={deal.city && deal.state ? `${deal.city}/${deal.state}` : deal.city} />
              <InfoRow label="Representante" value={deal.representante_nome} />
              <InfoRow label="Cargo do representante" value={deal.representante_cargo} />
              <InfoRow label="E-mail do representante" value={deal.representante_email} />
              <InfoRow label="Telefone do representante" value={deal.representante_telefone ? maskPhone(deal.representante_telefone) : undefined} />
              <InfoRow label="CPF do representante" value={deal.representante_cpf ? maskCPF(deal.representante_cpf) : undefined} />
            </div>

            {deal.description && (
              <p className="text-[13px] leading-relaxed text-muted-foreground">{deal.description}</p>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2">
              {deal.proposal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    setDocsModal('proposal');
                  }}
                  data-testid="deal-view-proposal"
                >
                  Ver orçamento
                </Button>
              )}
              {deal.contract && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    setDocsModal('contract');
                  }}
                  data-testid="deal-view-contract"
                >
                  Ver contrato
                </Button>
              )}
              {!deal.proposal && !deal.contract && (
                <span className="text-[12px] text-muted-foreground">Ainda sem orçamento ou contrato vinculado.</span>
              )}
              {deal.status === 'perdido' && onUnreprove && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    onUnreprove(deal);
                  }}
                  data-testid="deal-unreprove"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <RotateCcw size={14} /> Voltar à negociação
                </Button>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-lg bg-muted/40 p-3">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Timeline</p>
            <DealTimeline events={deal.timeline} />
          </div>
        </div>
      )}

      {docsModal && (
        <DealDocsModal deal={deal} kind={docsModal} onClose={() => setDocsModal(null)} />
      )}
    </Card>
  );
};