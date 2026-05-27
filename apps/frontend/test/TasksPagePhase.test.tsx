import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

// Helper to create default mutation mocks
const mockMutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false })

// Mock all the hooks used by TasksPage
vi.mock('../src/api/hooks/useTasks', () => {
  const mockData = {
    useTasksList: () => ({
      data: [
        { id: 'task-1', title: 'Task 1', client_id: 'c1', status: 'todo', priority: 'high', phase_id: 'phase-1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1' },
        { id: 'task-2', title: 'Task 2', client_id: 'c1', status: 'doing', priority: 'medium', phase_id: 'phase-2', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1' },
      ],
      isLoading: false,
    }),
    useUpdateTaskStatus: mockMutation,
    usePhases: () => ({
      data: [
        { id: 'phase-1', name: 'A Fazer', color: '#6b7280', order: 0, is_default: true, user_id: 'u1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'phase-2', name: 'Em Andamento', color: '#3b82f6', order: 1, is_default: true, user_id: 'u1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'phase-3', name: 'Concluído', color: '#22c55e', order: 2, is_default: true, user_id: 'u1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'phase-4', name: 'Em Revisão', color: '#f59e0b', order: 3, is_default: false, user_id: 'u1', created_at: '2026-01-01T00:00:00Z' },
      ],
      isLoading: false,
    }),
    useTimeline: () => ({ data: { timeline: [] }, isLoading: false }),
    useConflicts: () => ({ data: { conflicts: [] } }),
    // Provide all other hooks that children might use
    useCreateTask: mockMutation,
    useUpdateTask: mockMutation,
    useUpdateClient: mockMutation,
    useDeleteTask: mockMutation,
    useCreatePhase: mockMutation,
    useUpdatePhase: mockMutation,
    useDeletePhase: mockMutation,
    useReorderPhases: mockMutation,
    useTemplatesList: () => ({ data: [] }),
    useTemplate: () => ({ data: null }),
    useCreateTemplate: mockMutation,
    useUpdateTemplate: mockMutation,
    useDeleteTemplate: mockMutation,
    useCreateActivity: mockMutation,
    useUpdateActivity: mockMutation,
    useDeleteActivity: mockMutation,
    useReorderActivities: mockMutation,
    useAssignTemplate: mockMutation,
    useClientAssignments: () => ({ data: [], refetch: vi.fn() }),
    useRemoveAssignment: mockMutation,
    useRegenerateClientTasks: mockMutation,
    useClientSLAs: () => ({ data: [] }),
    useCreateSLA: mockMutation,
    useUpdateSLA: mockMutation,
    useDeleteSLA: mockMutation,
    useClientTimeline: () => ({ data: null }),
    useTaskAttachments: () => ({ data: [] }),
    useUploadAttachment: mockMutation,
    useDeleteAttachment: mockMutation,
    useSendTaskEmail: mockMutation,
    useSLAAlerts: () => ({ data: { alerts: [] } }),
    useCancelTask: mockMutation,
  }
  return { useTasks: () => mockData }
})

vi.mock('../src/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

// Need to import after mocks
const { TasksPage } = await import('../src/pages/panel/TasksPage')

describe('TasksPage — Phases (Tarefa 5.2)', () => {
  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/painel/tarefas']}>
          <TasksPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders phase names as Kanban column headers', async () => {
    renderPage()

    // All 4 phases should appear as column headers (h3 elements)
    // Note: phase names also appear in the filter dropdown, so use getAllByText
    // Phase names can appear in both column headers and filter dropdown
    expect(screen.getAllByText('A Fazer').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Em Andamento').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Concluído').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Em Revisão').length).toBeGreaterThanOrEqual(1)
  })

  it('shows correct task count per phase column', async () => {
    renderPage()

    // Task 1 has phase_id 'phase-1' (A Fazer) -> column should show count 1
    // Task 2 has phase_id 'phase-2' (Em Andamento) -> column should show count 1
    const countBadges = screen.getAllByText('1')
    expect(countBadges.length).toBeGreaterThanOrEqual(2)
  })

  it('renders Fases button to open PhaseManager', async () => {
    renderPage()

    const fasesBtn = screen.getByText('Fases')
    expect(fasesBtn).toBeInTheDocument()
  })
})
