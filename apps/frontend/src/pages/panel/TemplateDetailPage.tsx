import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Edit2, GripVertical, Settings2, Clock, AlertTriangle } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../../components/ui/sheet';
import { cn } from '../../lib/utils';

const PRIORITY_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  low: { label: 'Baixa', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  medium: { label: 'Média', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400' },
  high: { label: 'Alta', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
};

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Uma só vez', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual',
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

export const TemplateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { useTemplate, useUpdateTemplate, useCreateActivity, useUpdateActivity, useDeleteActivity, useReorderActivities, useRoutineTypes } = useTasks();
  const { data: template, isLoading } = useTemplate(id!);
  const { data: routineTypes } = useRoutineTypes();
  const updateTemplate = useUpdateTemplate();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const reorderActivities = useReorderActivities();

  // ── Name edit state ──
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  // ── Add activity state ──
  const [showAdd, setShowAdd] = useState(false);
  const [newActName, setNewActName] = useState('');
  const [newActDescription, setNewActDescription] = useState('');
  const [newActPriority, setNewActPriority] = useState('medium');
  const [newActMinutes, setNewActMinutes] = useState<number | ''>('');

  // ── Edit activity state ──
  const [editingAct, setEditingAct] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editMinutes, setEditMinutes] = useState<number | ''>('');

  // ── Config sheet state ──
  const [showConfig, setShowConfig] = useState(false);
  const [cfgDescription, setCfgDescription] = useState('');
  const [cfgDueDay, setCfgDueDay] = useState<number | ''>('');
  const [cfgDueMonth, setCfgDueMonth] = useState<number | ''>('');
  const [cfgDueDaysFromStart, setCfgDueDaysFromStart] = useState<number | ''>('');
  const [cfgWeekdays, setCfgWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [cfgRecurrence, setCfgRecurrence] = useState('monthly');
  const [cfgProcessType, setCfgProcessType] = useState('');
  const [cfgRoutineTypeId, setCfgRoutineTypeId] = useState('');

  // ── Drag-reorder state ──
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const confirm = useConfirm();

  // Populate config form from template data
  useEffect(() => {
    if (template) {
      setCfgDescription(template.description || '');
      setCfgDueDay(template.due_day ?? '');
      setCfgDueMonth(template.due_month ?? '');
      setCfgDueDaysFromStart(template.due_days_from_start ?? '');
      setCfgWeekdays(template.weekday_mask ? template.weekday_mask.split(',').map(Number) : [1, 2, 3, 4, 5]);
      setCfgRecurrence(template.recurrence);
      setCfgProcessType(template.process_type || '');
      setCfgRoutineTypeId(template.routine_type_id || '');
    }
  }, [template]);

  const toggleWeekday = (day: number) => {
    setCfgWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const saveConfig = async () => {
    const payload: Record<string, unknown> = {
      id: id!,
      description: cfgDescription.trim() || undefined,
      process_type: cfgProcessType || undefined,
      routine_type_id: cfgRoutineTypeId || undefined,
    };
    if (cfgRecurrence === 'once') payload.due_days_from_start = cfgDueDaysFromStart === '' ? undefined : Number(cfgDueDaysFromStart);
    if (cfgRecurrence === 'weekly') payload.weekday_mask = cfgWeekdays.join(',');
    if (cfgRecurrence === 'monthly') payload.due_day = cfgDueDay === '' ? undefined : Number(cfgDueDay);
    if (cfgRecurrence === 'yearly') {
      payload.due_day = cfgDueDay === '' ? undefined : Number(cfgDueDay);
      payload.due_month = cfgDueMonth === '' ? undefined : Number(cfgDueMonth);
    }
    await updateTemplate.mutateAsync(payload as any);
    setShowConfig(false);
  };

  const saveName = async () => {
    if (!nameValue.trim()) return;
    await updateTemplate.mutateAsync({ id: id!, name: nameValue.trim() });
    setEditingName(false);
  };

  const handleAddActivity = async () => {
    if (!newActName.trim()) return;
    await createActivity.mutateAsync({
      template_id: id!,
      name: newActName.trim(),
      description: newActDescription.trim() || undefined,
      priority: newActPriority,
      estimated_minutes: newActMinutes === '' ? undefined : Number(newActMinutes),
      order: template?.activities?.length || 0,
    });
    setNewActName('');
    setNewActDescription('');
    setNewActPriority('medium');
    setNewActMinutes('');
    setShowAdd(false);
  };

  const startEdit = (act: any) => {
    setEditingAct(act.id);
    setEditName(act.name);
    setEditDescription(act.description || '');
    setEditPriority(act.priority || 'medium');
    setEditMinutes(act.estimated_minutes ?? '');
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editingAct) return;
    await updateActivity.mutateAsync({
      template_id: id!,
      id: editingAct,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      priority: editPriority,
      estimated_minutes: editMinutes === '' ? undefined : Number(editMinutes),
    });
    setEditingAct(null);
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="tasks-page">
        <Skeleton className="h-8 w-[250px] mb-6" />
        <Skeleton className="h-10 w-[180px] mb-10" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  // ── Not found state ──
  if (!template) {
    return (
      <div className="tasks-page">
        <Card className="p-0">
          <CardContent className="flex flex-col items-center py-16">
            <AlertTriangle size={40} className="text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold">Rotina não encontrada</h3>
            <Button variant="outline" onClick={() => navigate('/painel/templates-atividades')} className="mt-4">
              ← Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedActivities = [...(template.activities || [])].sort((a, b) => a.order - b.order);
  const routineType = routineTypes?.find(r => r.id === template.routine_type_id);

  return (
    <div className="tasks-page animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[
        { label: 'Painel', to: '/painel' },
        { label: 'Rotinas', to: '/painel/templates-atividades' },
        { label: template.name },
      ]} />

      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/painel/templates-atividades')} className="gap-1.5">
          <ArrowLeft size={15} /> Voltar
        </Button>
      </div>

      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex gap-2 items-center">
              <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="max-w-[300px] text-lg font-bold" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} />
              <Button size="sm" onClick={saveName}>Salvar</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingName(false)}>Cancelar</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl">{template.name}</h1>
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditingName(true); setNameValue(template.name); }}>
                <Edit2 size={15} />
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {routineType && (
              <Badge variant="outline" className="gap-1.5 text-[11px]" style={{ borderColor: routineType.color + '40' }}>
                <span className="size-2 rounded-full" style={{ background: routineType.color }} />
                {routineType.name}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[11px]">
              {RECURRENCE_LABELS[template.recurrence] || template.recurrence}
            </Badge>
            {template.process_type && (
              <Badge variant="outline" className="text-primary bg-primary/10 border-primary/20 text-[11px]">
                {PROCESS_TYPE_LABELS[template.process_type] || template.process_type}
              </Badge>
            )}
            {template.description && (
              <span className="text-[13px] text-muted-foreground truncate max-w-[300px]">{template.description}</span>
            )}
          </div>
        </div>
        <Sheet open={showConfig} onOpenChange={setShowConfig}>
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
            <Settings2 size={15} /> Configurar
          </Button>
          <SheetContent side="right" className="w-[400px] sm:w-[480px]">
            <SheetHeader>
              <SheetTitle>Configurações da Rotina</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 mt-6">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Descrição</label>
                <Textarea value={cfgDescription} onChange={(e) => setCfgDescription(e.target.value)} placeholder="Descrição da rotina..." rows={2} className="resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo de Processo</label>
                  <select value={cfgProcessType} onChange={(e) => setCfgProcessType(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                    <option value="">Selecione</option>
                    {Object.entries(PROCESS_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo de Rotina</label>
                  <select value={cfgRoutineTypeId} onChange={(e) => setCfgRoutineTypeId(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                    <option value="">Sem tipo</option>
                    {routineTypes?.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                  </select>
                </div>
              </div>
              {/* Recurrence fields */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Periodicidade</label>
                <select value={cfgRecurrence} onChange={(e) => { setCfgRecurrence(e.target.value); setCfgDueDaysFromStart(''); setCfgDueDay(''); setCfgDueMonth(''); setCfgWeekdays([1, 2, 3, 4, 5]); }}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {cfgRecurrence === 'once' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Dias para execução</label>
                  <Input type="number" min={1} value={cfgDueDaysFromStart} onChange={(e) => setCfgDueDaysFromStart(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 30" className="w-28" />
                </div>
              )}
              {cfgRecurrence === 'weekly' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Dias da semana</label>
                  <div className="flex gap-1.5 pt-1">
                    {WEEKDAY_LABELS.map(({ value, label }) => (
                      <label key={value} className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border transition-all",
                        cfgWeekdays.includes(value) ? "bg-primary/10 border-primary text-primary" : "bg-muted border-border text-muted-foreground"
                      )}>
                        <input type="checkbox" checked={cfgWeekdays.includes(value)} onChange={() => toggleWeekday(value)} className="hidden" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {cfgRecurrence === 'monthly' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Dia do vencimento</label>
                  <Input type="number" min={1} max={31} value={cfgDueDay} onChange={(e) => setCfgDueDay(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 15" className="w-28" />
                </div>
              )}
              {cfgRecurrence === 'yearly' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Dia</label>
                    <Input type="number" min={1} max={31} value={cfgDueDay} onChange={(e) => setCfgDueDay(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 15" className="w-28" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Mês</label>
                    <select value={cfgDueMonth} onChange={(e) => setCfgDueMonth(e.target.value === '' ? '' : Number(e.target.value))}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                      <option value="">Selecione</option>
                      {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowConfig(false)}>Cancelar</Button>
                <Button onClick={saveConfig} disabled={updateTemplate.isPending}>Salvar</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Recurrence details row */}
      {template.recurrence === 'once' && template.due_days_from_start && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-6">
          <Clock size={14} /> Prazo: <strong>{template.due_days_from_start} dias</strong> após o start
        </div>
      )}
      {template.recurrence === 'weekly' && template.weekday_mask && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-6">
          <Clock size={14} /> Dias: <strong>{template.weekday_mask.split(',').map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(d)]).join(', ')}</strong>
        </div>
      )}
      {template.recurrence === 'monthly' && template.due_day && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-6">
          <Clock size={14} /> Vencimento: <strong>dia {template.due_day}</strong> de cada mês
        </div>
      )}
      {template.recurrence === 'yearly' && template.due_day && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-6">
          <Clock size={14} /> Vencimento: <strong>dia {template.due_day}/{String(template.due_month).padStart(2, '0')}</strong> anualmente
        </div>
      )}

      {/* ── Activities Section ── */}
      <Card>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold">Atividades</h3>
            <Button size="sm" onClick={() => setShowAdd(true)} disabled={showAdd}>
              <Plus size={15} /> Adicionar
            </Button>
          </div>

          {/* Add Activity Form - inline, compact */}
          {showAdd && (
            <div className="p-3 bg-muted rounded-lg mb-4 border border-primary/20 space-y-3">
              <div className="flex gap-3 flex-wrap items-start">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Título</label>
                  <Input value={newActName} onChange={(e) => setNewActName(e.target.value)} placeholder="Ex: Apuração de tributos" />
                </div>
                <div className="w-[120px]">
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Prioridade</label>
                  <select value={newActPriority} onChange={(e) => setNewActPriority(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                    <option value="low">🔵 Baixa</option>
                    <option value="medium">🟡 Média</option>
                    <option value="high">🔴 Alta</option>
                  </select>
                </div>
                <div className="w-[100px]">
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Tempo (min)</label>
                  <Input type="number" min={0} value={newActMinutes} onChange={(e) => setNewActMinutes(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Descrição</label>
                <Textarea value={newActDescription} onChange={(e) => setNewActDescription(e.target.value)} placeholder="Passo a passo da atividade..." rows={2} className="resize-y text-sm" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddActivity} disabled={!newActName.trim() || createActivity.isPending}>Adicionar</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Activity list */}
          {sortedActivities.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhuma atividade cadastrada. Adicione atividades para gerar tarefas automaticamente.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sortedActivities.map((act, idx) => (
                <div
                  key={act.id}
                  draggable
                  onDragStart={() => setDraggedId(act.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    if (draggedId && draggedId !== act.id) {
                      const ids = sortedActivities.map(a => a.id);
                      const dragIdx = ids.indexOf(draggedId);
                      const dropIdx = ids.indexOf(act.id);
                      ids.splice(dragIdx, 1);
                      ids.splice(dropIdx, 0, draggedId);
                      await reorderActivities.mutateAsync({ template_id: id!, ordered_ids: ids });
                    }
                    setDraggedId(null);
                  }}
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors",
                    editingAct === act.id ? "bg-muted border-primary/30" : "bg-card border-border/60 hover:border-border",
                    draggedId === act.id && "opacity-40"
                  )}
                >
                  {editingAct === act.id ? (
                    /* ── Edit mode ── */
                    <div className="flex-1 flex flex-col gap-2.5">
                      <div className="flex gap-2 items-start flex-wrap">
                        <div className="flex-1 min-w-[150px]">
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome da atividade" />
                        </div>
                        <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}
                          className="flex h-9 w-[110px] rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                          <option value="low">🔵 Baixa</option>
                          <option value="medium">🟡 Média</option>
                          <option value="high">🔴 Alta</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <Input type="number" min={0} value={editMinutes} onChange={(e) => setEditMinutes(e.target.value === '' ? '' : Number(e.target.value))} className="w-16 text-center" placeholder="0" />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      </div>
                      <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descrição da atividade..." rows={2} className="resize-y text-sm" />
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={saveEdit} disabled={!editName.trim() || updateActivity.isPending}>Salvar</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingAct(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <>
                      <GripVertical size={14} className="text-muted-foreground shrink-0 mt-1 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-muted-foreground min-w-[18px]">{idx + 1}.</span>
                          <span className="font-semibold text-sm">{act.name}</span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold", PRIORITY_STYLES[act.priority]?.bg || 'bg-gray-500/10', PRIORITY_STYLES[act.priority]?.text || 'text-gray-500')}>
                            {PRIORITY_STYLES[act.priority]?.label || act.priority || 'Baixa'}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-[12px] text-muted-foreground ml-[26px] leading-[1.4] whitespace-pre-wrap line-clamp-2">
                            {act.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 ml-[26px] mt-0.5 text-[11px] text-muted-foreground">
                          {act.estimated_minutes && (
                            <span className="flex items-center gap-1"><Clock size={11} /> {act.estimated_minutes}min</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon-xs" onClick={() => startEdit(act)}><Edit2 size={13} /></Button>
                        <Button variant="ghost" size="icon-xs" className="text-destructive" onClick={async () => {
                          const ok = await confirm({ title: 'Remover atividade', message: `Remover "${act.name}"?`, variant: 'danger', confirmLabel: 'Remover' });
                          if (ok) deleteActivity.mutate({ template_id: id!, id: act.id });
                        }}><X size={13} /></Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage info */}
      <Card className="mt-5 bg-primary/[0.03]">
        <CardContent className="py-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Ao vincular esta rotina a um cliente, o sistema gera automaticamente {sortedActivities.length} atividade(s) como tarefas individuais com prazos calculados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
