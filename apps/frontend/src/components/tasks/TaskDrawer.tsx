import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Pencil, PencilOff, Trash2 } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { TaskResponse } from '../../schemas/tasks';
import { useConfirm } from '../ui/ConfirmDialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

const taskSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  notes: z.string().optional(),
  client_id: z.string().uuid('Selecione uma empresa'),
  priority: z.enum(['low', 'medium', 'high']),
  deadline: z.string().optional(),
  time_estimate_minutes: z.number().optional().or(z.literal(0)),
});

type TaskFormData = z.infer<typeof taskSchema>;

const inputClass = "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 [&>option]:bg-background [&>option]:text-foreground";

const labelClass = "mb-1.5 block text-xs font-semibold text-muted-foreground";

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TaskResponse | null;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ isOpen, onClose, task }) => {
  const { useCreateTask, useUpdateTask, useDeleteTask } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await apiClient.get('/clients/');
      return data;
    }
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<TaskFormData>();

  useEffect(() => {
    if (isOpen) {
      // Nova tarefa: tudo editável. Tarefa existente: bloqueada até clicar no lápis.
      setEditing(!task);
      if (task) {
        reset({
          title: task.title,
          description: task.description || '',
          notes: task.notes || '',
          client_id: task.client_id,
          priority: task.priority as any,
          deadline: task.deadline ? task.deadline.split('T')[0] : '',
          time_estimate_minutes: task.time_estimate_minutes || 0,
        });
      } else {
        reset({
          title: '',
          description: '',
          notes: '',
          client_id: '',
          priority: 'medium',
          deadline: '',
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
        priority: data.priority,
        deadline: data.deadline || undefined,
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

  // Campos de identidade: nunca editáveis quando a tarefa já existe
  const identityLocked = !!task;
  const detailsLocked = !!task && !editing;
  const isSaving = createTask.isPending || updateTask.isPending;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="!w-[94vw] gap-0 overflow-hidden sm:!w-[45vw] sm:!max-w-none"
      >
        {task && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(e => !e)}
            className="absolute right-12 top-3 z-10"
            title={editing ? 'Bloquear edição' : 'Editar'}
          >
            {editing ? <PencilOff size={16} className="size-3.5" /> : <Pencil size={16} className="size-3.5" />}
          </Button>
        )}

        <SheetHeader className="shrink-0 border-b border-border px-6 py-5 pr-16">
          <SheetTitle className="text-lg">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</SheetTitle>
          <SheetDescription>
            {task
              ? (detailsLocked ? 'Clique no lápis para editar os detalhes.' : 'Atualize os detalhes da tarefa operacional.')
              : 'Organize o fluxo operacional para um de seus clientes.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit as any)} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-6">
            <div>
              <label className={labelClass}>Título da Tarefa</label>
              <Input
                {...register('title')}
                placeholder="Ex: Conciliação Bancária Setembro"
                disabled={identityLocked}
              />
              {errors.title && <span className="mt-1 block text-xs text-destructive">{errors.title.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Empresa</label>
                <select {...register('client_id')} className={inputClass} disabled={identityLocked}>
                  <option value="">Selecione...</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.client_id && <span className="mt-1 block text-xs text-destructive">{errors.client_id.message}</span>}
              </div>

              <div>
                <label className={labelClass}>Prioridade</label>
                <select {...register('priority')} className={inputClass} disabled={detailsLocked}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Data Limite</label>
                <Input
                  {...register('deadline')}
                  type="date"
                  disabled={detailsLocked}
                />
              </div>

              <div>
                <label className={labelClass}>Min. Est.</label>
                <Input
                  {...register('time_estimate_minutes', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  disabled={detailsLocked}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Descrição (Opcional)</label>
              <Textarea
                {...register('description')}
                rows={3}
                placeholder="Detalhes sobre o que deve ser feito..."
                disabled={detailsLocked}
              />
            </div>

            <div>
              <label className={labelClass}>Notas (Opcional)</label>
              <Textarea
                {...register('notes')}
                rows={2}
                placeholder="Observações internas, lembretes, etc."
                disabled={detailsLocked}
              />
            </div>
          </div>
        </form>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          {task ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 size={16} /> Excluir
            </Button>
          ) : <div />}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {detailsLocked ? 'Fechar' : 'Cancelar'}
            </Button>
            {(!task || editing) && (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : task ? 'Salvar Alterações' : 'Criar Tarefa'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};