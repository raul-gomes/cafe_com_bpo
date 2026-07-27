import React, { useState } from 'react';
import { Plus, Settings, X, ChevronRight, FileText, AlertTriangle, LayoutList, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../../api/hooks/useTasks';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { cn } from '../../lib/utils';

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Uma só vez',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
];

const MONTH_OPTIONS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

/* ── Recurrence config chips ── */
function RecurrenceChip({ tmpl }: { tmpl: any }) {
  if (tmpl.recurrence === 'once' && tmpl.due_days_from_start) {
    return <span className="text-[12px] text-muted-foreground">{tmpl.due_days_from_start} dias</span>;
  }
  if (tmpl.recurrence === 'weekly' && tmpl.weekday_mask) {
    const days = tmpl.weekday_mask.split(',').map((d: string) =>
      ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][Number(d)]
    ).join(', ');
    return <span className="text-[12px] text-muted-foreground">{days}</span>;
  }
  if (tmpl.recurrence === 'monthly' && tmpl.due_day) {
    return <span className="text-[12px] text-muted-foreground">Dia {tmpl.due_day}</span>;
  }
  if (tmpl.recurrence === 'yearly' && tmpl.due_day) {
    return <span className="text-[12px] text-muted-foreground">{tmpl.due_day}/{tmpl.due_month}</span>;
  }
  return null;
}

