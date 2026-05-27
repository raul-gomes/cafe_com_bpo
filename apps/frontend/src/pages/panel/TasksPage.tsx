import React, { useState } from 'react';
import { Plus, LayoutGrid, Calendar as CalendarIcon, Eye, X, Settings, Clock, AlertTriangle } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { TaskResponse, TaskPhaseResponse } from '../../schemas/tasks';
import { TaskModal } from '../../components/tasks/TaskModal';
import { PhaseManager } from '../../components/tasks/PhaseManager';
import { Breadcrumb } from '../../components/ui/Breadcrumb';

type TimelineTaskItem = { id: string; title: string; client_id: string; deadline?: string; time_estimate_hours?: number; priority: string; process_type?: string; status: string };
type ConflictTaskItem = { id: string; title: string; time_estimate_hours?: number; deadline?: string };

export const TasksPage: React.FC = () => {
    const [view, setView] = useState<'kanban' | 'calendar' | 'timeline'>('kanban');
    const [showMacroCalendar, setShowMacroCalendar] = useState(false);
    const [showPhaseManager, setShowPhaseManager] = useState(false);
    const { useTasksList, useUpdateTaskStatus, usePhases, useTimeline, useConflicts } = useTasks();
    const { data: tasks, isLoading } = useTasksList();
    const { data: phases } = usePhases();
    const updateTaskStatus = useUpdateTaskStatus();
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
        if (task.phase_id && phases) {
            return task.phase_id;
        }
        return task.status;
    };

    const handleOpenNewTask = () => {
        setSelectedTask(null);
        setTaskModalOpen(true);
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

    return (
        <div className="tasks-page" style={{ animation: 'panelFadeIn 0.4s ease-out', position: 'relative' }}>
            <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Gestão de Tarefas' }]} />

            <div className="panel-content__header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1>Gestão de Tarefas</h1>
                    <p style={{ marginBottom: '8px' }}>Controle operacional e prazos por empresa.</p>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--ds-text)' }}>
                            {tasksList.filter(t => t.status !== 'done').length}
                        </span> tarefas abertas
                        <span style={{ opacity: 0.3 }}>|</span>
                        <span style={{ fontWeight: 700, color: 'var(--ds-primary)' }}>
                            {tasksList.filter(t => {
                                if (t.status === 'done') return false;
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

            <div className="tasks-content" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {view === 'kanban' ? (
                        tasksList.length === 0 ? (
                            <div className="panel-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ds-text-muted)', marginBottom: '16px', opacity: 0.3 }}>
                                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                                </svg>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--ds-text)' }}>Nenhuma tarefa criada</h3>
                                <p style={{ color: 'var(--ds-text-muted)', fontSize: '14px', marginBottom: '20px' }}>Comece organizando suas tarefas operacionais por empresa e fase.</p>
                                <button className="ds-btn ds-btn-primary" onClick={handleOpenNewTask}>
                                    <Plus size={18} /> Criar Primeira Tarefa
                                </button>
                            </div>
                        ) : (
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <TaskKanban tasks={tasksList} phases={phases || []} clients={clients || []} onEdit={handleEditTask} getTaskStatus={getTaskStatus} />
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
                @keyframes slideInRight {
                    from { transform: translateX(20px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}} />
        </div>
    );
};

const TaskKanban: React.FC<{ tasks: TaskResponse[], phases: TaskPhaseResponse[], clients: any[], onEdit: (t: TaskResponse) => void, getTaskStatus: (t: TaskResponse) => string }> = ({ tasks, phases, clients, onEdit, getTaskStatus }) => {
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

    const getClient = (id: string) => clients.find(c => c.id === id);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: '24px', alignItems: 'start' }}>
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
                                {tasks.filter(t => getTaskStatus(t) === col.id).map((task, index) => {
                                    const client = getClient(task.client_id);
                                    return (
                                        <Draggable key={task.id} draggableId={task.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div 
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`task-card ds-card ${isTaskOverdue(task) ? 'task-card--overdue' : ''}`}
                                                    onClick={() => onEdit(task)}
                                                    style={{ 
                                                        ...provided.draggableProps.style,
                                                        padding: '16px', 
                                                        borderLeft: `4px solid ${client?.color || col.color}`,
                                                        cursor: 'pointer',
                                                        backgroundColor: snapshot.isDragging ? 'var(--ds-surface-3)' : 'var(--ds-surface-2)',
                                                        zIndex: snapshot.isDragging ? 999 : 1,
                                                        transform: snapshot.isDragging 
                                                            ? `${provided.draggableProps.style?.transform || ''} rotate(2deg) scale(1.02)` 
                                                            : provided.draggableProps.style?.transform
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ fontSize: '10px', fontWeight: 900, color: client?.color || col.color, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            {client?.name || 'Cliente'}
                                                        </div>
                                                        <div style={{ 
                                                            width: '6px', height: '6px', borderRadius: '50%',
                                                            background: task.priority === 'high' ? 'var(--ds-error)' : task.priority === 'medium' ? 'var(--ds-warning)' : 'var(--ds-success)'
                                                        }} />
                                                    </div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: 1.4, color: 'var(--ds-text)', marginBottom: '12px' }}>{task.title}</div>
                                                    
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            {isTaskOverdue(task) && (
                                                                <span className="overdue-badge">
                                                                    <AlertTriangle size={10} /> Atrasado {getOverdueDays(task)}d
                                                                </span>
                                                            )}
                                                        </div>
                                                        {task.deadline && (
                                                            <div style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <CalendarIcon size={12} /> {new Date(task.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
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
                                        <span style={{ fontWeight: 600 }}>{task.title}</span>
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