import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { getProspects, ProspectData } from '../../api/prospects';
import { apiClient } from '../../api/client';
import {
  generateContract,
  getContractMissingFields,
  ContractData,
  ContractFieldDescriptor,
} from '../../api/contracts';
import { ContractFieldsModal } from './ContractFieldsModal';
import { toast } from 'sonner';
import { CLIENT_DECISION_LABELS, ClientDecision } from '../../api/proposals';

export interface ProposalLight {
  id: string;
  client_name: string;
  prospect_id: string | null;
  created_at: string;
  number?: number | null;
  client_decision?: ClientDecision | null;
}

export interface NovoContratoModalProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (contract: ContractData) => void;
}

export const NovoContratoModal: React.FC<NovoContratoModalProps> = ({
  open,
  onClose,
  onGenerated,
}) => {
  const [prospects, setProspects] = useState<ProspectData[]>([]);
  const [proposals, setProposals] = useState<ProposalLight[]>([]);
  const [loading, setLoading] = useState(false);
  const [prospectId, setProspectId] = useState('');
  const [proposalId, setProposalId] = useState('');

  const [step, setStep] = useState<'form' | 'fields'>('form');
  const [descriptors, setDescriptors] = useState<ContractFieldDescriptor[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    Promise.all([
      getProspects(),
      apiClient.get<ProposalLight[]>('/proposals/'),
    ])
      .then(([prospectsData, proposalsResp]) => {
        if (!active) return;
        setProspects(prospectsData);
        setProposals(proposalsResp.data);
      })
      .catch(() => {
        if (active) toast.error('Não foi possível carregar prospectos/orçamentos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const reset = () => {
    setProspectId('');
    setProposalId('');
    setStep('form');
    setDescriptors([]);
  };

  const filteredProposals = prospectId
    ? proposals.filter((p) => p.prospect_id === prospectId)
    : [];

  const formatProposalOption = (p: ProposalLight): string => {
    const num = p.number != null ? String(p.number).padStart(4, '0') : 's/n';
    const status = p.client_decision ? ` - ${CLIENT_DECISION_LABELS[p.client_decision]}` : '';
    return `Orçamento ${num}${status}`;
  };

  const handleNext = async () => {
    if (!prospectId) return;
    try {
      setFieldsLoading(true);
      const data = await getContractMissingFields(prospectId, proposalId || null);
      setDescriptors(data.fields);
      setStep('fields');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar os campos do contrato.');
    } finally {
      setFieldsLoading(false);
    }
  };

  const handleGenerate = async (fields: Record<string, unknown>) => {
    if (!prospectId) return;
    const contract = await generateContract({
      prospect_id: prospectId,
      proposal_id: proposalId || null,
      fields,
    });
    toast.success('Contrato gerado a partir do modelo.');
    reset();
    onClose();
    onGenerated(contract);
  };

  return (
    <>
      <Dialog open={open && step === 'form'} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
            <DialogDescription>
              Escolha o prospecto e, opcionalmente, o orçamento. Em seguida, informe os dados que
              ainda não existem no sistema para gerar o contrato.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-prospect">Prospecto</Label>
              <select
                id="contract-prospect"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                value={prospectId}
                onChange={(e) => {
                  setProspectId(e.target.value);
                  setProposalId('');
                }}
                data-testid="contract-prospect-select"
              >
                <option value="">{loading ? 'Carregando...' : 'Selecione um prospecto'}</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-proposal">Orçamento (opcional)</Label>
              <select
                id="contract-proposal"
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                value={proposalId}
                onChange={(e) => setProposalId(e.target.value)}
                disabled={!prospectId}
                data-testid="contract-proposal-select"
              >
                <option value="">— Sem orçamento —</option>
                {filteredProposals.map((p) => (
                  <option key={p.id} value={p.id}>{formatProposalOption(p)}</option>
                ))}
              </select>
              {prospectId && filteredProposals.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  O prospecto selecionado ainda não possui orçamentos vinculados.
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button onClick={handleNext} disabled={!prospectId || fieldsLoading}>
              {fieldsLoading ? 'Carregando...' : 'Continuar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContractFieldsModal
        open={open && step === 'fields'}
        title="Dados do contrato"
        description="Preencha os campos abaixo. Os dados que já existem no perfil, prospecto ou orçamento são preenchidos automaticamente."
        descriptors={descriptors}
        submitLabel="Gerar contrato"
        onClose={() => {
          setStep('form');
        }}
        onSubmit={handleGenerate}
      />
    </>
  );
};