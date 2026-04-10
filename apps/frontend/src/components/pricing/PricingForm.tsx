import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Trash2, Calculator, Settings, Briefcase, TrendingUp } from 'lucide-react';
import { pricingFormSchema, PricingFormData } from '../../schemas/pricing';

export const PricingForm: React.FC = () => {
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<PricingFormData>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: {
      operation: {
        total_cost: 0,
        people_count: 1,
        hours_per_month: 160,
        tax_rate: 0.15,
      },
      services: [
        { name: 'Conciliação Bancária', minutes_per_execution: 30, monthly_quantity: 4 }
      ],
      desired_profit_margin: 0.30,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "services"
  });

  const onSubmit = async (data: PricingFormData) => {
    // Isso fará ponte com a Fase 8 onde injetaremos a mutation TanStack Query
    console.log("Calculando Payload BPO:", data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-4xl mx-auto space-y-8 bg-white/50 backdrop-blur-md rounded-2xl p-6 md:p-10 shadow-lg border border-gray-100">
      
      {/* Bloco Operacional */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-primary" /> 
          Estrutura Operacional Base
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Custo Total (R$)</label>
            <input type="number" step="0.01" {...register('operation.total_cost', { valueAsNumber: true })} 
              className={`w-full p-3 bg-gray-50 border ${errors.operation?.total_cost ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-primary outline-none`} />
            {errors.operation?.total_cost && <p className="text-xs text-red-500 mt-1">{errors.operation.total_cost.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Qtd. Pessoas</label>
            <input type="number" {...register('operation.people_count', { valueAsNumber: true })} 
              className={`w-full p-3 bg-gray-50 border ${errors.operation?.people_count ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-primary outline-none`} />
            {errors.operation?.people_count && <p className="text-xs text-red-500 mt-1">{errors.operation.people_count.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Horas/Mês</label>
            <input type="number" {...register('operation.hours_per_month', { valueAsNumber: true })} 
              className={`w-full p-3 bg-gray-50 border ${errors.operation?.hours_per_month ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-primary outline-none`} />
            {errors.operation?.hours_per_month && <p className="text-xs text-red-500 mt-1">{errors.operation.hours_per_month.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Imposto (%)</label>
            <input type="number" step="0.01" {...register('operation.tax_rate', { valueAsNumber: true })} 
              className={`w-full p-3 bg-gray-50 border ${errors.operation?.tax_rate ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-primary outline-none`} 
              placeholder="ex: 0.15 (15%)" />
            {errors.operation?.tax_rate && <p className="text-xs text-red-500 mt-1">{errors.operation.tax_rate.message}</p>}
          </div>
        </div>
      </div>

      {/* Bloco de Serviços - FieldArray Dinâmico */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <Briefcase className="w-5 h-5 mr-2 text-primary" /> 
            Mix de Serviços BPO
          </h3>
          <button type="button" onClick={() => append({ name: '', minutes_per_execution: 0, monthly_quantity: 1 })}
            className="flex items-center text-sm font-semibold text-primary hover:text-yellow-600 transition-colors">
            <PlusCircle className="w-4 h-4 mr-1" /> Adicionar Serviço
          </button>
        </div>

        {errors.services?.root && <p className="text-sm text-red-500 mb-4">{errors.services.root.message}</p>}

        <div className="space-y-4">
          {fields.map((item, index) => (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start p-4 bg-gray-50 rounded-lg border border-gray-100 relative group transition-all hover:border-primary/50">
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Serviço</label>
                <input type="text" {...register(`services.${index}.name`)} 
                  className={`w-full p-2.5 bg-white border ${errors.services?.[index]?.name ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-primary outline-none`} />
                {errors.services?.[index]?.name && <p className="text-xs text-red-500 mt-1">{errors.services[index].name?.message}</p>}
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Min. p/ Execução</label>
                <input type="number" {...register(`services.${index}.minutes_per_execution`, { valueAsNumber: true })} 
                  className={`w-full p-2.5 bg-white border ${errors.services?.[index]?.minutes_per_execution ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-primary outline-none`} />
                {errors.services?.[index]?.minutes_per_execution && <p className="text-xs text-red-500 mt-1">{errors.services[index].minutes_per_execution?.message}</p>}
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Qtd Mensal</label>
                <input type="number" {...register(`services.${index}.monthly_quantity`, { valueAsNumber: true })} 
                  className={`w-full p-2.5 bg-white border ${errors.services?.[index]?.monthly_quantity ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-primary outline-none`} />
                {errors.services?.[index]?.monthly_quantity && <p className="text-xs text-red-500 mt-1">{errors.services[index].monthly_quantity?.message}</p>}
              </div>

              <div className="md:col-span-1 flex items-end justify-center h-full pb-2">
                <button type="button" onClick={() => remove(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remover serviço">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bloco de Margem e Submissão */}
      <div className="flex flex-col md:flex-row gap-6 items-end justify-between bg-gray-900 rounded-xl p-6 text-white shadow-xl">
        <div className="w-full md:w-1/3">
          <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-primary" /> Margem Desejada (%)
          </label>
          <input type="number" step="0.01" {...register('desired_profit_margin', { valueAsNumber: true })} 
            className={`w-full p-3 bg-gray-800 border ${errors.desired_profit_margin ? 'border-red-500' : 'border-gray-700'} text-white rounded-lg focus:ring-2 focus:ring-primary outline-none`} 
            placeholder="ex: 0.30 (30%)" />
          {errors.desired_profit_margin && <p className="text-xs text-red-400 mt-1">{errors.desired_profit_margin.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} 
          className="w-full md:w-auto flex flex-1 items-center justify-center py-3 px-8 rounded-lg text-lg font-bold text-gray-900 bg-primary hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(253,224,71,0.4)] disabled:opacity-50">
          <Calculator className="w-5 h-5 mr-2" />
          Calcular Precificação
        </button>
      </div>

    </form>
  );
};
