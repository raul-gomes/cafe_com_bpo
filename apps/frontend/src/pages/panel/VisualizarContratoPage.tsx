import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Printer } from 'lucide-react';
import { getContract, previewContract, ContractData, ContractSection } from '../../api/contracts';
import { ContractDocument } from '../../components/contracts/ContractDocument';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';

export const VisualizarContratoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contract, setContract] = useState<ContractData | null>(null);
  const [sections, setSections] = useState<ContractSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadContract = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(false);
      const [data, preview] = await Promise.all([getContract(id), previewContract(id)]);
      setContract(data);
      setSections(preview.sections);
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

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
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
          { label: contract.client_name, to: `/painel/contrato/${contract.id}` },
          { label: 'Visualizar' },
        ]}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
            <Eye className="size-5" />
          </span>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              Visualizar contrato
              <Badge variant={contract.status === 'finalized' ? 'secondary' : 'default'}>
                {contract.status === 'finalized' ? 'Finalizado' : 'Rascunho'}
              </Badge>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Leitura do contrato completo tal como será assinado.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} data-testid="print-contract-button">
            <Printer className="size-4" /> Imprimir
          </Button>
          <Button variant="ghost" onClick={() => navigate('/painel/contratos')}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        </div>
      </div>

      <ContractDocument clientName={contract.client_name} sections={sections} />
    </div>
  );
};