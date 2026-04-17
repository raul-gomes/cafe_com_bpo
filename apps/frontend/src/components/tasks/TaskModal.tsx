import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Trash2, Palette } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { TaskResponse } from '../../schemas/tasks';

const taskSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  client_id: z.string().uuid('Selecione uma empresa'),
  status: z.enum(['todo', 'doing', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  deadline: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TaskResponse | null;
}

const CONTRAST_PALETTE = ["#3b82f6", "#8b5cf6", "#d946ef", "#f43f5e", "#06b6d4", "#10b981", "#6366f1", "#f97316"];

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, task }) => {
  const { useCreateTask, useUpdateTask, useDeleteTask, useUpdateClient } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateClient = useUpdateClient();

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await apiClient.get('/clients/');
      return data;
    }
  });

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: 'todo',
      priority: 'medium',
    }
  });

  const selectedClientId = watch('client_id');
  const selectedClient = clients?.find((c: any) => c.id === selectedClientId);

  // Reset form when task changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (task) {
        reset({
          title: task.title,
          description: task.description || '',
          client_id: task.client_id,
          status: task.status as any,
          priority: task.priority as any,
          deadline: task.deadline ? task.deadline.split('T')[0] : '',
        });
      } else {
        reset({
          title: '',
          description: '',
          client_id: '',
          status: 'todo',
          priority: 'medium',
          deadline: '',
        });
      }
    }
  }, [isOpen, task, reset]);

  const onSubmit = async (data: TaskFormData) => {
    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...data });
      } else {
        await createTask.mutateAsync(data);
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
    if (task && window.confirm('Tem certeza que deseja excluir esta tarefa?')) {
      await deleteTask.mutateAsync(task.id);
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
          {task ? 'Editar Tarefa' : 'Nova Tarefa'}
        </h2>
        <p style={{ color: 'var(--ds-text-muted)', marginBottom: '24px', fontSize: '14px' }}>
          {task ? 'Atualize os detalhes da tarefa operacional.' : 'Organize o fluxo operacional para um de seus clientes.'}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="ds-form-group">
            <label className="ds-label">Título da Tarefa</label>
            <input 
              {...register('title')} 
              className="ds-input" 
              placeholder="Ex: Conciliação Bancária Setembro"
            />
            {errors.title && <span className="ds-error-msg">{errors.title.message}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
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
                <label className="ds-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Palette size={14} /> Cor da Empresa
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
                    {CONTRAST_PALETTE.map(color => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => handleUpdateClientColor(color)}
                            style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                background: color, border: selectedClient?.color === color ? '2px solid #fff' : '2px solid transparent',
                                cursor: 'pointer', outline: 'none', transition: 'transform 0.1s'
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
              className="ds-input" 
              rows={2} 
              style={{ resize: 'none' }}
              placeholder="Detalhes sobre o que deve ser feito..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
          </div>

          <div className="ds-modal-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {task ? (
              <button 
                type="button" 
                onClick={handleDelete} 
                className="ds-btn ds-btn-ghost" 
                style={{ color: 'var(--ds-error)', padding: '0', display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <Trash2 size={18} /> Excluir
              </button>
            ) : <div />}
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={onClose} className="ds-btn" style={{ background: 'var(--ds-surface-2)' }}>
                Cancelar
              </button>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={createTask.isPending || updateTask.isPending}>
                {createTask.isPending || updateTask.isPending ? 'Salvando...' : task ? 'Salvar Alterações' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
