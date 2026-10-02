import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

// Helper to create default mutation mocks
const mockMutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false })

// Prazo fixo no passado + veredito do servidor já calculado: o teste não
// depende de relógio de parede (is_overdue/days_remaining chegam prontos da API).
const OVERDUE_DEADLINE = '2026-01-05T18:00:00Z'

vi.mock('../src/api/hooks/useTasks', () => {
  const mockData = {
    useTasksList: () => ({
      data: [
        {
          id: 'task-todo-late',
          title: 'Rotina diaria atrasada na fila',
          client_id: 'c1',
          priority: 'medium',
          phase_id: 'phase-1',
          deadline: OVERDUE_DEADLINE,
          is_overdue: true,
          days_remaining: -3,
          completed_at: null,
          is_cancelled: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          user_id: 'u1',
        },
        {
          id: 'task-doing-late',
          title: 'Rotina diaria atrasada em andamento',
          client_id: 'c1',
          priority: 'medium',
          phase_id: 'phase-2',
          deadline: OVERDUE_DEADLINE,
          is_overdue: true,
          days_remaining: -3,
          completed_at: null,
          is_cancelled: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          user_id: 'u1',
        },
      ],
      isLoading: false,
    }),
    useUpdateTaskStatus: mockMutation,
    usePhases: () => ({
      data: [
        { id: 'phase-1', name: 'a fazer', color: '#6b7280', order: 0, is_done: false, is_default: true, user_id: 'u1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'phase-2', name: 'em andamento', color: '#3b82f6', order: 1, is_done: false, is_default: true, user_id: 'u1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'phase-3', name: 'concluido', color: '#22c55e', order: 2, is_done: true, is_default: true, user_id: 'u1', created_at: '2026-01-01T00:00:00Z' },
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
    useRunDaily: mockMutation,
    useRunMonthly: mockMutation,
    useRunWeekly: mockMutation,
    useRunYearly: mockMutation,
  }
  return { useTasks: () => mockData }
})

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'admin', id: 'u1', email: 'admin@test.com', name: 'Admin' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    setUser: vi.fn(),
    sessionExpired: false,
  }),
}))

vi.mock('../src/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
  getApiUrl: () => 'http://localhost:8000',
  tokenStorage: { getToken: () => 'test-token' },
}))

// Need to import after mocks
const { TasksPage } = await import('../src/pages/panel/TasksPage')

describe('TasksPage — card atrasado em andamento', () => {
  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/painel/tarefas']}>
          <ConfirmProvider>
            <TasksPage />
          </ConfirmProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('lista no filtro Atrasadas o card pendente que está em andamento', () => {
    // Regra do dono: card em "a fazer" OU "em andamento" com prazo vencido
    // fica com a tag de atraso — o filtro Atrasadas precisa listar os dois.
    renderPage()

    fireEvent.click(screen.getByText('Atrasadas'))

    expect(screen.getByText('Rotina diaria atrasada na fila')).toBeInTheDocument()
    expect(screen.getByText('Rotina diaria atrasada em andamento')).toBeInTheDocument()
  })

  it('pinta a tag Atrasado no card em andamento com prazo vencido', () => {
    renderPage()

    expect(screen.getAllByText('Atrasado 3d').length).toBeGreaterThanOrEqual(2)
  })
})