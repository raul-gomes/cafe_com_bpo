import React, { useState } from 'react';
import { Plus, LayoutGrid, Calendar as CalendarIcon, Eye, X, Settings, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { TaskResponse, TaskPhaseResponse } from '../../schemas/tasks';
import { TaskModal } from '../../components/tasks/TaskModal';
import { PhaseManager } from '../../components/tasks/PhaseManager';
import { TaskCard } from '../../components/tasks/TaskCard';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

type TimelineTaskItem = { id: string; title: string; client_id: string; deadline?: string; time_estimate_minutes?: number; priority: string; process_type?: string; status: string };
type ConflictTaskItem = { id: string; title: string; time_estimate_minutes?: number; deadline?: string };

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

/* ════════════════════════════════════════
   TaskKanban — DnD Kanban Board
   ════════════════════════════════════════ */

const TaskKanban: React.FC<{
    tasks: TaskResponse[],
    phases: TaskPhaseResponse[],
    clients: any[],
    onEdit: (t: TaskResponse) => void,
    getTaskStatus: (t: TaskResponse) => string,
    onFinalize?: (id: string) => void,
    onCancel?: (id: string) => void,
    columnSearch: Record<string, string>,
    setColumnSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    handleBulkComplete: (colId: string) => void,
    handleBulkCancel: (colId: string) => void,
    bulkLoading: Record<string, 'completing' | 'cancelling' | null>
}> = ({ tasks, phases, clients, onEdit, getTaskStatus, onFinalize, onCancel, columnSearch, setColumnSearch, handleBulkComplete, handleBulkCancel, bulkLoading }) => {
    const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
    const columns = sortedPhases.length > 0 ? sortedPhases.map(p => ({
        id: p.id,
        title: p.name,
        color: p.color,
    })) : [
        { id: 'todo', title: 'A Fazer', color: '#6b7280' },
        { id: 'doing', title: 'Em Andamento', color: '#3b82f6' },
        { id: 'done', title: 'Concluído', color: '#22c55e' },
    ];

    const doneColumnId = sortedPhases.length > 0
        ? sortedPhases.reduce((prev, curr) => prev.order > curr.order ? prev : curr).id
        : 'done';

    const isTaskOverdue = (task: TaskResponse): boolean => {
        if (!task.deadline) return false;
        if (getTaskStatus(task) === doneColumnId) return false;
        const deadline = new Date(task.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return deadline < today;
    };

    const getOverdueDays = (task: TaskResponse): number => {
        if (!task.deadline) return 0;
        const deadline = new Date(task.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.floor((today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
    };

    const sortTasksByUrgency = (tasksToSort: TaskResponse[]): TaskResponse[] => {
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return [...tasksToSort].sort((a, b) => {
            const aOver = isTaskOverdue(a);
            const bOver = isTaskOverdue(b);
            if (aOver !== bOver) return aOver ? -1 : 1;
            const aPrio = priorityOrder[a.priority] ?? 1;
            const bPrio = priorityOrder[b.priority] ?? 1;
            if (aPrio !== bPrio) return aPrio - bPrio;
            if (a.deadline && b.deadline) {
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            }
            if (a.deadline) return -1;
            if (b.deadline) return 1;
            return 0;
        });
    };

    const getClient = (id: string) => clients.find(c => c.id === id);

    return (
        <div className="kanban-grid" style={{ '--kanban-cols': columns.length } as React.CSSProperties}>
            {columns.map(col => (
                <Droppable key={col.id} droppableId={col.id}>
                    {(provided, snapshot) => (
                        <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={cn(
                                'kanban-column flex min-h-[calc(100vh-250px)] max-h-[calc(100vh-200px)] flex-col overflow-y-auto rounded-lg border border-border bg-card p-4 transition-colors',
                                snapshot.isDraggingOver && 'bg-white/[0.04]'
                            )}
                        >
                            {/* Column header */}
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                    <span className="size-2.5 rounded-full" style={{ background: col.color }} />
                                    {col.title}
                                </h3>
                                <div className="flex items-center gap-1">
                                    {tasks.filter(t => getTaskStatus(t) === col.id).length > 0 && (
                                        <>
                                            <button
                                                onClick={() => handleBulkComplete(col.id)}
                                                disabled={bulkLoading[col.id] === 'completing'}
                                                title="Concluir todos"
                                                className={cn(
                                                    'cursor-pointer rounded-sm border px-1.5 py-0.5 text-[10px] font-bold font-sans leading-none transition-all',
                                                    bulkLoading[col.id] === 'completing'
                                                        ? 'border-white/10 bg-muted text-muted-foreground'
                                                        : 'border-green-500/20 bg-green-500/15 text-green-500'
                                                )}
                                            >
                                                {bulkLoading[col.id] === 'completing' ? '...' : '✓'}
                                            </button>
                                            <button
                                                onClick={() => handleBulkCancel(col.id)}
                                                disabled={bulkLoading[col.id] === 'cancelling'}
                                                title="Cancelar todos"
                                                className={cn(
                                                    'cursor-pointer rounded-sm border px-1.5 py-0.5 text-[10px] font-bold font-sans leading-none transition-all',
                                                    bulkLoading[col.id] === 'cancelling'
                                                        ? 'border-white/10 bg-muted text-muted-foreground'
                                                        : 'border-red-500/20 bg-red-500/15 text-red-500'
                                                )}
                                            >
                                                {bulkLoading[col.id] === 'cancelling' ? '...' : '✕'}
                                            </button>
                                        </>
                                    )}
                                    <span className={cn(
                                        'rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground',
                                        tasks.filter(t => getTaskStatus(t) === col.id).length > 0 && 'ml-2'
                                    )}>
                                        {tasks.filter(t => getTaskStatus(t) === col.id).length}
                                    </span>
                                </div>
                            </div>

                            {/* Column search */}
                            <div className="mb-3">
                                <input
                                    type="text"
                                    value={columnSearch[col.id] || ''}
                                    onChange={e => setColumnSearch(prev => ({ ...prev, [col.id]: e.target.value }))}
                                    placeholder="Filtrar cards..."
                                    className="w-full rounded-sm border border-border bg-muted px-2.5 py-1.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary"
                                />
                            </div>

                            {/* Cards */}
                            <div className="flex flex-1 flex-col gap-3">
                                {sortTasksByUrgency(tasks.filter(t => getTaskStatus(t) === col.id).filter(t => {
                                    const q = (columnSearch[col.id] || '').toLowerCase();
                                    if (!q) return true;
                                    return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
                                })).map((task, index) => {
                                    const client = getClient(task.client_id);
                                    return (
                                        <Draggable key={task.id} draggableId={task.id} index={index}>
                                            {(provided, snapshot) => (
                                                <TaskCard
                                                    task={task}
                                                    client={client}
                                                    colColor={col.color}
                                                    doneColumnId={doneColumnId}
                                                    onEdit={onEdit}
                                                    onFinalize={onFinalize}
                                                    onCancel={onCancel}
                                                    getTaskStatus={getTaskStatus}
                                                    isTaskOverdue={isTaskOverdue}
                                                    getOverdueDays={getOverdueDays}
                                                    innerRef={provided.innerRef}
                                                    draggableProps={provided.draggableProps}
                                                    dragHandleProps={provided.dragHandleProps}
                                                    isDragging={snapshot.isDragging}
                                                    style={provided.draggableProps.style as React.CSSProperties}
                                                />
                                            )}
                                        </Draggable>
                                    );
                                })}
                                {provided.placeholder}
                            </div>
                        </div>
                    )}
                </Droppable>
            ))}
        </div>
    );
};

/* ════════════════════════════════════════
   TaskCalendar — Monthly Calendar View
   ════════════════════════════════════════ */

const TaskCalendar: React.FC<{
    tasks: TaskResponse[],
    clients: any[],
    onEdit: (t: TaskResponse) => void,
    isMacro?: boolean
}> = ({ tasks, clients, onEdit, isMacro }) => {
    const today = new Date();
    const currMonth = today.getMonth();
    const currYear = today.getFullYear();
    const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
    const firstDay = new Date(currYear, currMonth, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const getClient = (id: string) => clients.find(c => c.id === id);

    const dayAbbrs = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
        <div>
            {!isMacro && (
                <div className="mb-6 flex justify-center">
                    <h2 className="text-[18px] font-bold capitalize text-foreground">
                        {today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
            )}
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md" style={{ background: 'rgba(255,255,255,0.08)' }}>
                {dayAbbrs.map((d, idx) => (
                    <div key={`h-${idx}`} className={cn(
                        'text-center font-extrabold uppercase text-muted-foreground',
                        isMacro ? 'bg-muted p-1 text-[9px]' : 'bg-muted p-3 text-[9px]'
                    )}>
                        {d}
                    </div>
                ))}
                {blanks.map(i => (
                    <div key={`b-${i}`} className="bg-transparent" style={{ minHeight: isMacro ? '40px' : '110px' }} />
                ))}
                {days.map(day => {
                    const dateStr = new Date(currYear, currMonth, day).toISOString().split('T')[0];
                    const dayTasks = tasks.filter(t => t.deadline && t.deadline.startsWith(dateStr));
                    const isToday = day === today.getDate();

                    return (
                        <div
                            key={`d-${day}`}
                            className="flex flex-col gap-0.5 border border-white/[0.02] bg-transparent"
                            style={{ minHeight: isMacro ? '40px' : '110px', padding: isMacro ? '2px' : '8px' }}
                        >
                            <div className={cn(
                                'mb-0.5 text-right font-extrabold',
                                isMacro ? 'text-[10px]' : 'text-[12px]',
                                isToday ? 'text-primary' : 'text-muted-foreground'
                            )}>
                                {day}
                            </div>
                            {dayTasks.map(task => {
                                const client = getClient(task.client_id);
                                return (
                                    <div
                                        key={task.id}
                                        onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                                        title={`${client?.name || ''}: ${task.title}`}
                                        className={cn(
                                            'cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap',
                                            isMacro
                                                ? 'h-1.5 rounded-sm'
                                                : 'flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-extrabold text-black'
                                        )}
                                        style={{
                                            background: client?.color || 'var(--ds-primary)',
                                            height: isMacro ? '6px' : 'auto',
                                            borderLeft: !isMacro && task.priority === 'high' ? '3px solid rgba(0,0,0,0.5)' : 'none',
                                        }}
                                    >
                                        {!isMacro && (
                                            <span
                                                className="inline-block size-1.5 shrink-0 rounded-full"
                                                style={{
                                                    background: task.priority === 'high' ? 'var(--ds-error)' : task.priority === 'medium' ? 'var(--ds-warning)' : 'var(--ds-success)',
                                                }}
                                            />
                                        )}
                                        {!isMacro && task.status === 'doing' && (
                                            <span className="rounded-sm bg-blue-500 px-0.5 text-[7px] font-extrabold leading-none text-white">EM AND</span>
                                        )}
                                        {!isMacro && task.title}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ════════════════════════════════════════
   TaskTimeline — Gantt-like Timeline View
   ════════════════════════════════════════ */

const TaskTimeline: React.FC<{
    timeline: { date: string; tasks: TimelineTaskItem[]; total_hours: number }[];
    conflicts: { date: string; tasks: ConflictTaskItem[]; total_hours: number }[];
    clients: any[];
    isLoading: boolean;
    onEdit: (t: TaskResponse) => void
}> = ({ timeline, conflicts, clients, isLoading, onEdit }) => {
    const getClient = (id: string) => clients.find(c => c.id === id);
    const conflictDates = new Set(conflicts.map(c => c.date));

    if (isLoading) return <div className="py-10 text-center text-muted-foreground">Carregando timeline...</div>;
    if (timeline.length === 0) return <div className="py-10 text-center text-muted-foreground">Nenhuma tarefa com prazo encontrada.</div>;

    const maxHours = Math.max(...timeline.map(d => d.total_hours), 8);

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-foreground">Timeline de Tarefas</h2>
                {conflicts.length > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5 text-[12px] text-warning">
                        <AlertTriangle size={14} /> {conflicts.length} conflito(s) de sobrecarga detectado(s)
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-3">
                {timeline.map(day => {
                    const isPast = new Date(day.date + 'T00:00:00') < new Date(new Date().toISOString().split('T')[0]);
                    const isConflict = conflictDates.has(day.date);
                    return (
                        <div
                            key={day.date}
                            className={cn(
                                'rounded-lg border p-4',
                                isConflict
                                    ? 'border-warning/30 bg-warning/5'
                                    : 'border-white/[0.06] bg-muted',
                                isPast && 'opacity-60'
                            )}
                        >
                            <div className="mb-2.5 flex items-center justify-between">
                                <span className="text-[13px] font-bold text-foreground">
                                    {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-[100px] overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min((day.total_hours / maxHours) * 100, 100)}%`,
                                                background: day.total_hours > 8 ? 'var(--ds-error)' : 'var(--ds-primary)',
                                            }}
                                        />
                                    </div>
                                    <span className={cn('text-[11px] font-bold', day.total_hours > 8 ? 'text-destructive' : 'text-muted-foreground')}>
                                        {day.total_hours.toFixed(1)}h
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {day.tasks.map(task => {
                                    const client = getClient(task.client_id);
                                    return (
                                        <div
                                            key={task.id}
                                            onClick={() => onEdit(task as TaskResponse)}
                                            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:brightness-110"
                                            style={{
                                                background: (client?.color || 'var(--ds-primary)') + '22',
                                                borderLeft: `3px solid ${client?.color || 'var(--ds-primary)'}`,
                                            }}
                                        >
                                            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: client?.color || 'var(--ds-text-muted)' }}>
                                                {client?.name || 'Cliente'}
                                            </span>
                                            <span className="font-semibold">{task.title}</span>
                                            {task.status === 'doing' && (
                                                <span className="rounded-sm bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                                                    Em andamento
                                                </span>
                                            )}
                                            {task.time_estimate_minutes && (
                                                <span className="text-[10px] font-bold text-muted-foreground">{task.time_estimate_minutes}min</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
