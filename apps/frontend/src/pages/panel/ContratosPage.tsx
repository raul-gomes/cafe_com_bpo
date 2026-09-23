import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileText, Info, Plus } from 'lucide-react';
import {
  getContracts,
  getContractTemplate,
  updateContractTemplate,
  ContractData,
  ContractSection,
} from '../../api/contracts';
import { NovoContratoModal } from '../../components/contracts/NovoContratoModal';
import { ContractSectionsEditor } from '../../components/contracts/ContractSectionsEditor';
import { ContractDocument } from '../../components/contracts/ContractDocument';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';

const PLACEHOLDER_GROUPS: string[][] = [
  ['{{empresa_contratada}}', '{{cnpj_contratada}}', '{{endereco_contratada}}', '{{socio_contratada}}', '{{email_contratada}}'],
  ['{{nome}}', '{{cnpj}}', '{{telefone}}', '{{email}}', '{{segmento}}', '{{endereco}}', '{{cidade}}', '{{uf}}'],
  ['{{rua}}', '{{numero}}', '{{complemento}}', '{{bairro}}', '{{cep}}'],
  ['{{valor_mensal}}', '{{valor_mensal_extenso}}', '{{valor_servicos}}', '{{valor_sem_desconto}}', '{{pessoas}}', '{{horas}}', '{{complexidade}}', '{{faturamento}}', '{{desconto_prazo}}', '{{servicos_contratados}}'],
  ['{{cpf_contratada}}', '{{municipio_contratada}}', '{{socio_contratante}}', '{{cpf_contratante}}', '{{dia}}', '{{mes}}', '{{ano}}'],
];

export const ContratosPage: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('contracts');
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState(false);

  const [templateSections, setTemplateSections] = useState<ContractSection[]>([]);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);

  const [newContractOpen, setNewContractOpen] = useState(false);

  useEffect(() => {
    loadContracts();
  }, []);

  useEffect(() => {
    if (activeTab !== 'template' || templateLoaded) return;
    loadTemplate();
  }, [activeTab, templateLoaded]);

  const loadContracts = async () => {
    try {
      setContractsLoading(true);
      setContractsError(false);
      const data = await getContracts();
      setContracts(data);
    } catch (err) {
      console.error('Erro ao carregar contratos:', err);
      setContractsError(true);
    } finally {
      setContractsLoading(false);
    }
  };

  const loadTemplate = async () => {
    try {
      setTemplateLoading(true);
      const data = await getContractTemplate();
      setTemplateSections(data.sections);
      setTemplateLoaded(true);
    } catch (err) {
      console.error('Erro ao carregar o modelo padrão:', err);
      toast.error('Não foi possível carregar o modelo padrão.');
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      setTemplateSaving(true);
      const updated = await updateContractTemplate(templateSections);
      setTemplateSections(updated.sections);
      setTemplateDirty(false);
      toast.success('Modelo padrão salvo.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o modelo padrão.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleGenerated = (contract: ContractData) => {
    navigate(`/painel/contrato/${contract.id}`);
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <Breadcrumb
        items={[
          { label: 'Painel' },
          { label: 'Contratos' },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <FileText className="size-6 text-primary-strong" /> Contratos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gere contratos a partir do modelo padrão e finalize para converter o prospecto em cliente.
          </p>
        </div>
        <Button onClick={() => setNewContractOpen(true)} data-testid="new-contract-button">
          <Plus className="size-4" /> Novo contrato
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="contracts-tabs">
        <TabsList>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="template">Modelo padrão</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts">
          {contractsLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : contractsError ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Não foi possível carregar os contratos.
              <div className="mt-3">
                <Button variant="outline" onClick={loadContracts}>Tentar novamente</Button>
              </div>
            </Card>
          ) : contracts.length === 0 ? (
            <Card className="p-10 text-center">
              <FileText className="mx-auto size-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">Nenhum contrato criado ainda.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button onClick={() => setNewContractOpen(true)} data-testid="empty-new-contract">
                  <Plus className="size-4" /> Novo contrato
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('template')}>
                  Definir modelo padrão
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {contracts.map((contract) => (
                <Card key={contract.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => navigate(`/painel/contrato/${contract.id}`)}
                      data-testid={`contract-card-${contract.id}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {contract.client_name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {contract.sections.length} seções · criado em {formatDate(contract.created_at)}
                        </span>
                      </span>
                      <Badge variant={contract.status === 'finalized' ? 'secondary' : 'default'}>
                        {contract.status === 'finalized' ? 'Finalizado' : 'Rascunho'}
                      </Badge>
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/painel/contrato/${contract.id}/visualizar`)}
                      data-testid={`view-contract-${contract.id}`}
                    >
                      <Eye className="size-3.5" />
                      <span className="hidden sm:inline">Visualizar</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="template">
          <div className="flex flex-col gap-4">
            <Card className="flex items-start gap-3 border-primary/20 bg-primary/5 p-4">
              <Info className="mt-0.5 size-4 shrink-0 text-primary-strong" />
              <div className="text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">Tokens disponíveis</p>
                <p className="mt-1">
                  Ao gerar um contrato, os tokens abaixo são substituídos pelos dados da
                  sua empresa (CONTRATADA, do perfil), do prospecto (CONTRATANTE) e do
                  orçamento vinculado. Tokens sem valor permanecem no texto para
                  preenchimento manual antes da finalização.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PLACEHOLDER_GROUPS.flat().map((token) => (
                    <code key={token} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
                      {token}
                    </code>
                  ))}
                </div>
              </div>
            </Card>

            {templateLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ContractSectionsEditor
                sections={templateSections}
                onChange={(sections) => {
                  setTemplateSections(sections);
                  setTemplateDirty(true);
                }}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setTemplatePreviewOpen((open) => !open)}
                disabled={templateLoading || templateSaving}
                data-testid="template-preview-button"
              >
                <Eye className="size-3.5" />
                {templatePreviewOpen ? 'Ocultar visualização' : 'Visualizar modelo'}
              </Button>
              <Button
                variant="outline"
                onClick={loadTemplate}
                disabled={templateLoading || templateSaving}
              >
                Descartar alterações
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={!templateDirty || templateLoading || templateSaving}
                data-testid="save-template-button"
              >
                {templateSaving ? 'Salvando...' : 'Salvar modelo padrão'}
              </Button>
            </div>

            {templatePreviewOpen && !templateLoading && (
              <ContractDocument
                clientName="Modelo padrão de contrato"
                sections={templateSections}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <NovoContratoModal
        open={newContractOpen}
        onClose={() => setNewContractOpen(false)}
        onGenerated={handleGenerated}
      />
    </div>
  );
};