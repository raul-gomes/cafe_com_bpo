import React, { useState } from 'react';
import { Plus, LayoutGrid, Calendar as CalendarIcon, Eye, X, Settings, Clock, RefreshCw } from 'lucide-react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { TaskResponse } from '../../schemas/tasks';
import { TaskModal } from '../../components/tasks/TaskModal';
import { PhaseManager } from '../../components/tasks/PhaseManager';
import { TaskKanban } from '../../components/tasks/TaskKanban';
import { TaskCalendar } from '../../components/tasks/TaskCalendar';
import { TaskTimeline } from '../../components/tasks/TaskTimeline';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

export const TasksPage: React.FC = () => {
    const [view, setView] = useState<'kanban' | 'calendar' | 'timeline'>('kanban');
    const [filterMode, setFilterMode] = useState<'all' | 'today' | 'week' | 'month' | 'overdue'>('today');
    const [showMacroCalendar, setShowMacroCalendar] = useState(false);
    const [showPhaseManager, setShowPhaseManager] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});
    const [bulkLoading, setBulkLoading] = useState<Record<string, 'completing' | 'cancelling' | null>>({});
    const { useTasksList, useUpdateTaskStatus, usePhases, useTimeline, useConflicts, useCancelTask } = useTasks();
    const { data: tasks, isLoading } = useTasksList();
    const { data: phases } = usePhases();
    const sortedPhases = [...(phases || [])].sort((a, b) => a.order - b.order);
    const doneColumnId = sortedPhases.length > 0
        ? sortedPhases[sortedPhases.length - 1].id
        : 'done';
    const updateTaskStatus = useUpdateTaskStatus();
    const cancelTask = useCancelTask();
    const { data: timelineData, isLoading: timelineLoading } = useTimeline();
    const { data: conflictsData } = useConflicts();

    const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);
    const [isTaskModalOpen, setTaskModalOpen] = useState(false);

    const { data: clients } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const { data } = await apiClient.get('/clients/');
            return data;
        }
    });

    const handleBulkComplete = async (colId: string) => {
        if (!tasks) return;
        const colTasks = tasks.filter(t => getTaskStatus(t) === colId);
        if (colTasks.length === 0) return;
        if (!confirm(`Concluir todas as ${colTasks.length} tarefas desta fase?`)) return;
        setBulkLoading(prev => ({ ...prev, [colId]: 'completing' }));
        try {
            await Promise.all(colTasks.map(t =>
                updateTaskStatus.mutateAsync({ id: t.id, phase_id: doneColumnId })
            ));
        } finally {
            setBulkLoading(prev => ({ ...prev, [colId]: null }));
        }
    };

    const handleBulkCancel = async (colId: string) => {
        if (!tasks) return;
        const colTasks = tasks.filter(t => getTaskStatus(t) === colId);
        if (colTasks.length === 0) return;
        if (!confirm(`Cancelar todas as ${colTasks.length} tarefas desta fase?`)) return;
        setBulkLoading(prev => ({ ...prev, [colId]: 'cancelling' }));
        try {
            await Promise.all(colTasks.map(t =>
                cancelTask.mutateAsync(t.id)
            ));
        } finally {
            setBulkLoading(prev => ({ ...prev, [colId]: null }));
        }
    };

    const handleDragEnd = (result: any) => {
        if (!result.destination) return;
        const { draggableId, destination } = result;
        if (destination.droppableId === result.source.droppableId) return;
        updateTaskStatus.mutate({ id: draggableId, phase_id: destination.droppableId });
    };

    const getTaskStatus = (task: TaskResponse): string => {
        if (task.status === 'cancelled' || task.cancelled_at) {
            return 'cancelled';
        }
        if (task.phase_id && phases) {
            return task.phase_id;
        }
        return task.status;
    };

    const handleOpenNewTask = () => {
        setSelectedTask(null);
        setTaskModalOpen(true);
    };

    const handleSyncCalendar = async () => {
        const activeTaskIds = tasksList
            .filter(t => t.status !== 'done' && t.status !== 'cancelled' && !t.cancelled_at)
            .map(t => t.id);
        if (activeTaskIds.length === 0) return;
        try {
            await apiClient.post('/calendar/sync', { task_ids: activeTaskIds });
            toast.success('Tarefas sincronizadas com o Google Agenda!');
        } catch (err: any) {
            const detail = err?.response?.data?.detail || 'Erro ao sincronizar';
            toast.error(detail);
        }
    };

    const handleRunScheduler = async () => {
        try {
            const { data } = await apiClient.post('/tasks/scheduler/run');
            const parts = [
                `${data.tasks_generated} tarefa(s) gerada(s)`,
                `${data.tasks_skipped} já existente(s)`,
                `${data.assignments_processed} vinculo(s) processado(s)`,
            ];
            if (data.errors?.length > 0) {
                parts.push(`${data.errors.length} erro(s)`);
            }
            toast.success(`Rotinas executadas!\n${parts.join('\n')}`);
        } catch (err: any) {
            const detail = err?.response?.data?.detail || 'Erro ao executar rotinas';
            toast.error(detail);
        }
    };

    const handleEditTask = (task: TaskResponse) => {
        setSelectedTask(task);
        setTaskModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-[200px]" />
                <Skeleton className="h-[500px] w-full" />
            </div>
        );
    }

    const tasksList = tasks || [];

    const todayStr = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const isOverdue = (t: TaskResponse) => t.deadline && new Date(t.deadline) < todayStart;

    const filteredTasks = tasksList.filter(t => {
        if (t.status === 'cancelled' || t.cancelled_at) return false;
        if (isOverdue(t)) return true;
        if (filterMode === 'today') {
            if (!t.deadline?.startsWith(todayStr)) return false;
        }
        if (filterMode === 'week') {
            const mon = new Date(); mon.setDate(mon.getDate() - mon.getDay() + 1);
            const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
            const weekStart = mon.toISOString().split('T')[0];
            const weekEnd = sun.toISOString().split('T')[0];
            const deadlineDate = t.deadline?.split('T')[0];
            if (!deadlineDate || deadlineDate < weekStart || deadlineDate > weekEnd) return false;
        }
        if (filterMode === 'month') {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            const deadlineDate = t.deadline?.split('T')[0];
            if (!deadlineDate || deadlineDate < first || deadlineDate > last) return false;
        }
        if (filterMode === 'overdue') {
            if (!t.deadline) return false;
            if (new Date(t.deadline) >= todayStart) return false;
        }
        const deadlineDate = t.deadline?.split('T')[0];
        if (dateFrom && deadlineDate && deadlineDate < dateFrom) return false;
        if (dateTo && deadlineDate && deadlineDate > dateTo) return false;
        return true;
    });

    const openTasksCount = tasksList.filter(t => t.status !== 'done' && t.status !== 'cancelled' && !t.cancelled_at).length;
    const overdueCount = tasksList.filter(t => {
        if (t.status === 'done' || t.status === 'cancelled' || t.cancelled_at) return false;
        if (!t.deadline) return false;
        return new Date(t.deadline) < todayStart;
    }).length;

    return (
        <div className="animate-[panelFadeIn_0.4s_ease-out]">
            <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Gestão de Tarefas' }]} />

            {/* Header */}
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">Gestão de Tarefas</h1>
                    <p className="mb-2 text-[14px] text-muted-foreground">Controle operacional e prazos por empresa.</p>
                    <div className="flex gap-4 text-[12px] text-muted-foreground">
                        <span className="font-bold text-foreground">{openTasksCount}</span> tarefas abertas
                        <span className="opacity-30">|</span>
                        <span className="font-bold text-primary">{overdueCount}</span> em atraso
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {view === 'kanban' && (
                        <Button variant="ghost" size="sm" onClick={() => setShowPhaseManager(true)}>
                            <Settings size={16} /> Fases
                        </Button>
                    )}
                    {view === 'kanban' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowMacroCalendar(!showMacroCalendar)}
                            className={showMacroCalendar ? 'text-primary' : ''}
                        >
                            <Eye size={16} /> {showMacroCalendar ? 'Ocultar Calendário' : 'Visão Macro'}
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleSyncCalendar} title="Sincronizar tarefas ativas com Google Agenda">
                        <CalendarIcon size={16} /> Sincronizar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleRunScheduler} title="Executar rotinas — gerar tarefas pendentes com base na recorrência">
                        <RefreshCw size={16} /> Executar Rotinas
                    </Button>

                    {/* View toggle */}
                    <div className="flex rounded-lg border border-border bg-muted p-[3px]">
                        {([{ key: 'kanban', icon: LayoutGrid, label: 'Kanban' },
                          { key: 'timeline', icon: Clock, label: 'Timeline' },
                          { key: 'calendar', icon: CalendarIcon, label: 'Calendário' }] as const).map(v => (
                            <button
                                key={v.key}
                                onClick={() => setView(v.key)}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all',
                                    view === v.key
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <v.icon size={16} /> {v.label}
                            </button>
                        ))}
                    </div>

                    <Button variant="default" size="sm" onClick={handleOpenNewTask}>
                        <Plus size={18} /> Nova Tarefa
                    </Button>
                </div>
            </div>

            {/* Filter bar */}
            {view === 'kanban' && (
                <div className="mb-5 flex flex-wrap items-center gap-1.5">
                    {([
                        { key: 'today', label: 'Hoje' },
                        { key: 'week', label: 'Semana' },
                        { key: 'month', label: 'Mês' },
                        { key: 'all', label: 'Todas' },
                        { key: 'overdue', label: 'Atrasadas' },
                    ] as const).map(f => (
                        <button
                            key={f.key}
                            onClick={() => { setFilterMode(f.key); setDateFrom(''); setDateTo(''); }}
                            className={cn(
                                'rounded-sm px-3 py-1 text-[12px] font-bold font-sans transition-all',
                                filterMode === f.key
                                    ? 'border border-primary bg-primary text-primary-foreground'
                                    : 'border border-white/10 bg-muted text-muted-foreground'
                            )}
                        >
                            {f.label}
                            {f.key === 'overdue' && overdueCount > 0 && (
                                <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">
                                    {overdueCount}
                                </span>
                            )}
                        </button>
                    ))}
                    <div className="mx-1 h-5 w-px bg-white/10" />

                    {/* Datepicker */}
                    <div className="relative">
                        <button
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            className={cn(
                                'flex items-center gap-1 rounded-sm px-2.5 py-1 text-[12px] font-bold font-sans transition-all',
                                showDatePicker || dateFrom
                                    ? 'border border-primary bg-primary text-primary-foreground'
                                    : 'border border-white/10 bg-muted text-muted-foreground'
                            )}
                            title="Filtrar por intervalo de datas"
                        >
                            <CalendarIcon size={14} />
                            {dateFrom ? `${dateFrom.split('-').slice(1).join('/')} - ${dateTo?.split('-').slice(1).join('/')}` : 'Período'}
                        </button>
                        {showDatePicker && (
                            <div className="absolute left-0 top-full z-[100] mt-1 flex min-w-[220px] flex-col gap-2 rounded-md border border-border bg-card p-3 shadow-lg">
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-muted-foreground">De</label>
                                    <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setFilterMode('all'); }}
                                        className="filter-date-input w-full rounded-sm border border-border bg-muted px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-muted-foreground">Até</label>
                                    <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setFilterMode('all'); }}
                                        className="filter-date-input w-full rounded-sm border border-border bg-muted px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary" />
                                </div>
                                <div className="flex justify-end gap-1">
                                    <button onClick={() => { setDateFrom(''); setDateTo(''); setShowDatePicker(false); }}
                                        className="cursor-pointer rounded-sm border border-border bg-transparent px-2.5 py-1 text-[11px] text-muted-foreground">
                                        Limpar
                                    </button>
                                    <button onClick={() => setShowDatePicker(false)}
                                        className="cursor-pointer rounded-sm border-none bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
                                        OK
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clear all filters */}
                    {(filterMode !== 'all' || dateFrom) && (
                        <button onClick={() => { setFilterMode('all'); setDateFrom(''); setDateTo(''); setShowDatePicker(false); }}
                            className="cursor-pointer border-none bg-transparent text-[10px] font-bold text-primary underline underline-offset-2">
                            Limpar
                        </button>
                    )}
                </div>
            )}

            {/* Main content area */}
            <div className="flex items-start gap-6">
                <div className="min-w-0 flex-1">
                    {view === 'kanban' ? (
                        filteredTasks.length === 0 ? (
                            <Card className="p-12 text-center">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-30 text-muted-foreground">
                                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                                </svg>
                                <h3 className="mb-2 text-[18px] font-bold text-foreground">
                                    {filterMode !== 'all' ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa criada'}
                                </h3>
                                <p className="mb-5 text-[14px] text-muted-foreground">
                                    {filterMode !== 'all' ? 'Tente alterar o filtro ou criar uma nova tarefa.' : 'Comece organizando suas tarefas operacionais por empresa e fase.'}
                                </p>
                                <Button variant="default" onClick={handleOpenNewTask}>
                                    <Plus size={18} /> Criar Primeira Tarefa
                                </Button>
                            </Card>
                        ) : (
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <TaskKanban tasks={filteredTasks} phases={phases || []} clients={clients || []} onEdit={handleEditTask}
                                    getTaskStatus={getTaskStatus} columnSearch={columnSearch} setColumnSearch={setColumnSearch}
                                    onFinalize={(id) => {
                                        if (phases && phases.length > 0) {
                                            updateTaskStatus.mutate({ id, phase_id: doneColumnId, status: 'done' });
                                        } else {
                                            updateTaskStatus.mutate({ id, status: 'done' });
                                        }
                                    }} onCancel={(id) => cancelTask.mutate(id)}
                                    handleBulkComplete={handleBulkComplete} handleBulkCancel={handleBulkCancel} bulkLoading={bulkLoading} />
                            </DragDropContext>
                        )
                    ) : view === 'timeline' ? (
                        <Card className="p-6">
                            <TaskTimeline
                                timeline={timelineData?.timeline || []}
                                conflicts={conflictsData?.conflicts || []}
                                clients={clients || []}
                                isLoading={timelineLoading}
                                onEdit={handleEditTask}
                            />
                        </Card>
                    ) : (
                        <Card className="p-6">
                            <TaskCalendar tasks={tasksList} clients={clients || []} onEdit={handleEditTask} isMacro={false} />
                        </Card>
                    )}
                </div>

                {/* Macro calendar sidebar */}
                {view === 'kanban' && showMacroCalendar && (
                    <Card className="sticky top-5 h-fit w-[320px] animate-[slideInRight_0.3s_ease-out] border border-primary/20 p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-[14px] font-bold text-foreground">Visão Mensal</h3>
                            <button onClick={() => setShowMacroCalendar(false)} className="cursor-pointer border-none bg-transparent text-muted-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <TaskCalendar tasks={tasksList} clients={clients || []} onEdit={handleEditTask} isMacro={true} />
                    </Card>
                )}
            </div>

            <TaskModal
                isOpen={isTaskModalOpen}
                onClose={() => setTaskModalOpen(false)}
                task={selectedTask}
            />

            <PhaseManager
                isOpen={showPhaseManager}
                onClose={() => setShowPhaseManager(false)}
            />
        </div>
    );
};
