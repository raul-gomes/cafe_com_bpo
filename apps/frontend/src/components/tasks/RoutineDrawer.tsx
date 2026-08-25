import React, { useState } from 'react';
import { Plus, Trash2, X, Pencil, Globe } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useConfirm } from '../ui/ConfirmDialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Uma só vez',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const PROCESS_TYPE_LABELS: Record<string, string> = {
  fiscal: 'Fiscal', contabil: 'Contábil', dp: 'DP', financeiro: 'Financeiro', administrativo: 'Administrativo',
};

const WEEKDAY_LABELS = [
  { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' },
];

const MONTH_OPTIONS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
];

const selectClass = "flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-background [&>option]:text-foreground [&>option]:dark:bg-zinc-900";

function PeriodInfo({ template }: { template: any }) {
  if (template.recurrence === 'once' && template.due_days_from_start) {
    return <span>{template.due_days_from_start} dias após o start</span>;
  }
  if (template.recurrence === 'weekly' && template.weekday_mask) {
    const days = template.weekday_mask.split(',').map((d: string) =>
      ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][Number(d)]
    ).join(', ');
    return <span>{days}</span>;
  }
  if (template.recurrence === 'monthly' && template.due_day) {
    return <span>Dia {template.due_day} de cada mês</span>;
  }
  if (template.recurrence === 'yearly' && template.due_day) {
    return <span>Dia {template.due_day}/{template.due_month} anualmente</span>;
  }
  return null;
}

