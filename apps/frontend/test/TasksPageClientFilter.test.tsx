import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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
    useTasksList: (teamOnly = false) => ({
      data: teamOnly
        ? [
            { id: 'task-gama', title: 'Gama da equipe', client_id: 'c3', priority: 'high', phase_id: 'phase-1', deadline: todayDeadline, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u2', is_cancelled: false },
          ]
        : [
          { id: 'task-c1', title: 'Alpha mensal', client_id: 'c1', priority: 'high', phase_id: 'phase-1', deadline: todayDeadline, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1', is_cancelled: false },
          { id: 'task-c2', title: 'Beta semanal', client_id: 'c2', priority: 'medium', phase_id: 'phase-1', deadline: todayDeadline, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1', is_cancelled: false },
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
}))

const { TasksPage } = await import('../src/pages/panel/TasksPage')

describe('TasksPage — filtro por cliente', () => {
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

  it('lista os clientes do usuário no dropdown do filtro', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por cliente' }))
    const menu = await screen.findByRole('menu')
    expect(await within(menu).findByText('Empresa Alpha')).toBeInTheDocument()
    expect(await within(menu).findByText('Empresa Beta')).toBeInTheDocument()
    expect(await within(menu).findByText('Empresa Gama')).toBeInTheDocument()
  })

  it('ao selecionar um cliente, mostra somente as tarefas dele', async () => {
    renderPage()

    expect(await screen.findByText('Alpha mensal')).toBeInTheDocument()
    expect(await screen.findByText('Beta semanal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por cliente' }))
    const menu = await screen.findByRole('menu')
    fireEvent.click(await within(menu).findByText('Empresa Beta'))

    await waitFor(() =>
      expect(screen.queryByText('Alpha mensal')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Beta semanal')).toBeInTheDocument()
  })

  it('retorna a lista completa ao escolher "Todos os clientes"', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por cliente' }))
    fireEvent.click(await within(await screen.findByRole('menu')).findByText('Empresa Beta'))
    await waitFor(() =>
      expect(screen.queryByText('Alpha mensal')).not.toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por cliente' }))
    fireEvent.click(await within(await screen.findByRole('menu')).findByText('Todos os clientes'))

    expect(await screen.findByText('Alpha mensal')).toBeInTheDocument()
    expect(screen.getByText('Beta semanal')).toBeInTheDocument()
  })
})

describe('TasksPage — switch Equipe (só clientes compartilhados)', () => {
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

  it('ao ativar Equipe, mostra somente as tasks dos clientes onde sou membro', async () => {
    renderPage()

    expect(await screen.findByText('Alpha mensal')).toBeInTheDocument()
    expect(screen.queryByText('Gama da equipe')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Equipe' }))

    await waitFor(() =>
      expect(screen.queryByText('Alpha mensal')).not.toBeInTheDocument()
    )
    expect(await screen.findByText('Gama da equipe')).toBeInTheDocument()
  })

  it('ao desativar Equipe, volta a mostrar as tasks próprias', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Equipe' }))
    await screen.findByText('Gama da equipe')

    fireEvent.click(screen.getByRole('button', { name: 'Equipe' }))

    await waitFor(() =>
      expect(screen.queryByText('Gama da equipe')).not.toBeInTheDocument()
    )
    expect(await screen.findByText('Alpha mensal')).toBeInTheDocument()
  })
})