/* ── Page ── */
export const TemplateListPage: React.FC = () => {
  const navigate = useNavigate();
  const { useTemplatesList, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useRoutineTypes, useCreateRoutineType, useUpdateRoutineType, useDeleteRoutineType } = useTasks();
  const { data: templates, isLoading } = useTemplatesList();
  const { data: routineTypes, isLoading: typesLoading } = useRoutineTypes();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const createRoutineType = useCreateRoutineType();
  const updateRoutineType = useUpdateRoutineType();
  const deleteRoutineType = useDeleteRoutineType();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRoutineTypeId, setNewRoutineTypeId] = useState('');
  const [newRecurrence, setNewRecurrence] = useState('monthly');
  const [newDaysFromStart, setNewDaysFromStart] = useState<number | ''>('');
  const [newDueDay, setNewDueDay] = useState<number | ''>('');
  const [newDueMonth, setNewDueMonth] = useState<number | ''>('');
  const [newWeekdays, setNewWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [typeEdit, setTypeEdit] = useState<{ id?: string; name: string; color: string }>({ name: '', color: '#3b82f6' });
  const confirm = useConfirm();

  const [sectionSearch, setSectionSearch] = useState<Record<string, string>>({});
  const [sectionSearchOpen, setSectionSearchOpen] = useState<Record<string, boolean>>({});

  const toggleSearch = (key: string) => {
    setSectionSearchOpen(prev => {
      const next = { ...prev };
      if (next[key]) {
        next[key] = false;
        setSectionSearch(s => { const r = { ...s }; delete r[key]; return r; });
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const toggleWeekday = (day: number) => {
    setNewWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const payload: Record<string, unknown> = {
      name: newName.trim(),
      recurrence: newRecurrence,
    };
    if (newRoutineTypeId) {
      payload.routine_type_id = newRoutineTypeId;
    }
    if (newRecurrence === 'once') {
      payload.due_days_from_start = newDaysFromStart === '' ? undefined : Number(newDaysFromStart);
    }
    if (newRecurrence === 'weekly') {
      payload.weekday_mask = newWeekdays.join(',');
    }
    if (newRecurrence === 'monthly') {
      payload.due_day = newDueDay === '' ? undefined : Number(newDueDay);
    }
    if (newRecurrence === 'yearly') {
      payload.due_day = newDueDay === '' ? undefined : Number(newDueDay);
      payload.due_month = newDueMonth === '' ? undefined : Number(newDueMonth);
    }
    await createTemplate.mutateAsync(payload as any);
    setNewName('');
    setNewDaysFromStart('');
    setNewDueDay('');
    setNewDueMonth('');
    setNewWeekdays([1, 2, 3, 4, 5]);
    setShowCreate(false);
  };

  const toggleActive = async (template: any) => {
    await updateTemplate.mutateAsync({
      id: template.id,
      is_active: !template.is_active,
    });
  };

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[300px]" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Rotinas' }]} />

      {/* ── Page Header ── */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">Rotinas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Atividades recorrentes que podem ser vinculadas a clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowTypeManager(true)}>
            <Settings size={16} /> Tipos
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Nova Rotina
          </Button>
        </div>
      </div>

      {/* ── Create Modal ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Rotina</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Nome</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Fiscal Mensal" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo</label>
                <select value={newRoutineTypeId} onChange={(e) => setNewRoutineTypeId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                  <option value="">Sem tipo</option>
                  {routineTypes?.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Periodicidade</label>
                <select value={newRecurrence} onChange={(e) => { setNewRecurrence(e.target.value); setNewDaysFromStart(''); setNewDueDay(''); setNewDueMonth(''); setNewWeekdays([1, 2, 3, 4, 5]); }}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Recurrence-specific fields */}
            {newRecurrence === 'once' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Dias para execução</label>
                <Input type="number" min={1} value={newDaysFromStart} onChange={(e) => setNewDaysFromStart(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 30" className="w-28" />
              </div>
            )}
            {newRecurrence === 'weekly' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Dias da semana</label>
                <div className="flex gap-1.5 pt-1">
                  {WEEKDAY_LABELS.map(({ value, label }) => (
                    <label key={value} className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer border transition-all",
                      newWeekdays.includes(value) ? "bg-primary/10 border-primary text-primary" : "bg-muted border-border text-muted-foreground"
                    )}>
                      <input type="checkbox" checked={newWeekdays.includes(value)} onChange={() => toggleWeekday(value)} className="hidden" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {newRecurrence === 'monthly' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Dia do vencimento</label>
                <Input type="number" min={1} max={31} value={newDueDay} onChange={(e) => setNewDueDay(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 15" className="w-28" />
              </div>
            )}
            {newRecurrence === 'yearly' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Dia</label>
                  <Input type="number" min={1} max={31} value={newDueDay} onChange={(e) => setNewDueDay(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Ex: 15" className="w-28" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Mês</label>
                  <select value={newDueMonth} onChange={(e) => setNewDueMonth(e.target.value === '' ? '' : Number(e.target.value))}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                    <option value="">Selecione</option>
                    {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || createTemplate.isPending}>
                Criar Rotina
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Empty state ── */}
      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="size-14 rounded-xl bg-muted flex items-center justify-center mb-4">
              <FileText size={28} className="text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold mb-1.5">Nenhuma rotina criada</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center">
              Crie rotinas de atividades recorrentes para agilizar o onboarding de clientes.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Criar Primeira Rotina
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ── Sections grouped by recurrence ── */
        <div className="space-y-10">
          {([
            { key: 'once',     label: 'Uma só vez' },
            { key: 'daily',    label: 'Diário' },
            { key: 'weekly',   label: 'Semanal' },
            { key: 'monthly',  label: 'Mensal' },
            { key: 'yearly',   label: 'Anual' },
          ] as const).map(({ key, label }) => {
            const sectionTmpls = (templates || []).filter(t => t.recurrence === key);
            if (sectionTmpls.length === 0) return null;

            const query = (sectionSearch[key] || '').toLowerCase();
            const filtered = query
              ? sectionTmpls.filter(t =>
                  t.name.toLowerCase().includes(query) ||
                  (t.description || '').toLowerCase().includes(query) ||
                  (t.routine_type_name || '').toLowerCase().includes(query)
                )
              : sectionTmpls;

            return (
              <section key={key}>
                {/* ── Section header + inline search ── */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] font-bold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </h2>
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground/70 leading-none">
                      {sectionTmpls.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sectionSearchOpen[key] && (
                      <div className="flex items-center gap-2 animate-[panelFadeIn_0.2s_ease-out]">
                        <input
                          type="text"
                          value={sectionSearch[key] || ''}
                          onChange={e => setSectionSearch(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`Buscar em ${label.toLowerCase()}...`}
                          autoFocus
                          className="w-2/5 min-w-[200px] h-8 rounded-md border border-border bg-muted px-2.5 text-[13px] text-foreground outline-none transition-all duration-200 focus:border-ring focus:ring-1 focus:ring-ring/30 focus:w-[45%]"
                        />
                        {sectionSearch[key] && (
                          <button
                            onClick={() => setSectionSearch(prev => { const r = { ...prev }; delete r[key]; return r; })}
                            className="flex items-center justify-center size-6 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors cursor-pointer border-none bg-transparent shrink-0"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => toggleSearch(key)}
                      className={cn(
                        "flex items-center justify-center size-8 rounded-lg transition-colors cursor-pointer border-none shrink-0",
                        sectionSearchOpen[key]
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground/50 hover:text-foreground hover:bg-muted"
                      )}
                      title="Filtrar"
                    >
                      <Search size={16} />
                    </button>
                  </div>
                </div>

                {/* ── Separator ── */}
                <div className="h-px bg-border/40 mb-3" />

                {/* ── Cards ── */}
                {filtered.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-[13px] text-muted-foreground">
                      Nenhuma rotina encontrada para "<span className="font-semibold">{query}</span>"
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filtered.map((tmpl) => (
                      <Card
                        key={tmpl.id}
                        className={cn(
                          "flex-row items-center gap-0 cursor-pointer transition-all hover:bg-muted/30",
                          !tmpl.is_active && "opacity-50"
                        )}
                        onClick={() => navigate(`/painel/templates-atividades/${tmpl.id}`)}
                      >
                        <CardContent className="flex-1 py-3.5 px-4 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <LayoutList size={16} className="text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[15px] font-bold text-foreground leading-tight">{tmpl.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground/80 ml-12 mt-1.5">
                            <span className="font-medium">{tmpl.activity_count} {tmpl.activity_count === 1 ? 'atividade' : 'atividades'}</span>
                            <span className="text-muted-foreground/20">·</span>
                            <RecurrenceChip tmpl={tmpl} />
                            {tmpl.description && (
                              <>
                                <span className="text-muted-foreground/20">·</span>
                                <span className="truncate max-w-[200px]">{tmpl.description}</span>
                              </>
                            )}
                          </div>
                        </CardContent>
                        <div className="flex items-center gap-2 pr-3" onClick={(e) => e.stopPropagation()}>
                          {tmpl.routine_type_name && (
                            <Badge variant="outline" className="gap-1.5 text-[11px] font-semibold h-6 rounded-md border-border/40 px-2.5">
                              <span className="size-2 rounded-full shrink-0" style={{ background: tmpl.routine_type_color || '#3b82f6' }} />
                              <span className="text-foreground/70">{tmpl.routine_type_name}</span>
                            </Badge>
                          )}
                          {tmpl.is_overdue && (tmpl.days_overdue ?? 0) > 0 && (
                            <Badge variant="destructive" className="gap-1 text-[11px] font-bold h-6 rounded-md px-2">
                              <AlertTriangle size={11} /> {tmpl.days_overdue ?? 0}d
                            </Badge>
                          )}
                          <Switch checked={tmpl.is_active} onCheckedChange={() => toggleActive(tmpl)} />
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await confirm({ title: 'Excluir template', message: `Excluir template "${tmpl.name}"?`, variant: 'danger', confirmLabel: 'Excluir' });
                              if (ok) deleteTemplate.mutate(tmpl.id);
                            }}
                            className="flex items-center justify-center size-7 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer border-none bg-transparent"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground/30 mr-3 shrink-0" />
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Type Manager Dialog ── */}
      <Dialog open={showTypeManager} onOpenChange={setShowTypeManager}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Tipos de Rotina</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Input value={typeEdit.name} onChange={(e) => setTypeEdit((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nome do tipo" className="flex-1" />
            <input type="color" value={typeEdit.color} onChange={(e) => setTypeEdit((prev) => ({ ...prev, color: e.target.value }))} className="size-9 p-0.5 border border-input rounded-md cursor-pointer" />
            {typeEdit.id ? (
              <>
                <Button onClick={async () => { if (!typeEdit.name.trim() || !typeEdit.id) return; await updateRoutineType.mutateAsync({ id: typeEdit.id, name: typeEdit.name.trim(), color: typeEdit.color }); setTypeEdit({ name: '', color: '#3b82f6' }); }}
                  disabled={!typeEdit.name.trim() || updateRoutineType.isPending}>Salvar</Button>
                <Button variant="outline" onClick={() => setTypeEdit({ name: '', color: '#3b82f6' })}>Cancelar</Button>
              </>
            ) : (
              <Button onClick={async () => { if (!typeEdit.name.trim()) return; await createRoutineType.mutateAsync({ name: typeEdit.name.trim(), color: typeEdit.color }); setTypeEdit({ name: '', color: '#3b82f6' }); }}
                disabled={!typeEdit.name.trim() || createRoutineType.isPending}>Adicionar</Button>
            )}
          </div>
          {typesLoading ? (
            <div className="py-5 text-center text-muted-foreground">Carregando...</div>
          ) : !routineTypes || routineTypes.length === 0 ? (
            <div className="py-5 text-center text-muted-foreground">Nenhum tipo cadastrado.</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {routineTypes.map((rt) => (
                <div key={rt.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-muted">
                  <div className="size-3 rounded-full shrink-0" style={{ background: rt.color || '#3b82f6' }} />
                  <span className="flex-1 text-sm font-semibold">{rt.name}</span>
                  <Button variant="ghost" size="xs" onClick={() => setTypeEdit({ id: rt.id, name: rt.name, color: rt.color || '#3b82f6' })}>Editar</Button>
                  <Button variant="ghost" size="icon-xs" className="text-destructive" onClick={async () => {
                    const ok = await confirm({ title: 'Excluir tipo', message: `Excluir tipo "${rt.name}"?`, variant: 'danger', confirmLabel: 'Excluir' });
                    if (ok) await deleteRoutineType.mutateAsync(rt.id);
                  }}><X size={14} /></Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
