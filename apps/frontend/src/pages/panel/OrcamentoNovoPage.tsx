import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PricingCalculatorLayout } from '../../components/pricing/PricingCalculatorLayout';
import { apiClient } from '../../api/client';
import { calculatePricing } from '../../lib/pricingEngine';
import { PricingFormData } from '../../schemas/pricing';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';

export const OrcamentoNovoPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState<PricingFormData | undefined>(undefined);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (id) {
      const fetchProposal = async () => {
        try {
          const resp = await apiClient.get(`/proposals/${id}`);
          setInitialData(resp.data.input_payload);
          setClientName(resp.data.client_name);
        } catch (err) {
          console.error('Erro ao carregar orçamento:', err);
          toast.error('Não foi possível carregar o orçamento.');
          navigate('/painel');
        } finally {
          setLoading(false);
        }
      };
      fetchProposal();
    } else {
      // Se não há ID, verifica se há uma simulação pendente no sessionStorage
      const raw = sessionStorage.getItem('cafe_bpo_proposal');
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.form) {
            setInitialData(saved.form);
            setClientName(saved.clientName || '');
          }
        } catch (e) {
          console.error('Erro ao carregar simulação pendente:', e);
        }
      }
      setLoading(false);
    }
  }, [id, navigate, toast]);

  const handleSave = async (formData: PricingFormData, name: string) => {
    try {
      setSaving(true);
      
      const result = calculatePricing(
        formData.operation,
        formData.services,
        formData.desired_profit_margin,
        formData.term_discount
      );

      const payload = {
        client_name: name,
        input_payload: formData,
        result_payload: result
      };

      if (id) {
        await apiClient.put(`/proposals/${id}`, payload);
      } else {
        await apiClient.post('/proposals/', payload);
      }

      toast.success('Orçamento salvo com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar orçamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="w-full h-[400px]" />
      </div>
    );
  }

  return (
    <div className="orcamento-novo-page animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: id ? 'Editar Orçamento' : 'Nova Precificação' }]} />

      <div className="flex justify-between items-end mb-7">
        <div>
          <h1>{id ? 'Editar Orçamento' : 'Nova Precificação'}</h1>
          <p>{id ? `Editando orçamento de ${clientName}` : 'Preencha os dados abaixo para gerar um novo orçamento detalhado.'}</p>
        </div>
      </div>

      <div>
        <PricingCalculatorLayout 
          initialData={initialData}
          initialClientName={clientName}
          onSave={handleSave}
          isSaving={saving}
          saveButtonLabel={id ? 'Salvar Alterações' : 'Criar Orçamento'}
        />
      </div>
    </div>
  );
};
