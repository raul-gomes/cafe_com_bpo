import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Trash2, Play } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { RoutineResponse } from '../../schemas/tasks';

const routineSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  client_id: z.string().uuid('').optional().or(z.literal('')),
  process_type: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  recurrence: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  day_of_week: z.number().optional(),
  day_of_month: z.number().optional(),
  days_before_deadline: z.number().min(0).max(30),
  deadline_time: z.string().optional(),
});

type RoutineFormData = z.infer<typeof routineSchema>;

interface RoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  routine?: RoutineResponse | null;
}

const PROCESS_TYPES = [
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'contabil', label: 'Contábil' },
  { value: 'dp', label: 'Departamento Pessoal' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'administrativo', label: 'Administrativo' },
];

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export const RoutineModal: React.FC<RoutineModalProps> = ({ isOpen, onClose, routine }) => {
  const { useCreateRoutine, useDeleteRoutine, useGenerateRoutineTasks } = useTasks();
  const createRoutine = useCreateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const generateTasks = useGenerateRoutineTasks();

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await apiClient.get('/clients/');
      return data;
    }
  });

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<RoutineFormData>({
    resolver: zodResolver(routineSchema),
    defaultValues: {
      priority: 'medium',
      recurrence: 'monthly',
      days_before_deadline: 0,
    }
  });

  const recurrence = watch('recurrence');

  useEffect(() => {
    if (isOpen) {
      if (routine) {
        reset({
          title: routine.title,
          description: routine.description || '',
          client_id: routine.client_id || '',
          process_type: routine.process_type || '',
          priority: routine.priority as any,
          recurrence: routine.recurrence as any,
          day_of_week: routine.day_of_week ?? undefined,
          day_of_month: routine.day_of_month ?? undefined,
          days_before_deadline: routine.days_before_deadline,
          deadline_time: routine.deadline_time || '',
        });
      } else {
        reset({
          title: '',
          description: '',
          client_id: '',
          process_type: '',
          priority: 'medium',
          recurrence: 'monthly',
          day_of_week: undefined,
          day_of_month: undefined,
          days_before_deadline: 0,
          deadline_time: '',
        });
      }
    }
  }, [isOpen, routine, reset]);

  const onSubmit = async (data: RoutineFormData) => {
    try {
      await createRoutine.mutateAsync({
        ...data,
        client_id: data.client_id || undefined,
        process_type: data.process_type || undefined,
        deadline_time: data.deadline_time || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar rotina:', err);
    }
  };

  const handleDelete = async () => {
    if (routine && window.confirm('Tem certeza que deseja excluir esta rotina?')) {
      await deleteRoutine.mutateAsync(routine.id);
      onClose();
    }
  };

  const handleGenerate = async () => {
    if (routine) {
      await generateTasks.mutateAsync(routine.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ds-modal-overlay" style={{ 
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        backdropFilter: 'blur(4px)'
    }}>
      <div className="ds-modal ds-card" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}>
          <X size={24} />
        </button>

        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          {routine ? 'Editar Rotina' : 'Nova Rotina'}
        </h2>
        <p style={{ color: 'var(--ds-text-muted)', marginBottom: '24px', fontSize: '14px' }}>
          {routine ? 'Atualize os detalhes da rotina recorrente.' : 'Crie uma rotina que gera tarefas automaticamente.'}
        </p>

        <form onSubmit={handleSubmit(onSubmit as any)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="ds-form-group">
            <label className="ds-label">Título da Rotina</label>
            <input 
              {...register('title')} 
              className="ds-input" 
              placeholder="Ex: Fechamento Mensal"
            />
            {errors.title && <span className="ds-error-msg">{errors.title.message}</span>}
          </div>

          <div className="ds-form-group">
            <label className="ds-label">Descrição (Opcional)</label>
            <textarea 
              {...register('description')} 
              className="ds-input" 
              rows={2} 
              style={{ resize: 'none' }}
              placeholder="Detalhes sobre o que deve ser feito..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ds-form-group">
              <label className="ds-label">Empresa (Opcional)</label>
              <select {...register('client_id')} className="ds-input">
                <option value="">Todas / Nenhuma</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="ds-form-group">
              <label className="ds-label">Tipo de Processo</label>
              <select {...register('process_type')} className="ds-input">
                <option value="">Selecione...</option>
                {PROCESS_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ds-form-group">
              <label className="ds-label">Recorrência</label>
              <select {...register('recurrence')} className="ds-input">
                {Object.entries(RECURRENCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="ds-form-group">
              <label className="ds-label">Prioridade</label>
              <select {...register('priority')} className="ds-input">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          {recurrence === 'weekly' && (
            <div className="ds-form-group">
              <label className="ds-label">Dia da Semana</label>
              <select {...register('day_of_week', { valueAsNumber: true })} className="ds-input">
                {DAYS_OF_WEEK.map((day, idx) => (
                  <option key={idx} value={idx}>{day}</option>
                ))}
              </select>
            </div>
          )}

          {recurrence === 'monthly' && (
            <div className="ds-form-group">
              <label className="ds-label">Dia do Mês</label>
              <input 
                {...register('day_of_month', { valueAsNumber: true })} 
                type="number" 
                className="ds-input" 
                min="1" 
                max="31" 
                defaultValue="1"
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ds-form-group">
              <label className="ds-label">Gerar X dias antes</label>
              <input 
                {...register('days_before_deadline', { valueAsNumber: true })} 
                type="number" 
                className="ds-input" 
                min="0" 
                max="30" 
              />
            </div>

            <div className="ds-form-group">
              <label className="ds-label">Horário (opcional)</label>
              <input 
                {...register('deadline_time')} 
                type="time" 
                className="ds-input" 
              />
            </div>
          </div>

          <div className="ds-modal-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {routine ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={handleGenerate} 
                  className="ds-btn ds-btn-ghost" 
                  style={{ color: 'var(--ds-primary)', padding: '0', display: 'flex', gap: '8px', alignItems: 'center' }}
                  disabled={generateTasks.isPending}
                >
                  <Play size={18} /> Gerar Tarefa
                </button>
                <button 
                  type="button" 
                  onClick={handleDelete} 
                  className="ds-btn ds-btn-ghost" 
                  style={{ color: 'var(--ds-error)', padding: '0', display: 'flex', gap: '8px', alignItems: 'center' }}
                >
                  <Trash2 size={18} /> Excluir
                </button>
              </div>
            ) : <div />}
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={onClose} className="ds-btn" style={{ background: 'var(--ds-surface-2)' }}>
                Cancelar
              </button>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={createRoutine.isPending}>
                {createRoutine.isPending ? 'Salvando...' : routine ? 'Salvar Alterações' : 'Criar Rotina'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
