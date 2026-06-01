import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TaskCard } from '../src/components/tasks/TaskCard'
import { TaskResponse } from '../src/schemas/tasks'

const baseTask: TaskResponse = {
  id: 'task-1',
  user_id: 'u1',
  client_id: 'c1',
  title: 'Test Task',
  status: 'todo',
  priority: 'high',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockClient = { id: 'c1', name: 'ACME Corp', color: '#3b82f6' }

const defaultProps = {
  task: baseTask,
  client: mockClient,
  colColor: '#6b7280',
  doneColumnId: 'done',
  onEdit: vi.fn(),
  onFinalize: vi.fn(),
  onCancel: vi.fn(),
  getTaskStatus: (t: TaskResponse) => t.status,
  isTaskOverdue: () => false,
  getOverdueDays: () => 0,
}

describe('TaskCard', () => {
  it('renders client name', () => {
    render(<TaskCard {...defaultProps} />)
    expect(screen.getByText('ACME Corp')).toBeInTheDocument()
  })

  it('renders task title', () => {
    render(<TaskCard {...defaultProps} />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('renders fallback text when client is undefined', () => {
    render(<TaskCard {...defaultProps} client={undefined} />)
    expect(screen.getByText('Cliente')).toBeInTheDocument()
  })

  it('renders finalize button when status !== doneColumnId', () => {
    render(<TaskCard {...defaultProps} />)
    expect(screen.getByTitle('Mover para Concluído')).toBeInTheDocument()
  })

  it('does NOT render finalize button when status === doneColumnId', () => {
    const doneTask = { ...baseTask, status: 'done' }
    render(
      <TaskCard
        {...defaultProps}
        task={doneTask}
        getTaskStatus={() => 'done'}
      />
    )
    expect(screen.queryByTitle('Mover para Concluído')).not.toBeInTheDocument()
  })

  it('does NOT render finalize button when onFinalize is undefined', () => {
    render(<TaskCard {...defaultProps} onFinalize={undefined} />)
    expect(screen.queryByTitle('Mover para Concluído')).not.toBeInTheDocument()
  })

  it('renders cancel button when conditions met', () => {
    render(<TaskCard {...defaultProps} />)
    expect(screen.getByTitle('Cancelar tarefa')).toBeInTheDocument()
  })

  it('does NOT render cancel button when task is cancelled', () => {
    const cancelledTask = { ...baseTask, status: 'cancelled' }
    render(<TaskCard {...defaultProps} task={cancelledTask} />)
    expect(screen.queryByTitle('Cancelar tarefa')).not.toBeInTheDocument()
  })

  it('does NOT render cancel button when task has cancelled_at', () => {
    const cancelledTask = { ...baseTask, cancelled_at: '2026-01-02T00:00:00Z' }
    render(<TaskCard {...defaultProps} task={cancelledTask} />)
    expect(screen.queryByTitle('Cancelar tarefa')).not.toBeInTheDocument()
  })

  it('does NOT render cancel button when status === doneColumnId', () => {
    const doneTask = { ...baseTask, status: 'done' }
    render(
      <TaskCard
        {...defaultProps}
        task={doneTask}
        getTaskStatus={() => 'done'}
      />
    )
    expect(screen.queryByTitle('Cancelar tarefa')).not.toBeInTheDocument()
  })

  it('shows overdue badge when isTaskOverdue returns true', () => {
    render(
      <TaskCard
        {...defaultProps}
        isTaskOverdue={() => true}
        getOverdueDays={() => 3}
      />
    )
    expect(screen.getByText(/Atrasado/)).toBeInTheDocument()
    expect(screen.getByText(/3d/)).toBeInTheDocument()
  })

  it('does not show overdue badge when task is not overdue', () => {
    render(<TaskCard {...defaultProps} />)
    expect(screen.queryByText(/Atrasado/)).not.toBeInTheDocument()
  })

  it('shows deadline when task.deadline is set', () => {
    const taskWithDeadline = { ...baseTask, deadline: '2026-06-15T12:00:00Z' }
    render(<TaskCard {...defaultProps} task={taskWithDeadline} />)
    // Check that deadline is rendered inside a flex container with calendar icon
    const deadlineEl = screen.getByText(/15/)
    expect(deadlineEl).toBeInTheDocument()
  })

  it('does not show deadline when task.deadline is undefined', () => {
    render(<TaskCard {...defaultProps} />)
    // The creation metadata line contains "Criada em" but not a deadline
    const deadlineContainers = screen.queryAllByText(/\d{2}\/\d{2}/)
    // Only the creation date should match (not a deadline)
    expect(deadlineContainers.length).toBe(1)
  })

  it('shows creation date', () => {
    render(<TaskCard {...defaultProps} />)
    expect(screen.getByText(/Criada em/)).toBeInTheDocument()
  })

  it('shows finalization date when status === doneColumnId', () => {
    const doneTask = { ...baseTask, status: 'done', updated_at: '2026-06-10T12:00:00Z' }
    render(
      <TaskCard
        {...defaultProps}
        task={doneTask}
        getTaskStatus={() => 'done'}
      />
    )
    expect(screen.getByText(/Finalizada em/)).toBeInTheDocument()
  })

  it('calls onEdit when card is clicked', () => {
    const onEdit = vi.fn()
    render(<TaskCard {...defaultProps} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('Test Task').closest('.task-card')!)
    expect(onEdit).toHaveBeenCalledWith(baseTask)
  })

  it('calls onFinalize when finalize button is clicked', () => {
    const onFinalize = vi.fn()
    render(<TaskCard {...defaultProps} onFinalize={onFinalize} />)
    fireEvent.click(screen.getByTitle('Mover para Concluído'))
    expect(onFinalize).toHaveBeenCalledWith('task-1')
  })

  it('calls onCancel when cancel button is confirmed', () => {
    const onCancel = vi.fn()
    vi.spyOn(window, 'confirm').mockImplementation(() => true)
    render(<TaskCard {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTitle('Cancelar tarefa'))
    expect(onCancel).toHaveBeenCalledWith('task-1')
  })

  it('does NOT call onCancel when confirm is dismissed', () => {
    const onCancel = vi.fn()
    vi.spyOn(window, 'confirm').mockImplementation(() => false)
    render(<TaskCard {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTitle('Cancelar tarefa'))
    expect(onCancel).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('does not call onEdit when finalize button is clicked (stopPropagation)', () => {
    const onEdit = vi.fn()
    const onFinalize = vi.fn()
    render(<TaskCard {...defaultProps} onEdit={onEdit} onFinalize={onFinalize} />)
    fireEvent.click(screen.getByTitle('Mover para Concluído'))
    expect(onEdit).not.toHaveBeenCalled()
    expect(onFinalize).toHaveBeenCalled()
  })

  // ── Sprint 3 Section 3: template_name badge ──

  it('renders template_name badge when task has template_name', () => {
    const taskWithTemplate = { ...baseTask, template_name: 'Fiscal Mensal' }
    render(<TaskCard {...defaultProps} task={taskWithTemplate} />)
    expect(screen.getByText('Fiscal Mensal')).toBeInTheDocument()
  })

  it('does not render template_name badge when task has no template_name', () => {
    render(<TaskCard {...defaultProps} />)
    expect(screen.queryByText('Fiscal Mensal')).not.toBeInTheDocument()
  })
})
