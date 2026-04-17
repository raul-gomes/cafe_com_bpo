import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LayoutGrid, Calendar as CalendarIcon, CheckCircle2, Clock, AlertCircle, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { TaskResponse } from '../../schemas/tasks';
import { TaskModal } from '../../components/tasks/TaskModal';

export const TasksPage: React.FC = () => {
    const [view, setView] = useState<'kanban' | 'calendar'>('kanban');
    const [showMacroCalendar, setShowMacroCalendar] = useState(false);
    const { useTasksList, useUpdateTaskStatus } = useTasks();
    const { data: tasks, isLoading } = useTasksList();
    const updateTaskStatus = useUpdateTaskStatus();
    
    const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);
    const [isModalOpen, setModalOpen] = useState(false);

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
        
        updateTaskStatus.mutate({ id: draggableId, status: destination.droppableId });
    };

    const handleOpenNew = () => {
        setSelectedTask(null);
        setModalOpen(true);
    };

    const handleEdit = (task: TaskResponse) => {
        setSelectedTask(task);
        setModalOpen(true);
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
            {/* Breadcrumb Navigation */}
            <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
                <Link to="/painel" style={{ color: 'var(--ds-text-muted)', textDecoration: 'none' }}>Painel</Link>
                <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
                <span style={{ color: 'var(--ds-primary)' }}>Gestão de Tarefas</span>
            </div>

            <div className="panel-content__header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1>Gestão de Tarefas</h1>
                    <p>Controle operacional e prazos por empresa.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                        <button onClick={() => setView('calendar')} className={`vt-btn ${view === 'calendar' ? 'active' : ''}`}>
                            <CalendarIcon size={16} /> Calendário
                        </button>
                    </div>
                    <button className="ds-btn ds-btn-primary" onClick={handleOpenNew}>
                        <Plus size={18} /> Nova Tarefa
                    </button>
                </div>
            </div>

            <div className="tasks-content" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {view === 'kanban' ? (
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <TaskKanban tasks={tasksList} clients={clients || []} onEdit={handleEdit} />
                        </DragDropContext>
                    ) : (
                        <div className="panel-card" style={{ padding: '24px' }}>
                            <TaskCalendar tasks={tasksList} clients={clients || []} onEdit={handleEdit} isMacro={false} />
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
                        <TaskCalendar tasks={tasksList} clients={clients || []} onEdit={handleEdit} isMacro={true} />
                    </div>
                )}
            </div>

            <TaskModal 
                isOpen={isModalOpen} 
                onClose={() => setModalOpen(false)} 
                task={selectedTask}
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

const TaskKanban: React.FC<{ tasks: TaskResponse[], clients: any[], onEdit: (t: TaskResponse) => void }> = ({ tasks, clients, onEdit }) => {
    const columns = [
        { id: 'todo', title: 'A Fazer', icon: <AlertCircle size={14} color="var(--ds-error)" /> },
        { id: 'doing', title: 'Em Andamento', icon: <Clock size={14} color="var(--ds-warning)" /> },
        { id: 'done', title: 'Concluído', icon: <CheckCircle2 size={14} color="var(--ds-success)" /> }
    ];

    const getClient = (id: string) => clients.find(c => c.id === id);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', alignItems: 'start' }}>
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
                                    {col.icon} {col.title}
                                </h3>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ds-text-muted)', background: 'var(--ds-surface-2)', padding: '2px 8px', borderRadius: '12px' }}>
                                    {tasks.filter(t => t.status === col.id).length}
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                {tasks.filter(t => t.status === col.id).map((task, index) => {
                                    const client = getClient(task.client_id);
                                    return (
                                        <Draggable key={task.id} draggableId={task.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div 
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className="task-card ds-card" 
                                                    onClick={() => onEdit(task)}
                                                    style={{ 
                                                        ...provided.draggableProps.style,
                                                        padding: '16px', 
                                                        borderLeft: `4px solid ${client?.color || 'var(--ds-primary)'}`,
                                                        cursor: 'pointer',
                                                        backgroundColor: snapshot.isDragging ? 'var(--ds-surface-3)' : 'var(--ds-surface-2)',
                                                        zIndex: snapshot.isDragging ? 999 : 1,
                                                        transform: snapshot.isDragging 
                                                            ? `${provided.draggableProps.style?.transform || ''} rotate(2deg) scale(1.02)` 
                                                            : provided.draggableProps.style?.transform
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ fontSize: '10px', fontWeight: 900, color: client?.color || 'var(--ds-primary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            {client?.name || 'Cliente'}
                                                        </div>
                                                        <div style={{ 
                                                            width: '6px', height: '6px', borderRadius: '50%',
                                                            background: task.priority === 'high' ? 'var(--ds-error)' : task.priority === 'medium' ? 'var(--ds-warning)' : 'var(--ds-success)'
                                                        }} />
                                                    </div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: 1.4, color: 'var(--ds-text)', marginBottom: '12px' }}>{task.title}</div>
                                                    
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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
