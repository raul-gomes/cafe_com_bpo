import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Edit2, GripVertical } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';

const PROCESS_TYPE_LABELS: Record<string, string> = {
  fiscal: 'Fiscal',
  contabil: 'Contábil',
  dp: 'DP',
  financeiro: 'Financeiro',
  administrativo: 'Administrativo',
};

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Uma só vez',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: '🔵 Baixa' },
  { value: 'medium', label: '🟡 Média' },
  { value: 'high', label: '🔴 Alta' },
];

const WEEKDAY_LABELS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
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

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newActName, setNewActName] = useState('');
  const [newActDescription, setNewActDescription] = useState('');
  const [newActPriority, setNewActPriority] = useState('medium');
  const [newActHours, setNewActHours] = useState<number | ''>('');
  const [editingAct, setEditingAct] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editHours, setEditHours] = useState<number | ''>('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [cfgDescription, setCfgDescription] = useState('');
  const [cfgDueDay, setCfgDueDay] = useState<number | ''>('');
  const [cfgDueMonth, setCfgDueMonth] = useState<number | ''>('');
  const [cfgDueDaysFromStart, setCfgDueDaysFromStart] = useState<number | ''>('');
  const [cfgWeekdays, setCfgWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [cfgRecurrence, setCfgRecurrence] = useState('monthly');
  const [cfgProcessType, setCfgProcessType] = useState('');
  const [cfgRoutineTypeId, setCfgRoutineTypeId] = useState('');
  const confirm = useConfirm();

  useEffect(() => {
    if (template) {
      setCfgDescription(template.description || '');
      setCfgDueDay(template.due_day ?? '');
      setCfgDueMonth(template.due_month ?? '');
      setCfgDueDaysFromStart(template.due_days_from_start ?? '');
      if (template.weekday_mask) {
        setCfgWeekdays(template.weekday_mask.split(',').map(Number));
      } else {
        setCfgWeekdays([1, 2, 3, 4, 5]);
      }
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
    if (cfgRecurrence === 'once') {
      payload.due_days_from_start = cfgDueDaysFromStart === '' ? undefined : Number(cfgDueDaysFromStart);
    }
    if (cfgRecurrence === 'weekly') {
      payload.weekday_mask = cfgWeekdays.join(',');
    }
    if (cfgRecurrence === 'monthly') {
      payload.due_day = cfgDueDay === '' ? undefined : Number(cfgDueDay);
    }
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
      estimated_minutes: newActHours === '' ? undefined : Number(newActHours),
      order: template?.activities?.length || 0,
    });
    setNewActName('');
    setNewActDescription('');
    setNewActPriority('medium');
    setNewActHours('');
    setShowAdd(false);
  };

  const startEdit = (act: any) => {
    setEditingAct(act.id);
    setEditName(act.name);
    setEditDescription(act.description || '');
    setEditPriority(act.priority || 'medium');
    setEditHours(act.estimated_minutes ?? '');
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editingAct) return;
    await updateActivity.mutateAsync({
      template_id: id!,
      id: editingAct,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      priority: editPriority,
      estimated_minutes: editHours === '' ? undefined : Number(editHours),
    });
    setEditingAct(null);
  };

  if (isLoading) {
    return (
      <div className="tasks-page">
        <Skeleton className="h-8 w-[200px] mb-10" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="tasks-page">
        <Card className="p-0">
          <CardContent className="flex flex-col items-center py-16">
            <h3 className="text-lg font-bold">Rotina não encontrada</h3>
            <Button variant="ghost" onClick={() => navigate('/painel/templates-atividades')} className="mt-3">
              ← Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedActivities = [...(template.activities || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="tasks-page animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[
        { label: 'Painel', to: '/painel' },
        { label: 'Rotinas', to: '/painel/templates-atividades' },
        { label: template.name },
      ]} />

      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/painel/templates-atividades')} className="gap-2">
          <ArrowLeft size={16} /> Voltar
        </Button>
      </div>

      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div className="flex-1">
          {editingName ? (
            <div className="flex gap-2 items-center">
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="max-w-[300px] text-xl font-bold"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
              />
              <Button size="sm" onClick={saveName}>Salvar</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingName(false)}>Cancelar</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1>{template.name}</h1>
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditingName(true); setNameValue(template.name); }}>
                <Edit2 size={16} />
              </Button>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="text-primary bg-primary/10 border-primary/20">
              {PROCESS_TYPE_LABELS[template.process_type || ''] || template.process_type}
            </Badge>
            <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400">
              {RECURRENCE_LABELS[template.recurrence] || template.recurrence}
            </Badge>
            {template.description && (
              <span className="text-[13px] text-muted-foreground">{template.description}</span>
            )}
          </div>
          {/* Recurrence details — always visible */}
          {template.recurrence === 'once' && template.due_days_from_start && (
            <div className="mt-2.5 text-[13px] text-muted-foreground flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Prazo: <strong>{template.due_days_from_start} dias</strong> após o start</span>
            </div>
          )}
          {template.recurrence === 'weekly' && template.weekday_mask && (
            <div className="mt-2.5 text-[13px] text-muted-foreground flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Dias: <strong>{template.weekday_mask.split(',').map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(d)]).join(', ')}</strong></span>
            </div>
          )}
          {template.recurrence === 'monthly' && template.due_day && (
            <div className="mt-2.5 text-[13px] text-muted-foreground flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Vencimento: <strong>dia {template.due_day}</strong> de cada mês</span>
            </div>
          )}
          {template.recurrence === 'yearly' && template.due_day && (
            <div className="mt-2.5 text-[13px] text-muted-foreground flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Vencimento: <strong>dia {template.due_day}/{template.due_month}</strong> anualmente</span>
            </div>
          )}
        </div>
      </div>

      {/* Template Config */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-bold m-0">Configurações da Rotina</h3>
            <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
              {showConfig ? 'Cancelar' : <><Edit2 size={14} /> Editar</>}
            </Button>
          </div>
          {showConfig ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Descrição</label>
                <Textarea
                  value={cfgDescription}
                  onChange={(e) => setCfgDescription(e.target.value)}
                  placeholder="Descrição da rotina..."
                  rows={2}
                  className="resize-y"
                />
              </div>
              <div className="flex gap-3 flex-wrap items-center">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo de Processo</label>
                  <select
                    value={cfgProcessType}
                    onChange={(e) => setCfgProcessType(e.target.value)}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <option value="">Selecione</option>
                    {Object.entries(PROCESS_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo de Rotina</label>
                  <select
                    value={cfgRoutineTypeId}
                    onChange={(e) => setCfgRoutineTypeId(e.target.value)}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <option value="">Sem tipo</option>
                    {routineTypes?.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {cfgRecurrence === 'once' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Dias para execução</label>
                  <Input
                    type="number" min={1}
                    value={cfgDueDaysFromStart}
                    onChange={(e) => setCfgDueDaysFromStart(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 30"
                    className="w-[120px]"
                  />
                </div>
              )}
              {cfgRecurrence === 'weekly' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Dias da semana</label>
                  <div className="flex gap-1.5 pt-1">
                    {WEEKDAY_LABELS.map(({ value, label }) => (
                      <label
                        key={value}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border transition-all",
                          cfgWeekdays.includes(value)
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted border-border text-muted-foreground"
                        )}
                      >
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
                  <Input
                    type="number" min={1} max={31}
                    value={cfgDueDay}
                    onChange={(e) => setCfgDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 15"
                    className="w-[100px]"
                  />
                </div>
              )}
              {cfgRecurrence === 'yearly' && (
                <div className="flex gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Dia</label>
                    <Input
                      type="number" min={1} max={31}
                      value={cfgDueDay}
                      onChange={(e) => setCfgDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 15"
                      className="w-[80px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Mês</label>
                    <select
                      value={cfgDueMonth}
                      onChange={(e) => setCfgDueMonth(e.target.value === '' ? '' : Number(e.target.value))}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      <option value="">Selecione</option>
                      {MONTH_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <Button size="sm" onClick={saveConfig} disabled={updateTemplate.isPending}>
                  Salvar Configurações
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap items-center text-[13px]">
              {template.description && (
                <span className="text-muted-foreground">{template.description}</span>
              )}
              <Badge variant="outline" className="text-primary bg-primary/10 border-primary/20">
                {PROCESS_TYPE_LABELS[template.process_type || ''] || template.process_type || 'Sem tipo'}
              </Badge>
              {template.routine_type_id && routineTypes && (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border-emerald-500/20">
                  {(() => {
                    const rt = routineTypes.find(r => r.id === template.routine_type_id);
                    return rt ? <>{rt.name}</> : null;
                  })()}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {RECURRENCE_LABELS[template.recurrence] || template.recurrence}
              </span>
              {template.recurrence === 'weekly' && template.weekday_mask && (
                <span className="text-muted-foreground">
                  {template.weekday_mask.split(',').map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(d)]).join(', ')}
                </span>
              )}
              {template.recurrence === 'monthly' && template.due_day && (
                <span className="text-muted-foreground">Dia {template.due_day}</span>
              )}
              {template.recurrence === 'yearly' && template.due_day && (
                <span className="text-muted-foreground">{template.due_day}/{template.due_month}</span>
              )}
              {template.recurrence === 'once' && template.due_days_from_start && (
                <span className="text-muted-foreground">{template.due_days_from_start} dias p/ execução</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activities */}
      <Card>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold">Atividades da Rotina</h3>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Adicionar Atividade
            </Button>
          </div>

          {showAdd && (
            <div className="p-4 bg-muted rounded-lg mb-4 border border-primary/20">
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 flex-wrap items-start">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Título da Tarefa</label>
                    <Input value={newActName} onChange={(e) => setNewActName(e.target.value)} placeholder="Ex: Apuração de tributos" />
                  </div>
                  <div className="min-w-[140px]">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Prioridade</label>
                    <select
                      value={newActPriority}
                      onChange={(e) => setNewActPriority(e.target.value)}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {PRIORITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Minutos Estimados</label>
                    <Input type="number" min={0} value={newActHours} onChange={(e) => setNewActHours(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="w-[80px]" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Descrição</label>
                  <Textarea
                    value={newActDescription}
                    onChange={(e) => setNewActDescription(e.target.value)}
                    placeholder="Passo a passo da atividade..."
                    rows={3}
                    className="resize-y"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddActivity} disabled={!newActName.trim() || createActivity.isPending}>
                    Adicionar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
                </div>
              </div>
            </div>
          )}

          {sortedActivities.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhuma atividade nesta rotina. Adicione atividades para que sejam geradas automaticamente ao vincular a um cliente.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
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
                    "flex flex-col gap-2 p-3 rounded-lg border",
                    editingAct === act.id ? "bg-muted" : "bg-card",
                    draggedId === act.id && "opacity-50",
                    "border-border"
                  )}
                >
                  {editingAct === act.id ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex gap-2 items-center flex-wrap">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 min-w-[150px]" />
                        <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}
                          className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                          {PRIORITY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <div className="flex gap-1 items-center text-[13px] text-muted-foreground">
                          ⏱
                          <Input type="number" min={0} value={editHours} onChange={(e) => setEditHours(e.target.value === '' ? '' : Number(e.target.value))} className="w-[60px] text-center" />
                          min
                        </div>
                      </div>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Descrição da atividade..."
                        rows={2}
                        className="resize-y"
                      />
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={saveEdit} disabled={updateActivity.isPending}>Salvar</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingAct(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <GripVertical size={16} className="text-muted-foreground shrink-0 mt-0.5 cursor-grab" />
                        <span className="text-xs font-bold text-muted-foreground min-w-[24px] mt-0.5">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{act.name}</span>
                            <span className={cn(
                              "text-[11px] px-2 py-0.5 rounded-full font-bold text-white",
                              act.priority === 'low' && "bg-blue-500",
                              act.priority === 'medium' && "bg-yellow-500",
                              act.priority === 'high' && "bg-red-500",
                              !act.priority && "bg-gray-500"
                            )}>
                              {PRIORITY_OPTIONS.find(p => p.value === act.priority)?.label.split(' ')[1] || act.priority}
                            </span>
                            {act.due_day && (
                              <span className="text-xs text-muted-foreground">📅 Dia {act.due_day}</span>
                            )}
                            {act.estimated_minutes && (
                              <span className="text-xs text-muted-foreground">⏱ {act.estimated_minutes}min</span>
                            )}
                          </div>
                          {act.description && (
                            <p className="text-[13px] text-muted-foreground mt-1 leading-[1.4] whitespace-pre-wrap">
                              {act.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0 mt-0.5">
                          <Button variant="ghost" size="icon-sm" onClick={() => startEdit(act)}>
                            <Edit2 size={14} />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={async () => {
                            const ok = await confirm({
                              title: 'Remover atividade',
                              message: `Remover "${act.name}"?`,
                              variant: 'danger',
                              confirmLabel: 'Remover',
                            });
                            if (ok) deleteActivity.mutate({ template_id: id!, id: act.id });
                          }}>
                            <X size={14} />
                          </Button>
                        </div>
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
      <Card className="mt-6 bg-primary/[0.03]">
        <CardContent>
          <h4 className="text-sm font-bold mb-2">Como usar esta rotina</h4>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Ao vincular esta rotina a um cliente (na página de <strong>Empresas</strong> ou diretamente na <strong>Timeline do Cliente</strong>),
            o sistema irá gerar automaticamente todas as {sortedActivities.length} atividade(s) como tarefas individuais, cada uma com seu prazo calculado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
