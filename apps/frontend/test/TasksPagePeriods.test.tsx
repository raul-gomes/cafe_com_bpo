import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const mockMutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false })

vi.mock('../src/api/hooks/useTasks', () => {
  const now = new Date()
  const todayDeadline = new Date(now).toISOString()
  const mockData = {
    useTasksList: (filter: any = {}) => {
      const team = typeof filter === 'boolean' ? filter : (filter?.team ?? false);
      return {
        data: team
          ? [
              { id: 'task-gama', title: 'Gama da equipe', client_id: 'c3', priority: 'high', phase_id: 'phase-1', deadline: todayDeadline, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u2', is_cancelled: false },
            ]
          : [
            { id: 'task-early', title: 'Fechamento antigo', client_id: 'c1', priority: 'high', phase_id: 'phase-1', deadline: '2026-10-09T15:00:00Z', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1', is_cancelled: false, is_overdue: false },
            { id: 'task-late', title: 'Conciliação futura', client_id: 'c2', priority: 'medium', phase_id: 'phase-1', deadline: '2026-10-14T15:00:00Z', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1', is_cancelled: false, is_overdue: false },
          ],
        isLoading: false,
      };
    },
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
    get: vi.fn().mockResolvedValue({
      data: [
        { id: 'c1', name: 'Empresa Alpha', color: '#ef4444' },
        { id: 'c2', name: 'Empresa Beta', color: '#3b82f6' },
        { id: 'c3', name: 'Empresa Gama', color: '#22c55e' },
      ],
    }),
  },
  getApiUrl: () => 'http://localhost:8000',
  tokenStorage: { getToken: () => 'test-token' },
}))

const { TasksPage } = await import('../src/pages/panel/TasksPage')

describe('TasksPage — period filters (AUD-015, AUD-016)', () => {
  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/painel/tarefas']}>
          <ConfirmProvider>
            <TasksPage />
          </ConfirmProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )

  afterEach(() => {
    vi.useRealTimers()
  })

  it('on a Sunday, "Semana" is the week ending that day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)) // Sunday, 11/10/2026
    renderPage()
    // Nothing is due "today"; the filter falls through to this week.
    expect(await screen.findByText('Fechamento antigo')).toBeInTheDocument()
    expect(screen.queryByText('Conciliação futura')).not.toBeInTheDocument()
  })

  it('the manual range hides tasks outside it', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^Todas/ }))
    await screen.findByText('Fechamento antigo')

    fireEvent.click(screen.getByRole('button', { name: /Período/ }))
    const [from, to] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(from, { target: { value: '2026-10-12' } })
    fireEvent.change(to, { target: { value: '2026-10-20' } })

    await waitFor(() => expect(screen.queryByText('Fechamento antigo')).not.toBeInTheDocument())
    expect(screen.getByText('Conciliação futura')).toBeInTheDocument()
  })

  it('an end date before the start is flagged and not applied', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^Todas/ }))
    await screen.findByText('Fechamento antigo')

    fireEvent.click(screen.getByRole('button', { name: /Período/ }))
    const [from, to] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(from, { target: { value: '2026-10-20' } })
    fireEvent.change(to, { target: { value: '2026-10-12' } })

    expect(await screen.findByText('A data final é anterior à inicial.')).toBeInTheDocument()
    expect(screen.getByText('Fechamento antigo')).toBeInTheDocument()
    expect(screen.getByText('Conciliação futura')).toBeInTheDocument()
  })
})
