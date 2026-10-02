import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const mockMutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false })

const today = new Date()
const todayStr = today.toISOString()
const yesterday = new Date(today)
yesterday.setDate(yesterday.getDate() - 1)
const yesterdayStr = yesterday.toISOString()

vi.mock('../src/api/hooks/useTasks', () => {
  const mockData = {
    useTasksList: () => ({
      data: [
        {
          id: 'task-done-today',
          title: 'Concluído hoje',
          client_id: 'c1',
          priority: 'medium',
          phase_id: 'phase-3',
          deadline: todayStr,
          completed_at: todayStr,
          is_overdue: false,
          days_remaining: 0,
          is_cancelled: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          user_id: 'u1',
        },
        {
          id: 'task-done-yesterday',
          title: 'Concluído ontem',
          client_id: 'c1',
          priority: 'medium',
          phase_id: 'phase-3',
          deadline: yesterdayStr,
          completed_at: yesterdayStr,
          is_overdue: false,
          days_remaining: 1,
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
  apiClient: { get: vi.fn().mockResolvedValue({ data: [] }) },
  getApiUrl: () => 'http://localhost:8000',
  tokenStorage: { getToken: () => 'test-token' },
}))

const { TasksPage } = await import('../src/pages/panel/TasksPage')

describe('TasksPage — cards concluídos por data de conclusão', () => {
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

  it('no filtro Hoje, mostra apenas concluídos no dia de hoje', () => {
    renderPage()
    // Filtro Hoje já está ativo por padrão
    expect(screen.getByText('Concluído hoje')).toBeInTheDocument()
    expect(screen.queryByText('Concluído ontem')).not.toBeInTheDocument()
  })

  it('no filtro Todas, mostra concluídos de qualquer dia', () => {
    renderPage()
    fireEvent.click(screen.getByText('Todas'))
    expect(screen.getByText('Concluído hoje')).toBeInTheDocument()
    expect(screen.getByText('Concluído ontem')).toBeInTheDocument()
  })
})