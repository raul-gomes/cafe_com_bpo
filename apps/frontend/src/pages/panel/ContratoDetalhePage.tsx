import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, FileText, Lock } from 'lucide-react';
import {
  deleteContract,
  finalizeContract,
  getContract,
  updateContract,
  ContractData,
  ContractSection,
} from '../../api/contracts';
import { ContractSectionsEditor } from '../../components/contracts/ContractSectionsEditor';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

export const ContratoDetalhePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [contract, setContract] = useState<ContractData | null>(null);
  const [sections, setSections] = useState<ContractSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const loadContract = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(false);
      const data = await getContract(id);
      setContract(data);
      setSections(data.sections);
      setDirty(false);
    } catch (err) {
      console.error('Erro ao carregar contrato:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isFinalized = contract?.status === 'finalized';

  const handleSave = async () => {
    if (!contract) return;
    try {
      setSaving(true);
      const updated = await updateContract(contract.id, sections);
      setContract(updated);
      setSections(updated.sections);
      setDirty(false);
      toast.success('Alterações salvas.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o contrato.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!contract) return;
    const ok = await confirm({
      title: 'Finalizar contrato',
      message: 'Ao finalizar, o contrato fica imutável e o prospecto é convertido em cliente. Continuar?',
      confirmLabel: 'Finalizar',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      setFinalizing(true);
      const result = await finalizeContract(contract.id);
      toast.success(
        result.client_id
          ? 'Contrato finalizado e prospecto convertido em cliente.'
          : 'Contrato finalizado.',
      );
      await loadContract();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível finalizar o contrato.');
    } finally {
      setFinalizing(false);
    }
  };

  const handleDelete = async () => {
    if (!contract) return;
    const ok = await confirm({
      title: 'Excluir contrato',
      message: 'Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deleteContract(contract.id);
      toast.success('Contrato excluído.');
      navigate('/painel/contratos');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível excluir o contrato.');
    }
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString('pt-BR') : '—';

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar o contrato.
          <div className="mt-3">
            <Button variant="outline" onClick={loadContract}>Tentar novamente</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <Breadcrumb
        items={[
          { label: 'Painel' },
          { label: 'Contratos', to: '/painel/contratos' },
          { label: contract.client_name },
        ]}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
            <FileText className="size-5" />
          </span>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              {contract.client_name}
              <Badge variant={isFinalized ? 'secondary' : 'default'}>
                {isFinalized ? 'Finalizado' : 'Rascunho'}
              </Badge>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Criado em {formatDate(contract.created_at)}
              {contract.finalized_at && ` · finalizado em ${formatDate(contract.finalized_at)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/painel/contrato/${contract.id}/visualizar`)}>
            <Eye className="size-4" /> Visualizar
          </Button>
          <Button variant="ghost" onClick={() => navigate('/painel/contratos')}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        </div>
      </div>

      {isFinalized && (
        <Card className="flex items-center gap-3 p-4">
          <Lock className="size-5 shrink-0 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            Este contrato foi <strong className="text-foreground">finalizado</strong> e não pode mais
            ser editado. O prospecto {contract.client_name} foi convertido em cliente.
          </div>
        </Card>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Seções do contrato</h2>
          {!isFinalized && dirty && (
            <span className="text-xs text-muted-foreground">Alterações não salvas</span>
          )}
        </div>
        <ContractSectionsEditor
          sections={sections}
          readOnly={isFinalized}
          onChange={(next) => {
            setSections(next);
            setDirty(true);
          }}
        />
      </div>

      {!isFinalized && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={handleDelete} disabled={saving || finalizing}>
            Excluir contrato
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={!dirty || saving || finalizing}
              data-testid="save-contract-button"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={saving || finalizing}
              data-testid="finalize-contract-button"
            >
              <CheckCircle2 className="size-4" />
              {finalizing ? 'Finalizando...' : 'Finalizar contrato'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};