interface RoutineEditFormProps {
  template: any;
  routineTypes?: any[];
  isSaving: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

const RoutineEditForm: React.FC<RoutineEditFormProps> = ({ template, routineTypes, isSaving, onSave, onCancel }) => {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [processType, setProcessType] = useState(template.process_type || '');
  const [routineTypeId, setRoutineTypeId] = useState(template.routine_type_id || '');
  const [recurrence, setRecurrence] = useState(template.recurrence);
  const [dueDay, setDueDay] = useState<number | ''>(template.due_day ?? '');
  const [dueMonth, setDueMonth] = useState<number | ''>(template.due_month ?? '');
  const [dueDaysFromStart, setDueDaysFromStart] = useState<number | ''>(template.due_days_from_start ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(template.weekday_mask ? template.weekday_mask.split(',').map(Number) : [1, 2, 3, 4, 5]);

  const toggleWeekday = (day: number) => {
    setWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      process_type: processType || undefined,
      routine_type_id: routineTypeId || undefined,
      recurrence,
    };
    if (recurrence === 'once') payload.due_days_from_start = dueDaysFromStart === '' ? undefined : Number(dueDaysFromStart);
    if (recurrence === 'weekly') payload.weekday_mask = weekdays.join(',');
    if (recurrence === 'monthly') payload.due_day = dueDay === '' ? undefined : Number(dueDay);
    if (recurrence === 'yearly') {
      payload.due_day = dueDay === '' ? undefined : Number(dueDay);
      payload.due_month = dueMonth === '' ? undefined : Number(dueMonth);
    }
    await onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nome *</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Fiscal Mensal" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Descrição</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da rotina..." rows={2} className="resize-y" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tipo de Processo</label>
          <select value={processType} onChange={(e) => setProcessType(e.target.value)} className={selectClass}>
            <option value="">Selecione</option>
            {Object.entries(PROCESS_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tipo de Rotina</label>
          <select value={routineTypeId} onChange={(e) => setRoutineTypeId(e.target.value)} className={selectClass}>
            <option value="">Sem tipo</option>
            {routineTypes?.map((rt: any) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Periodicidade</label>
        <select value={recurrence} onChange={(e) => { setRecurrence(e.target.value); setDueDaysFromStart(''); setDueDay(''); setDueMonth(''); setWeekdays([1, 2, 3, 4, 5]); }} className={selectClass}>
          {Object.entries(RECURRENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {recurrence === 'once' && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Dias para execução</label>
          <Input type="number" min={1} value={dueDaysFromStart} onChange={(e) => setDueDaysFromStart(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 30" className="w-28" />
        </div>
      )}
      {recurrence === 'weekly' && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Dias da semana</label>
          <div className="flex gap-1.5 pt-1">
            {WEEKDAY_LABELS.map(({ value, label }) => (
              <label key={value} className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border transition-all",
                weekdays.includes(value) ? "bg-primary/10 border-primary text-primary-strong" : "bg-muted border-border text-muted-foreground"
              )}>
                <input type="checkbox" checked={weekdays.includes(value)} onChange={() => toggleWeekday(value)} className="hidden" />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
      {recurrence === 'monthly' && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Dia do vencimento</label>
          <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 15" className="w-28" />
        </div>
      )}
      {recurrence === 'yearly' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Dia</label>
            <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 15" className="w-28" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Mês</label>
            <select value={dueMonth} onChange={(e) => setDueMonth(e.target.value === '' ? '' : Number(e.target.value))} className={selectClass}>
              <option value="">Selecione</option>
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={!name.trim() || isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};

interface ActivityEditFormProps {
  initialName: string;
  initialDescription: string;
  initialPriority: string;
  isSaving: boolean;
  onSave: (data: { name: string; description?: string; priority: string }) => Promise<void>;
  onCancel: () => void;
}

const ActivityEditForm: React.FC<ActivityEditFormProps> = ({ initialName, initialDescription, initialPriority, isSaving, onSave, onCancel }) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [priority, setPriority] = useState(initialPriority);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({ name: name.trim(), description: description.trim() || undefined, priority });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 animate-[panelFadeIn_0.2s_ease-out]">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nome da atividade *</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Descrição (opcional)</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Prioridade</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass}>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={!name.trim() || isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};

interface RoutineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string | null;
}

export const RoutineDrawer: React.FC<RoutineDrawerProps> = ({ isOpen, onClose, templateId }) => {
  const {
    useTemplate,
    useCreateActivity,
    useUpdateActivity,
    useDeleteActivity,
    useUpdateTemplate,
    useDeleteTemplate,
    useRoutineTypes,
  } = useTasks();
  const { data: template, isLoading } = useTemplate(templateId ?? '');
  const { data: routineTypes } = useRoutineTypes();
  const { user } = useAuth();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const confirm = useConfirm();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [editingRoutine, setEditingRoutine] = useState(false);
  const [editingAct, setEditingAct] = useState<string | null>(null);

  const sortedActivities = [...(template?.activities || [])].sort((a, b) => a.order - b.order);
  // Rotinas gerais de outros usuários: somente leitura
  const canManage = !template?.is_general || template.user_id === user?.id;

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId || !newName.trim()) return;
    await createActivity.mutateAsync({
      template_id: templateId,
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      priority: newPriority,
      order: sortedActivities.length,
    });
    setNewName('');
    setNewDescription('');
    setNewPriority('medium');
    setShowAdd(false);
  };

  const toggleActive = async () => {
    if (!templateId || !template) return;
    await updateTemplate.mutateAsync({ id: templateId, is_active: !template.is_active });
  };

  const handleDelete = async () => {
    if (!templateId || !template) return;
    const ok = await confirm({
      title: 'Excluir rotina',
      message: `Tem certeza que deseja excluir "${template.name}"?`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (ok) {
      await deleteTemplate.mutateAsync(templateId);
      onClose();
    }
  };

  const saveRoutineEdit = async (payload: Record<string, unknown>) => {
    if (!templateId) return;
    await updateTemplate.mutateAsync({ id: templateId, ...payload });
    setEditingRoutine(false);
  };

  const handleDeleteActivity = async (id: string, name: string) => {
    if (!templateId) return;
    const ok = await confirm({
      title: 'Excluir atividade',
      message: `Tem certeza que deseja excluir "${name}"?`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (ok) {
      await deleteActivity.mutateAsync({ template_id: templateId, id });
    }
  };

  const saveActEdit = (actId: string) => async (data: { name: string; description?: string; priority: string }) => {
    if (!templateId) return;
    await updateActivity.mutateAsync({ template_id: templateId, id: actId, ...data });
    setEditingAct(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="!w-[94vw] gap-0 overflow-hidden sm:!w-[50vw] sm:!max-w-none"
      >
        {isLoading || !template ? (
          <div className="flex flex-col gap-4 p-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <SheetHeader className="shrink-0 border-b border-border px-6 py-5 pr-28">
            <SheetTitle className="text-lg">{template.name}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2 text-sm">
              {template.is_general && (
                <Badge variant="outline" className="gap-1 text-[11px] font-semibold text-primary-strong border-primary/30">
                  <Globe size={10} /> Geral
                </Badge>
              )}
              {template.routine_type_name && (
                <Badge variant="outline" className="gap-1 text-[11px] whitespace-nowrap">
                  <span className="size-1.5 rounded-full shrink-0" style={{ background: template.routine_type_color || '#3b82f6' }} />
                  {template.routine_type_name}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {RECURRENCE_LABELS[template.recurrence] || template.recurrence}
              </span>
              {PeriodInfo({ template }) && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-muted-foreground">{PeriodInfo({ template })}</span>
                </>
              )}
            </SheetDescription>
          </SheetHeader>
        )}

        {!isLoading && template && (
          <>
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-20 top-3 z-10 text-muted-foreground/60 hover:text-primary-strong hover:bg-primary/10"
                onClick={() => setEditingRoutine(true)}
                title="Editar rotina"
              >
                <Pencil size={16} className="size-4" />
              </Button>
            )}
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-12 top-3 z-10 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                title="Excluir rotina"
              >
                <Trash2 size={16} className="size-4" />
              </Button>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {editingRoutine ? (
                <RoutineEditForm
                  template={template}
                  routineTypes={routineTypes}
                  isSaving={updateTemplate.isPending}
                  onSave={saveRoutineEdit}
                  onCancel={() => setEditingRoutine(false)}
                />
              ) : (
                <>
                  {canManage ? (
                    <div className="mb-6 flex items-center justify-between rounded-lg border border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Rotina ativa</p>
                        <p className="text-xs text-muted-foreground">Tarefas são geradas enquanto ativa.</p>
                      </div>
                      <Switch checked={template.is_active} onCheckedChange={toggleActive} />
                    </div>
                  ) : (
                    <div className="mb-6 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                      <Globe size={14} className="text-primary-strong shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Rotina geral</span> — criada pelo administrador. Somente leitura; vincule-a a um cliente para gerar suas tarefas.
                      </p>
                    </div>
                  )}

                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                      Atividades ({sortedActivities.length})
                    </h3>
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => setShowAdd(v => !v)}>
                        <Plus size={14} /> Adicionar
                      </Button>
                    )}
                  </div>

                  {showAdd && (
                    <form onSubmit={handleAddActivity} className="mb-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4 animate-[panelFadeIn_0.2s_ease-out]">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nome da atividade *</label>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Conciliação bancária" autoFocus />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Descrição (opcional)</label>
                        <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={2} placeholder="Detalhes da atividade..." />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Prioridade</label>
                        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className={selectClass}>
                          <option value="low">Baixa</option>
                          <option value="medium">Média</option>
                          <option value="high">Alta</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
                        <Button type="submit" size="sm" disabled={!newName.trim() || createActivity.isPending}>
                          {createActivity.isPending ? 'Adicionando...' : 'Adicionar Atividade'}
                        </Button>
                      </div>
                    </form>
                  )}

                  {sortedActivities.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-[13px] text-muted-foreground">
                        Nenhuma atividade cadastrada nesta rotina.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {sortedActivities.map((act, i) => {
                        const isEditing = editingAct === act.id;
                        if (isEditing) {
                          return (
                            <ActivityEditForm
                              key={act.id}
                              initialName={act.name}
                              initialDescription={act.description || ''}
                              initialPriority={act.priority || 'medium'}
                              isSaving={updateActivity.isPending}
                              onSave={saveActEdit(act.id)}
                              onCancel={() => setEditingAct(null)}
                            />
                          );
                        }
                        return (
                          <div key={act.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary-strong leading-none">
                                  {i + 1}
                                </span>
                                <span className="truncate text-sm font-semibold text-foreground">{act.name}</span>
                                {act.priority && (
                                  <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", act.priority === 'high' && "border-destructive/40 text-destructive")}>
                                    {PRIORITY_LABELS[act.priority] || act.priority}
                                  </Badge>
                                )}
                              </div>
                              {act.description && (
                                <p className="mt-1 text-xs text-muted-foreground pl-8">{act.description}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingAct(act.id)}
                                    className="flex size-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-muted-foreground/30 transition-all cursor-pointer hover:text-primary-strong hover:bg-primary/10"
                                    title="Editar atividade"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteActivity(act.id, act.name)}
                                    className="flex size-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-muted-foreground/30 transition-all cursor-pointer hover:text-destructive hover:bg-destructive/10"
                                    title="Excluir atividade"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex shrink-0 justify-end border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
