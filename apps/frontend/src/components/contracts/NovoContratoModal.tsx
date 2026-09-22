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
import { generateContract, ContractData } from '../../api/contracts';
import { toast } from 'sonner';

export interface ProposalLight {
  id: string;
  client_name: string;
  prospect_id: string | null;
  created_at: string;
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
  };

  const filteredProposals = prospectId
    ? proposals.filter((p) => p.prospect_id === prospectId)
    : [];

  const handleGenerate = async () => {
    if (!prospectId) return;
    try {
      const contract = await generateContract({
        prospect_id: prospectId,
        proposal_id: proposalId || null,
      });
      toast.success('Contrato gerado a partir do modelo.');
      reset();
      onClose();
      onGenerated(contract);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar o contrato.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>
            Escolha o prospecto e, opcionalmente, o orçamento. Ao gerar, as seções do modelo padrão
            são copiadas e os dados do prospecto/orçamento são preenchidos automaticamente.
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
                <option key={p.id} value={p.id}>{p.client_name}</option>
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
          <Button onClick={handleGenerate} disabled={!prospectId}>Gerar a partir do modelo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};