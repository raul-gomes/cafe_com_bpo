import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { X, Trash2, Palette } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { TaskResponse } from '../../schemas/tasks';
import { useConfirm } from '../ui/ConfirmDialog';

const taskSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  notes: z.string().optional(),
  client_id: z.string().uuid('Selecione uma empresa'),
  status: z.enum(['todo', 'doing', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  deadline: z.string().optional(),
  phase_id: z.string().uuid().optional().or(z.literal('')),
  time_estimate_minutes: z.number().optional().or(z.literal(0)),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TaskResponse | null;
}

const CONTRAST_PALETTE = ["#3b82f6", "#8b5cf6", "#d946ef", "#f43f5e", "#06b6d4", "#10b981", "#6366f1", "#f97316"];

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, task }) => {
  const { useCreateTask, useUpdateTask, useDeleteTask, useUpdateClient, usePhases } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateClient = useUpdateClient();
  const { data: phases } = usePhases();
  const confirm = useConfirm();

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await apiClient.get('/clients/');
      return data;
    }
  });

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<TaskFormData>();
  const selectedClientId = watch('client_id');
  const selectedClient = clients?.find((c: any) => c.id === selectedClientId);

  useEffect(() => {
    if (isOpen) {
      if (task) {
        reset({
          title: task.title,
          description: task.description || '',
          notes: task.notes || '',
          client_id: task.client_id,
          status: task.status as any,
          priority: task.priority as any,
          deadline: task.deadline ? task.deadline.split('T')[0] : '',
          phase_id: task.phase_id || '',
          time_estimate_minutes: task.time_estimate_minutes || 0,
        });
      } else {
        reset({
          title: '',
          description: '',
          notes: '',
          client_id: '',
          status: 'todo',
          priority: 'medium',
          deadline: '',
          phase_id: '',
          time_estimate_minutes: 0,
        });
      }
    }
  }, [isOpen, task, reset]);

  const onSubmit = async (data: TaskFormData) => {
    try {
      const submitData = {
        title: data.title,
        description: data.description,
        notes: data.notes || undefined,
        client_id: data.client_id,
        status: data.status,
        priority: data.priority,
        deadline: data.deadline || undefined,
        phase_id: data.phase_id || undefined,
        time_estimate_minutes: data.time_estimate_minutes || undefined,
      };
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...submitData });
      } else {
        await createTask.mutateAsync(submitData);
      }
      onClose();
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
    }
  };

  const handleUpdateClientColor = async (color: string) => {
    if (selectedClientId) {
      await updateClient.mutateAsync({ id: selectedClientId, color });
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    const ok = await confirm({
      title: 'Excluir tarefa',
      message: `Tem certeza que deseja excluir "${task.title}"?`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (ok) {
      await deleteTask.mutateAsync(task.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  const sortedPhases = [...(phases || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-[540px] overflow-auto rounded-lg border border-border bg-card p-8 shadow-2xl" style={{ maxHeight: '90vh' }}>
        <button
          onClick={onClose}
          className="absolute right-6 top-6 cursor-pointer border-none bg-transparent text-muted-foreground hover:text-foreground"
        >
          <X size={24} />
        </button>

        <h2 className="mb-2 text-[24px] font-bold text-foreground">
          {task ? 'Editar Tarefa' : 'Nova Tarefa'}
        </h2>
        <p className="mb-6 text-[14px] text-muted-foreground">
          {task ? 'Atualize os detalhes da tarefa operacional.' : 'Organize o fluxo operacional para um de seus clientes.'}
        </p>

        <form onSubmit={handleSubmit(onSubmit as any)} className="flex flex-col gap-5">
          <div className="ds-form-group">
            <label className="ds-label">
              <span>Título da Tarefa</span>
            </label>
            <input 
              {...register('title')} 
              className="ds-input" 
              placeholder="Ex: Conciliação Bancária Setembro"
            />
            {errors.title && <span className="ds-error-msg">{errors.title.message}</span>}
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
            <div className="ds-form-group">
              <label className="ds-label">Empresa</label>
              <select {...register('client_id')} className="ds-input">
                <option value="">Selecione...</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.client_id && <span className="ds-error-msg">{errors.client_id.message}</span>}
            </div>

            {selectedClientId && (
              <div className="ds-form-group">
                <label className="ds-label flex items-center gap-1.5">
                  <Palette size={14} /> Cor da Empresa
                </label>
                <div className="mt-1 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {CONTRAST_PALETTE.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleUpdateClientColor(color)}
                      className="size-6 cursor-pointer rounded-full border-2 outline-none transition-transform hover:scale-110"
                      style={{
                        background: color,
                        borderColor: selectedClient?.color === color ? '#fff' : 'transparent',
                      }}
                      title="Alterar cor da empresa"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ds-form-group">
            <label className="ds-label">Descrição (Opcional)</label>
            <textarea 
              {...register('description')} 
              className="ds-input resize-none" 
              rows={2} 
              placeholder="Detalhes sobre o que deve ser feito..."
            />
          </div>

          <div className="ds-form-group">
            <label className="ds-label">Notas (Opcional)</label>
            <textarea 
              {...register('notes')} 
              className="ds-input resize-none" 
              rows={2} 
              placeholder="Observações internas, lembretes, etc."
            />
          </div>

          {sortedPhases.length > 0 && (
            <div className="ds-form-group">
              <label className="ds-label">Fase</label>
              <select {...register('phase_id')} className="ds-input">
                <option value="">Sem fase</option>
                {sortedPhases.map(phase => (
                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="ds-form-group">
              <label className="ds-label">Data Limite</label>
              <input 
                {...register('deadline')} 
                type="date"
                className="ds-input" 
              />
            </div>

            <div className="ds-form-group">
              <label className="ds-label">Prioridade</label>
              <select {...register('priority')} className="ds-input">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div className="ds-form-group">
              <label className="ds-label">Min. Est.</label>
              <input 
                {...register('time_estimate_minutes', { valueAsNumber: true })}
                type="number"
                min="0"
                step="1"
                className="ds-input" 
                placeholder="0"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            {task ? (
              <button 
                type="button" 
                onClick={handleDelete} 
                className="flex items-center gap-2 border-none bg-transparent p-0 text-destructive hover:underline"
              >
                <Trash2 size={18} /> Excluir
              </button>
            ) : <div />}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="rounded-lg border border-border bg-muted px-4 py-2 text-[14px] font-semibold text-foreground transition-colors hover:bg-muted/80">
                Cancelar
              </button>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50" disabled={createTask.isPending || updateTask.isPending}>
                {createTask.isPending || updateTask.isPending ? 'Salvando...' : task ? 'Salvar Alterações' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
