import React, { useState } from 'react';
import { Plus, Settings, X, ChevronRight, FileText, AlertTriangle } from 'lucide-react';
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

  if (isLoading) {
    return (
      <div className="tasks-page">
        <Skeleton className="h-8 w-[200px] mb-10" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="tasks-page animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Rotinas' }]} />

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1>Rotinas</h1>
          <p>Rotinas de atividades recorrentes que podem ser vinculadas a clientes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowTypeManager(true)}>
            <Settings size={18} /> Tipos
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Nova Rotina
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold">Nova Rotina</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowCreate(false)}>
                <X size={18} />
              </Button>
            </div>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Nome</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Fiscal Mensal"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Tipo</label>
                <select
                  value={newRoutineTypeId}
                  onChange={(e) => setNewRoutineTypeId(e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="">Selecione um tipo</option>
                  {routineTypes?.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Periodicidade</label>
                <select
                  value={newRecurrence}
                  onChange={(e) => {
                    setNewRecurrence(e.target.value);
                    setNewDaysFromStart('');
                    setNewDueDay('');
                    setNewDueMonth('');
                    setNewWeekdays([1, 2, 3, 4, 5]);
                  }}
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {newRecurrence === 'once' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Dias para execução</label>
                  <Input
                    type="number"
                    min={1}
                    value={newDaysFromStart}
                    onChange={(e) => setNewDaysFromStart(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 30"
                    className="w-[100px]"
                  />
                </div>
              )}
              {newRecurrence === 'weekly' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Dias da semana</label>
                  <div className="flex gap-1.5 pt-1">
                    {WEEKDAY_LABELS.map(({ value, label }) => (
                      <label
                        key={value}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border transition-all",
                          newWeekdays.includes(value)
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted border-border text-muted-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={newWeekdays.includes(value)}
                          onChange={() => toggleWeekday(value)}
                          className="hidden"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {newRecurrence === 'monthly' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Dia do vencimento</label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={newDueDay}
                    onChange={(e) => setNewDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 15"
                    className="w-[100px]"
                  />
                </div>
              )}
              {newRecurrence === 'yearly' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Dia</label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={newDueDay}
                      onChange={(e) => setNewDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 15"
                      className="w-[80px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Mês</label>
                    <select
                      value={newDueMonth}
                      onChange={(e) => setNewDueMonth(e.target.value === '' ? '' : Number(e.target.value))}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      <option value="">Selecione</option>
                      {MONTH_OPTIONS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createTemplate.isPending}
              >
                Criar Rotina
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!templates || templates.length === 0 ? (
        <Card className="p-0">
          <CardContent className="flex flex-col items-center py-16">
            <Settings size={48} className="text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold mb-2">Nenhuma rotina criada</h3>
            <p className="text-muted-foreground text-sm mb-5">
              Crie rotinas de atividades recorrentes para agilizar o onboarding de novos clientes.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={18} /> Criar Primeira Rotina
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((tmpl) => (
            <Card
              key={tmpl.id}
              className={cn(
                "flex-row items-center gap-0 cursor-pointer transition-all hover:bg-muted/50",
                !tmpl.is_active && "opacity-50"
              )}
              onClick={() => navigate(`/painel/templates-atividades/${tmpl.id}`)}
            >
              <FileText size={24} className="text-primary shrink-0 ml-4" />
              <CardContent className="flex-1 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold">{tmpl.name}</span>
                  {tmpl.routine_type_name && (
                    <Badge variant="outline" className="gap-1">
                      <span className="size-1.5 rounded-full shrink-0" style={{ background: tmpl.routine_type_color || '#3b82f6' }} />
                      {tmpl.routine_type_name}
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {RECURRENCE_LABELS[tmpl.recurrence] || tmpl.recurrence}
                  </Badge>
                  {tmpl.is_overdue && (tmpl.days_overdue ?? 0) > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle size={12} /> Atrasado {tmpl.days_overdue ?? 0}d
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {tmpl.recurrence === 'once' && tmpl.due_days_from_start && (
                    <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                      {tmpl.due_days_from_start} dias p/ execução
                    </span>
                  )}
                  {tmpl.recurrence === 'weekly' && tmpl.weekday_mask && (
                    <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                      {tmpl.weekday_mask.split(',').map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(d)]).join(', ')}
                    </span>
                  )}
                  {tmpl.recurrence === 'monthly' && tmpl.due_day && (
                    <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                      Vence dia {tmpl.due_day}
                    </span>
                  )}
                  {tmpl.recurrence === 'yearly' && tmpl.due_day && (
                    <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                      Vence {tmpl.due_day}/{tmpl.due_month}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground mt-1">
                  {tmpl.activity_count} atividade(s) • {tmpl.description || 'Sem descrição'}
                </div>
              </CardContent>
              <div className="flex items-center gap-1 pr-2" onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={tmpl.is_active}
                  onCheckedChange={() => toggleActive(tmpl)}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const ok = await confirm({
                      title: 'Excluir template',
                      message: `Excluir template "${tmpl.name}"?`,
                      variant: 'danger',
                      confirmLabel: 'Excluir',
                    });
                    if (ok) deleteTemplate.mutate(tmpl.id);
                  }}
                >
                  <X size={16} />
                </Button>
              </div>
              <ChevronRight size={18} className="text-muted-foreground mr-2 shrink-0" />
            </Card>
          ))}
        </div>
      )}

      {/* ── Type Manager Dialog ── */}
      <Dialog open={showTypeManager} onOpenChange={setShowTypeManager}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Tipos de Rotina</DialogTitle>
          </DialogHeader>

          {/* Add / Edit form */}
          <div className="flex gap-2 mb-4">
            <Input
              value={typeEdit.name}
              onChange={(e) => setTypeEdit((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nome do tipo"
              className="flex-1"
            />
            <input
              type="color"
              value={typeEdit.color}
              onChange={(e) => setTypeEdit((prev) => ({ ...prev, color: e.target.value }))}
              className="size-10 p-0.5 border border-input rounded-md cursor-pointer"
            />
            {typeEdit.id ? (
              <>
                <Button
                  onClick={async () => {
                    if (!typeEdit.name.trim() || !typeEdit.id) return;
                    await updateRoutineType.mutateAsync({ id: typeEdit.id, name: typeEdit.name.trim(), color: typeEdit.color });
                    setTypeEdit({ name: '', color: '#3b82f6' });
                  }}
                  disabled={!typeEdit.name.trim() || updateRoutineType.isPending}
                >
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTypeEdit({ name: '', color: '#3b82f6' })}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                onClick={async () => {
                  if (!typeEdit.name.trim()) return;
                  await createRoutineType.mutateAsync({ name: typeEdit.name.trim(), color: typeEdit.color });
                  setTypeEdit({ name: '', color: '#3b82f6' });
                }}
                disabled={!typeEdit.name.trim() || createRoutineType.isPending}
              >
                Adicionar
              </Button>
            )}
          </div>

          {/* Existing types list */}
          {typesLoading ? (
            <div className="py-5 text-center text-muted-foreground">Carregando...</div>
          ) : !routineTypes || routineTypes.length === 0 ? (
            <div className="py-5 text-center text-muted-foreground">Nenhum tipo cadastrado.</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {routineTypes.map((rt) => (
                <div
                  key={rt.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-muted"
                >
                  <div
                    className="size-3 rounded-full shrink-0"
                    style={{ background: rt.color || '#3b82f6' }}
                  />
                  <span className="flex-1 text-sm font-semibold">{rt.name}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setTypeEdit({ id: rt.id, name: rt.name, color: rt.color || '#3b82f6' })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Excluir tipo',
                        message: `Excluir tipo "${rt.name}"?`,
                        variant: 'danger',
                        confirmLabel: 'Excluir',
                      });
                      if (ok) await deleteRoutineType.mutateAsync(rt.id);
                    }}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
