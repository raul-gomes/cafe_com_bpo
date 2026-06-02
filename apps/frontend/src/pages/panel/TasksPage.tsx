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

type TimelineTaskItem = { id: string; title: string; client_id: string; deadline?: string; time_estimate_hours?: number; priority: string; process_type?: string; status: string };
type ConflictTaskItem = { id: string; title: string; time_estimate_hours?: number; deadline?: string };

export const TasksPage: React.FC = () => {
    const [view, setView] = useState<'kanban' | 'calendar' | 'timeline'>('kanban');
    const [sectionFilter, setSectionFilter] = useState<'all' | 'pendentes' | 'today' | 'doing' | 'overdue'>('pendentes');
    const [showMacroCalendar, setShowMacroCalendar] = useState(false);
    const [showPhaseManager, setShowPhaseManager] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [phaseFilter, setPhaseFilter] = useState('all');
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

    const handleDragEnd = (result: any) => {
        if (!result.destination) return;
        const { draggableId, destination } = result;
        if (destination.droppableId === result.source.droppableId) return;
        
        // Use phase_id for phase-based Kanban
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
            alert('Tarefas sincronizadas com o Google Agenda!');
        } catch (err: any) {
            const detail = err?.response?.data?.detail || 'Erro ao sincronizar';
            alert(detail);
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
            alert(`Rotinas executadas!\n\n${parts.join('\n')}`);
        } catch (err: any) {
            const detail = err?.response?.data?.detail || 'Erro ao executar rotinas';
            alert(detail);
        }
    };

    const handleEditTask = (task: TaskResponse) => {
        setSelectedTask(task);
        setTaskModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="tasks-page">
                <div className="panel-skeleton" style={{ height: '32px', width: '200px', marginBottom: '40px' }} />
                <div className="panel-skeleton" style={{ height: '500px' }} />
            </div>
        );
    }

    const tasksList = tasks || [];

    const todayStr = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const filteredTasks = tasksList.filter(t => {
        // Hide cancelled tasks by default
        if (t.status === 'cancelled' || t.cancelled_at) return false;
        // Section filter
        if (sectionFilter !== 'all') {
            if (t.status === 'done') return false;
            if (sectionFilter === 'pendentes') {
                // Show only today's tasks + overdue tasks (not done)
                if (!t.deadline) return false;
                const deadlineStr = t.deadline.startsWith(todayStr);
                const isOverdue = !deadlineStr && new Date(t.deadline) < todayStart;
                if (!deadlineStr && !isOverdue) return false;
            }
            if (sectionFilter === 'today') {
                if (!t.deadline?.startsWith(todayStr)) return false;
            }
            if (sectionFilter === 'doing') {
                const phaseName = phases?.find(p => p.id === t.phase_id)?.name;
                if (phaseName !== 'Em Andamento' && t.status !== 'doing') return false;
            }
            if (sectionFilter === 'overdue') {
                if (!t.deadline) return false;
                if (new Date(t.deadline) >= todayStart) return false;
            }
        }
        // Date range filter
        const deadlineDate = t.deadline?.split('T')[0];
        if (dateFrom && deadlineDate && deadlineDate < dateFrom) return false;
        if (dateTo && deadlineDate && deadlineDate > dateTo) return false;
        // Phase filter
        if (phaseFilter !== 'all' && t.phase_id !== phaseFilter) return false;
        return true;
    });

    return (
        <div className="tasks-page" style={{ animation: 'panelFadeIn 0.4s ease-out', position: 'relative' }}>
            <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Gestão de Tarefas' }]} />

            <div className="panel-content__header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1>Gestão de Tarefas</h1>
                    <p style={{ marginBottom: '8px' }}>Controle operacional e prazos por empresa.</p>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--ds-text)' }}>
                            {tasksList.filter(t => t.status !== 'done' && t.status !== 'cancelled' && !t.cancelled_at).length}
                        </span> tarefas abertas
                        <span style={{ opacity: 0.3 }}>|</span>
                        <span style={{ fontWeight: 700, color: 'var(--ds-primary)' }}>
                            {tasksList.filter(t => {
                                if (t.status === 'done' || t.status === 'cancelled' || t.cancelled_at) return false;
                                return !t.deadline || new Date(t.deadline) < new Date();
                            }).length}
                        </span> em atraso
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {view === 'kanban' && (
                        <button 
                            className="ds-btn ds-btn-ghost" 
                            onClick={() => setShowPhaseManager(true)}
                            style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}
                        >
                            <Settings size={16} /> Fases
                        </button>
                    )}
                    {view === 'kanban' && (
                        <button 
                            className="ds-btn ds-btn-ghost" 
                            onClick={() => setShowMacroCalendar(!showMacroCalendar)}
                            style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: showMacroCalendar ? 'var(--ds-primary)' : 'var(--ds-text-muted)' }}
                        >
                            <Eye size={16} /> {showMacroCalendar ? 'Ocultar Calendário' : 'Visão Macro'}
                        </button>
                    )}
                    <button 
                        className="ds-btn ds-btn-ghost" 
                        onClick={handleSyncCalendar}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--ds-text-muted)' }}
                        title="Sincronizar tarefas ativas com Google Agenda"
                    >
                        <CalendarIcon size={16} /> Sincronizar
                    </button>
                    <button 
                        className="ds-btn ds-btn-ghost" 
                        onClick={handleRunScheduler}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--ds-text-muted)' }}
                        title="Executar rotinas — gerar tarefas pendentes com base na recorrência"
                    >
                        <RefreshCw size={16} /> Executar Rotinas
                    </button>
                    <div className="view-toggle" style={{ 
                        display: 'flex', background: 'var(--ds-surface-2)', padding: '4px', 
                        borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <button onClick={() => setView('kanban')} className={`vt-btn ${view === 'kanban' ? 'active' : ''}`}>
                            <LayoutGrid size={16} /> Kanban
                        </button>
                        <button onClick={() => setView('timeline')} className={`vt-btn ${view === 'timeline' ? 'active' : ''}`}>
                            <Clock size={16} /> Timeline
                        </button>
                        <button onClick={() => setView('calendar')} className={`vt-btn ${view === 'calendar' ? 'active' : ''}`}>
                            <CalendarIcon size={16} /> Calendário
                        </button>
                    </div>
                    <button className="ds-btn ds-btn-primary" onClick={handleOpenNewTask}>
                        <Plus size={18} /> Nova Tarefa
                    </button>
                </div>
            </div>

            {/* Section filter tabs */}
            {view === 'kanban' && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: 'var(--ds-surface-2)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content' }}>
                    {([
                        { key: 'pendentes', label: 'Pendentes', icon: null },
                        { key: 'all', label: 'Todas', icon: null },
                        { key: 'today', label: 'Hoje', icon: null },
                        { key: 'doing', label: 'Em andamento', icon: null },
                        { key: 'overdue', label: 'Atrasadas', icon: null },
                    ] as const).map(s => (
                        <button
                            key={s.key}
                            onClick={() => setSectionFilter(s.key)}
                            className={`vt-btn ${sectionFilter === s.key ? 'active' : ''}`}
                            style={{
                                fontSize: '12px',
                                position: 'relative',
                            }}
                        >
                            {s.label}
                            {s.key !== 'all' && s.key !== 'pendentes' && (
                                <span style={{
                                    marginLeft: '6px', fontSize: '10px', fontWeight: 700,
                                    background: 'rgba(255,255,255,0.08)', padding: '0 6px',
                                    borderRadius: '10px',
                                }}>
                                    {s.key === 'today' && tasksList.filter(t => {
                                        if (t.status === 'done' || t.status === 'cancelled' || t.cancelled_at) return false;
                                        if (!t.deadline) return false;
                                        const today = new Date().toISOString().split('T')[0];
                                        return t.deadline.startsWith(today);
                                    }).length}
                                    {s.key === 'doing' && tasksList.filter(t => {
                                        if (t.status === 'cancelled' || t.cancelled_at) return false;
                                        const phaseName = phases?.find(p => p.id === t.phase_id)?.name;
                                        return phaseName === 'Em Andamento' || t.status === 'doing';
                                    }).length}
                                    {s.key === 'overdue' && tasksList.filter(t => {
                                        if (t.status === 'done' || t.status === 'cancelled' || t.cancelled_at) return false;
                                        if (!t.deadline) return false;
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        return new Date(t.deadline) < today;
                                    }).length}
                                </span>
                            )}
                            {s.key === 'pendentes' && (
                                <span style={{
                                    marginLeft: '6px', fontSize: '10px', fontWeight: 700,
                                    background: 'rgba(255,255,255,0.08)', padding: '0 6px',
                                    borderRadius: '10px', color: 'var(--ds-primary)',
                                }}>
                                    {tasksList.filter(t => {
                                        if (t.status === 'done' || t.status === 'cancelled' || t.cancelled_at) return false;
                                        if (!t.deadline) return false;
                                        const today = new Date().toISOString().split('T')[0];
                                        const deadline = new Date(t.deadline);
                                        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                                        return t.deadline.startsWith(today) || deadline < todayStart;
                                    }).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
            
            {/* Date range, phase filter, and period presets */}
            {view === 'kanban' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Period presets */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {(['Hoje', 'Semana', 'Mês'] as const).map(preset => {
                            const isActive =
                                (preset === 'Hoje' && dateFrom === todayStr && dateTo === todayStr) ||
                                (preset === 'Semana' && (() => {
                                    const mon = new Date(); mon.setDate(mon.getDate() - mon.getDay() + 1);
                                    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
                                    return dateFrom === mon.toISOString().split('T')[0] && dateTo === sun.toISOString().split('T')[0];
                                })()) ||
                                (preset === 'Mês' && (() => {
                                    const now = new Date();
                                    const first = new Date(now.getFullYear(), now.getMonth(), 1);
                                    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                                    return dateFrom === first.toISOString().split('T')[0] && dateTo === last.toISOString().split('T')[0];
                                })());
                            return (
                                <button
                                    key={preset}
                                    onClick={() => {
                                        const now = new Date();
                                        if (preset === 'Hoje') {
                                            setDateFrom(todayStr);
                                            setDateTo(todayStr);
                                        } else if (preset === 'Semana') {
                                            const mon = new Date(now); mon.setDate(mon.getDate() - mon.getDay() + 1);
                                            const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
                                            setDateFrom(mon.toISOString().split('T')[0]);
                                            setDateTo(sun.toISOString().split('T')[0]);
                                        } else {
                                            const first = new Date(now.getFullYear(), now.getMonth(), 1);
                                            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                                            setDateFrom(first.toISOString().split('T')[0]);
                                            setDateTo(last.toISOString().split('T')[0]);
                                        }
                                    }}
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        fontFamily: 'inherit',
                                        background: isActive ? 'var(--ds-primary)' : 'var(--ds-surface-2)',
                                        color: isActive ? 'var(--ds-primary-text)' : 'var(--ds-text-muted)',
                                        border: isActive ? '1px solid var(--ds-primary)' : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {preset}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)' }} />

                    {/* Date from */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>De</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="filter-date-input"
                        />
                    </div>
                    {/* Date to */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Até</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="filter-date-input"
                        />
                    </div>

                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)' }} />

                    {/* Phase filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fase</label>
                        <select
                            value={phaseFilter}
                            onChange={e => setPhaseFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">Todas</option>
                            {(phases || []).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Clear filters */}
                    {(dateFrom || dateTo || phaseFilter !== 'all') && (
                        <button
                            onClick={() => { setDateFrom(''); setDateTo(''); setPhaseFilter('all'); }}
                            style={{
                                fontSize: '10px', color: 'var(--ds-primary)', background: 'none',
                                border: 'none', cursor: 'pointer', fontWeight: 700,
                                fontFamily: 'inherit', textDecoration: 'underline',
                                textUnderlineOffset: '2px',
                            }}
                        >
                            Limpar
                        </button>
                    )}
                </div>
            )}

            <div className="tasks-content" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {view === 'kanban' ? (
                        filteredTasks.length === 0 ? (
                            <div className="panel-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ds-text-muted)', marginBottom: '16px', opacity: 0.3 }}>
                                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                                </svg>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--ds-text)' }}>
                                    {sectionFilter !== 'all' ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa criada'}
                                </h3>
                                <p style={{ color: 'var(--ds-text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                                    {sectionFilter !== 'all' ? 'Tente alterar o filtro ou criar uma nova tarefa.' : 'Comece organizando suas tarefas operacionais por empresa e fase.'}
                                </p>
                                <button className="ds-btn ds-btn-primary" onClick={handleOpenNewTask}>
                                    <Plus size={18} /> Criar Primeira Tarefa
                                </button>
                            </div>
                        ) : (
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <TaskKanban tasks={filteredTasks} phases={phases || []} clients={clients || []} onEdit={handleEditTask} getTaskStatus={getTaskStatus} onFinalize={(id) => {
                                    if (phases && phases.length > 0) {
                                        updateTaskStatus.mutate({ id, phase_id: doneColumnId, status: 'done' });
                                    } else {
                                        updateTaskStatus.mutate({ id, status: 'done' });
                                    }
                                }} onCancel={(id) => cancelTask.mutate(id)} />
                            </DragDropContext>
                        )
                    ) : view === 'timeline' ? (
                        <div className="panel-card" style={{ padding: '24px' }}>
                            <TaskTimeline 
                                timeline={timelineData?.timeline || []} 
                                conflicts={conflictsData?.conflicts || []}
                                clients={clients || []} 
                                isLoading={timelineLoading}
                                onEdit={handleEditTask} 
                            />
                        </div>
                    ) : (
                        <div className="panel-card" style={{ padding: '24px' }}>
                            <TaskCalendar tasks={tasksList} clients={clients || []} onEdit={handleEditTask} isMacro={false} />
                        </div>
                    )}
                </div>
                
                {view === 'kanban' && showMacroCalendar && (
                    <div className="macro-calendar-overlay ds-card" style={{ 
                        width: '320px', padding: '20px', position: 'sticky', top: '20px', height: 'fit-content',
                        animation: 'slideInRight 0.3s ease-out', border: '1px solid var(--ds-primary-low)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Visão Mensal</h3>
                            <button onClick={() => setShowMacroCalendar(false)} style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}>
                                <X size={14} />
                                </button>
                            </div>
                            <TaskCalendar tasks={tasksList} clients={clients || []} onEdit={handleEditTask} isMacro={true} />
                        </div>
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

            <style dangerouslySetInnerHTML={{ __html: `
                .vt-btn {
                    display: flex; alignItems: center; gap: 8px; 
                    padding: 6px 12px; borderRadius: var(--radius-sm);
                    background: transparent; color: var(--ds-text-muted);
                    border: none; cursor: pointer; fontSize: 13px; fontWeight: 600;
                    transition: all 0.2s;
                }
                .vt-btn.active {
                    background: var(--ds-surface); color: var(--ds-primary);
                }
                .task-card {
                    user-select: none;
                    transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease;
                }
                .task-card:hover {
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                }
                .task-card--overdue {
                    box-shadow: 0 0 0 2px var(--ds-error), 0 4px 16px rgba(239, 68, 68, 0.15);
                }
                .task-card--overdue:hover {
                    box-shadow: 0 0 0 2px var(--ds-error), 0 8px 24px rgba(239, 68, 68, 0.25);
                }
                .overdue-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--ds-error);
                    background: rgba(239, 68, 68, 0.12);
                    padding: 2px 8px;
                    border-radius: 12px;
                }
                .kanban-column {
                    background: rgba(255,255,255,0.012);
                    border: 1px solid rgba(255,255,255,0.03);
                    border-radius: var(--radius-lg);
                    padding: 16px;
                    min-height: calc(100vh - 250px);
                    transition: background 0.2s;
                    display: flex; flex-direction: column;
                }
                .kanban-column--dragging-over {
                    background: rgba(255,255,255,0.04);
                }
                .kanban-grid {
                    display: grid;
                    grid-template-columns: repeat(var(--kanban-cols), 1fr);
                    gap: 24px;
                    align-items: start;
                }
                @media (max-width: 1200px) {
                    .kanban-grid {
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    }
                }
                @media (max-width: 768px) {
                    .kanban-grid {
                        grid-template-columns: 1fr;
                        overflow-x: auto;
                    }
                }
                .filter-date-input {
                    background: var(--ds-surface-2);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm);
                    padding: 4px 8px;
                    color: var(--ds-text);
                    font-size: 12px;
                    font-family: inherit;
                    outline: none;
                    transition: border-color 0.15s ease;
                    color-scheme: dark;
                }
                .filter-date-input:focus {
                    border-color: var(--ds-primary);
                }
                .filter-select {
                    background: var(--ds-surface-2);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--radius-sm);
                    padding: 4px 8px;
                    color: var(--ds-text);
                    font-size: 12px;
                    font-family: inherit;
                    outline: none;
                    cursor: pointer;
                    transition: border-color 0.15s ease;
                }
                .filter-select:focus {
                    border-color: var(--ds-primary);
                }
                .filter-select option {
                    background: var(--ds-surface);
                    color: var(--ds-text);
                }
                @keyframes slideInRight {
                    from { transform: translateX(20px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}} />
        </div>
    );
};

const TaskKanban: React.FC<{ tasks: TaskResponse[], phases: TaskPhaseResponse[], clients: any[], onEdit: (t: TaskResponse) => void, getTaskStatus: (t: TaskResponse) => string, onFinalize?: (id: string) => void, onCancel?: (id: string) => void }> = ({ tasks, phases, clients, onEdit, getTaskStatus, onFinalize, onCancel }) => {
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
            // 1. Overdue tasks first
            const aOver = isTaskOverdue(a);
            const bOver = isTaskOverdue(b);
            if (aOver !== bOver) return aOver ? -1 : 1;

            // 2. High priority next
            const aPrio = priorityOrder[a.priority] ?? 1;
            const bPrio = priorityOrder[b.priority] ?? 1;
            if (aPrio !== bPrio) return aPrio - bPrio;

            // 3. Sort by deadline (ascending)
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
                            className={`kanban-column ${snapshot.isDraggingOver ? 'kanban-column--dragging-over' : ''}`}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                                    {col.title}
                                </h3>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ds-text-muted)', background: 'var(--ds-surface-2)', padding: '2px 8px', borderRadius: '12px' }}>
                                    {tasks.filter(t => getTaskStatus(t) === col.id).length}
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                {sortTasksByUrgency(tasks.filter(t => getTaskStatus(t) === col.id)).map((task, index) => {
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
                                                    style={provided.draggableProps.style}
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

const TaskCalendar: React.FC<{ tasks: TaskResponse[], clients: any[], onEdit: (t: TaskResponse) => void, isMacro?: boolean }> = ({ tasks, clients, onEdit, isMacro }) => {
    const today = new Date();
    const currMonth = today.getMonth();
    const currYear = today.getFullYear();
    const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
    const firstDay = new Date(currYear, currMonth, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const getClient = (id: string) => clients.find(c => c.id === id);

    return (
        <div className={isMacro ? 'macro-calendar' : ''}>
            {!isMacro && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ds-text)', textTransform: 'capitalize' }}>
                        {today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
            )}
            <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', 
                background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', overflow: 'hidden' 
            }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, idx) => (
                    <div key={`header-${idx}`} style={{ 
                        padding: isMacro ? '4px' : '12px', textAlign: 'center', fontSize: '9px', fontWeight: 800, 
                        color: 'var(--ds-text-muted)', background: 'var(--ds-surface-2)', textTransform: 'uppercase' 
                    }}>
                        {d}
                    </div>
                ))}
                {blanks.map(i => <div key={`b-${i}`} style={{ minHeight: isMacro ? '40px' : '110px', background: 'transparent' }} />)}
                {days.map(day => {
                    const dateStr = new Date(currYear, currMonth, day).toISOString().split('T')[0];
                    const dayTasks = tasks.filter(t => t.deadline && t.deadline.startsWith(dateStr));
                    const isToday = day === today.getDate();
                    
                    return (
                        <div key={`day-${day}`} style={{ 
                            minHeight: isMacro ? '40px' : '110px', background: 'transparent', padding: isMacro ? '2px' : '8px', 
                            border: '1px solid rgba(255,255,255,0.02)',
                            display: 'flex', flexDirection: 'column', gap: '2px'
                        }}>
                            <div style={{ 
                                fontSize: isMacro ? '10px' : '12px', fontWeight: 800, 
                                color: isToday ? 'var(--ds-primary)' : 'var(--ds-text-muted)', 
                                textAlign: 'right', marginBottom: '2px' 
                            }}>
                                {day}
                            </div>
                            {dayTasks.map(task => {
                                const client = getClient(task.client_id);
                                return (
                                    <div 
                                        key={task.id} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(task);
                                        }}
                                        title={`${client?.name}: ${task.title}`}
                                        style={{ 
                                            fontSize: isMacro ? '0' : '10px', 
                                            padding: isMacro ? '0' : '3px 6px', borderRadius: '2px', 
                                            background: client?.color || 'var(--ds-primary)',
                                            color: '#000', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            cursor: 'pointer', height: isMacro ? '6px' : 'auto',
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            borderLeft: isMacro ? 'none' : `3px solid ${task.priority === 'high' ? 'rgba(0,0,0,0.5)' : 'transparent'}`
                                        }}
                                    >
                                        {!isMacro && (
                                            <div style={{ 
                                                width: '6px', height: '6px', borderRadius: '50%', 
                                                background: task.priority === 'high' ? 'var(--ds-error)' : task.priority === 'medium' ? 'var(--ds-warning)' : 'var(--ds-success)',
                                                flexShrink: 0
                                            }} />
                                        )}
                                        {!isMacro && task.status === 'doing' && (
                                            <span style={{ fontSize: '7px', fontWeight: 800, background: '#3b82f6', color: '#fff', padding: '1px 3px', borderRadius: '2px', lineHeight: '1' }}>
                                                EM AND
                                            </span>
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

const TaskTimeline: React.FC<{ 
    timeline: { date: string; tasks: TimelineTaskItem[]; total_hours: number }[]; 
    conflicts: { date: string; tasks: ConflictTaskItem[]; total_hours: number }[];
    clients: any[]; 
    isLoading: boolean;
    onEdit: (t: TaskResponse) => void 
}> = ({ timeline, conflicts, clients, isLoading, onEdit }) => {
    const getClient = (id: string) => clients.find(c => c.id === id);
    const conflictDates = new Set(conflicts.map(c => c.date));

    if (isLoading) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ds-text-muted)' }}>Carregando timeline...</div>;
    if (timeline.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ds-text-muted)' }}>Nenhuma tarefa com prazo encontrada.</div>;

    const maxHours = Math.max(...timeline.map(d => d.total_hours), 8);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Timeline de Tarefas</h2>
                {conflicts.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ds-warning)', background: 'rgba(245,158,11,0.1)', padding: '6px 12px', borderRadius: '8px' }}>
                        <AlertTriangle size={14} /> {conflicts.length} conflito(s) de sobrecarga detectado(s)
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {timeline.map(day => (
                    <div key={day.date} style={{ 
                        padding: '16px', 
                        background: conflictDates.has(day.date) ? 'rgba(245,158,11,0.05)' : 'var(--ds-surface-2)',
                        border: `1px solid ${conflictDates.has(day.date) ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: 'var(--radius-lg)',
                        opacity: new Date(day.date + 'T00:00:00') < new Date(new Date().toISOString().split('T')[0]) ? 0.6 : 1
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text)' }}>
                                {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        width: `${Math.min((day.total_hours / maxHours) * 100, 100)}%`, 
                                        height: '100%', 
                                        background: day.total_hours > 8 ? 'var(--ds-error)' : 'var(--ds-primary)',
                                        borderRadius: '3px'
                                    }} />
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: day.total_hours > 8 ? 'var(--ds-error)' : 'var(--ds-text-muted)' }}>
                                    {day.total_hours.toFixed(1)}h
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {day.tasks.map(task => {
                                const client = getClient(task.client_id);
                                return (
                                    <div 
                                        key={task.id}
                                        onClick={() => onEdit(task as TaskResponse)}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '6px 10px', borderRadius: '6px',
                                            background: (client?.color || 'var(--ds-primary)') + '22',
                                            borderLeft: `3px solid ${client?.color || 'var(--ds-primary)'}`,
                                            cursor: 'pointer', fontSize: '12px', color: 'var(--ds-text)',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: client?.color || 'var(--ds-text-muted)', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                            {client?.name || 'Cliente'}
                                        </span>
                                        <span style={{ fontWeight: 600 }}>{task.title}</span>
                                        {task.status === 'doing' && (
                                            <span style={{ fontSize: '9px', fontWeight: 700, background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px', lineHeight: '1' }}>
                                                Em andamento
                                            </span>
                                        )}
                                        {task.time_estimate_hours && (
                                            <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)', fontWeight: 700 }}>{task.time_estimate_hours}h</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};