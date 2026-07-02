import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TaskCard } from '../src/components/tasks/TaskCard'
import { TaskResponse } from '../src/schemas/tasks'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

// Mock useConfirm to avoid modal rendering in tests
const mockConfirm = vi.fn()
vi.mock('../src/components/ui/ConfirmDialog', () => ({
  useConfirm: () => mockConfirm,
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

beforeEach(() => {
  mockConfirm.mockReset()
})

function renderCard(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

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
    renderCard(<TaskCard {...defaultProps} />)
    expect(screen.getByText('ACME Corp')).toBeInTheDocument()
  })

  it('renders task title', () => {
    renderCard(<TaskCard {...defaultProps} />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('renders fallback text when client is undefined', () => {
    renderCard(<TaskCard {...defaultProps} client={undefined} />)
    expect(screen.getByText('Cliente')).toBeInTheDocument()
  })

  it('renders finalize button when status !== doneColumnId', () => {
    renderCard(<TaskCard {...defaultProps} />)
    expect(screen.getByTitle('Mover para Concluído')).toBeInTheDocument()
  })

  it('does NOT render finalize button when status === doneColumnId', () => {
    const doneTask = { ...baseTask, status: 'done' }
    renderCard(
      <TaskCard
        {...defaultProps}
        task={doneTask}
        getTaskStatus={() => 'done'}
      />
    )
    expect(screen.queryByTitle('Mover para Concluído')).not.toBeInTheDocument()
  })

  it('does NOT render finalize button when onFinalize is undefined', () => {
    renderCard(<TaskCard {...defaultProps} onFinalize={undefined} />)
    expect(screen.queryByTitle('Mover para Concluído')).not.toBeInTheDocument()
  })

  it('renders cancel button when conditions met', () => {
    renderCard(<TaskCard {...defaultProps} />)
    expect(screen.getByTitle('Cancelar tarefa')).toBeInTheDocument()
  })

  it('does NOT render cancel button when task is cancelled', () => {
    const cancelledTask = { ...baseTask, status: 'cancelled' }
    renderCard(<TaskCard {...defaultProps} task={cancelledTask} />)
    expect(screen.queryByTitle('Cancelar tarefa')).not.toBeInTheDocument()
  })

  it('does NOT render cancel button when task has cancelled_at', () => {
    const cancelledTask = { ...baseTask, cancelled_at: '2026-01-02T00:00:00Z' }
    renderCard(<TaskCard {...defaultProps} task={cancelledTask} />)
    expect(screen.queryByTitle('Cancelar tarefa')).not.toBeInTheDocument()
  })

  it('does NOT render cancel button when status === doneColumnId', () => {
    const doneTask = { ...baseTask, status: 'done' }
    renderCard(
      <TaskCard
        {...defaultProps}
        task={doneTask}
        getTaskStatus={() => 'done'}
      />
    )
    expect(screen.queryByTitle('Cancelar tarefa')).not.toBeInTheDocument()
  })

  it('shows overdue badge when isTaskOverdue returns true', () => {
    renderCard(
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
    renderCard(<TaskCard {...defaultProps} />)
    expect(screen.queryByText(/Atrasado/)).not.toBeInTheDocument()
  })

  it('shows deadline when task.deadline is set', () => {
    const taskWithDeadline = { ...baseTask, deadline: '2026-06-15T12:00:00Z' }
    renderCard(<TaskCard {...defaultProps} task={taskWithDeadline} />)
    // Check that deadline is rendered inside a flex container with calendar icon
    const deadlineEl = screen.getByText(/15/)
    expect(deadlineEl).toBeInTheDocument()
  })

  it('does not show deadline when task.deadline is undefined', () => {
    renderCard(<TaskCard {...defaultProps} />)
    // The creation metadata line contains "Criada em" but not a deadline
    const deadlineContainers = screen.queryAllByText(/\d{2}\/\d{2}/)
    // Only the creation date should match (not a deadline)
    expect(deadlineContainers.length).toBe(1)
  })

  it('shows creation date in metadata', () => {
    renderCard(<TaskCard {...defaultProps} />)
    // The metadata row should contain a date pattern (dd/dd)
    expect(screen.getByText(/\d{2}\/\d{2}/)).toBeInTheDocument()
  })

  it('shows priority label in metadata', () => {
    renderCard(<TaskCard {...defaultProps} />)
    expect(screen.getByText('Alta')).toBeInTheDocument()
  })

  it('shows time estimate when present', () => {
    const taskWithEstimate = { ...baseTask, time_estimate_minutes: 30 }
    renderCard(<TaskCard {...defaultProps} task={taskWithEstimate} />)
    expect(screen.getByText(/30min/)).toBeInTheDocument()
  })

  it('shows full date format in deadline', () => {
    const taskWithDeadline = { ...baseTask, deadline: '2026-06-15T12:00:00Z' }
    renderCard(<TaskCard {...defaultProps} task={taskWithDeadline} />)
    expect(screen.getByText(/15\/06\/2026/)).toBeInTheDocument()
  })

  it('renders overdue badge with destructive (red) styling', () => {
    renderCard(
      <TaskCard
        {...defaultProps}
        isTaskOverdue={() => true}
        getOverdueDays={() => 5}
      />
    )
    const badge = screen.getByText(/Atrasado/)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('destructive')
  })

  it('calls onEdit when card is clicked', () => {
    const onEdit = vi.fn()
    renderCard(<TaskCard {...defaultProps} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('Test Task'))
    expect(onEdit).toHaveBeenCalledWith(baseTask)
  })

  it('calls onFinalize when finalize button is clicked', () => {
    const onFinalize = vi.fn()
    renderCard(<TaskCard {...defaultProps} onFinalize={onFinalize} />)
    fireEvent.click(screen.getByTitle('Mover para Concluído'))
    expect(onFinalize).toHaveBeenCalledWith('task-1')
  })

  it('calls onCancel when cancel button is confirmed', async () => {
    mockConfirm.mockResolvedValue(true)
    const onCancel = vi.fn()
    renderCard(<TaskCard {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTitle('Cancelar tarefa'))
    await vi.waitFor(() => {
      expect(onCancel).toHaveBeenCalledWith('task-1')
    })
  })

  it('does NOT call onCancel when confirm is dismissed', async () => {
    mockConfirm.mockResolvedValue(false)
    const onCancel = vi.fn()
    renderCard(<TaskCard {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTitle('Cancelar tarefa'))
    await vi.waitFor(() => {
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  it('does not call onEdit when finalize button is clicked (stopPropagation)', () => {
    const onEdit = vi.fn()
    const onFinalize = vi.fn()
    renderCard(<TaskCard {...defaultProps} onEdit={onEdit} onFinalize={onFinalize} />)
    fireEvent.click(screen.getByTitle('Mover para Concluído'))
    expect(onEdit).not.toHaveBeenCalled()
    expect(onFinalize).toHaveBeenCalled()
  })

  // ── Sprint 3 Section 3: template_name badge ──

  it('renders template_name badge when task has template_name', () => {
    const taskWithTemplate = { ...baseTask, template_name: 'Fiscal Mensal' }
    renderCard(<TaskCard {...defaultProps} task={taskWithTemplate} />)
    expect(screen.getByText('Fiscal Mensal')).toBeInTheDocument()
  })

  it('does not render template_name badge when task has no template_name', () => {
    renderCard(<TaskCard {...defaultProps} />)
    expect(screen.queryByText('Fiscal Mensal')).not.toBeInTheDocument()
  })
})
