import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import type { TaskResponse } from '../src/schemas/tasks'

const update = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false })

vi.mock('../src/api/hooks/useTasks', () => ({
  useTasks: () => ({
    useCreateTask: mutation,
    useUpdateTask: () => ({ mutateAsync: update, mutate: vi.fn(), isPending: false }),
    useDeleteTask: mutation,
  }),
}))

vi.mock('../src/api/client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'Empresa Alpha' }] }) },
  getApiUrl: () => 'http://localhost:8000',
  tokenStorage: { getToken: () => 'test-token' },
}))

const { TaskDrawer } = await import('../src/components/tasks/TaskDrawer')

const baseTask = {
  id: 't1',
  title: 'Conciliar extratos',
  client_id: 'c1',
  priority: 'medium',
  deadline: '2026-10-20T18:00:00Z',
  time_estimate_minutes: 30,
  user_id: 'u1',
  is_cancelled: false,
} as unknown as TaskResponse

const renderDrawer = (task: TaskResponse) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ConfirmProvider>
        <TaskDrawer isOpen onClose={vi.fn()} task={task} />
      </ConfirmProvider>
    </QueryClientProvider>
  )

describe('TaskDrawer — editing sends only what changed (AUD-007)', () => {
  beforeEach(() => update.mockClear())

  it('changing the deadline keeps the saved description untouched', async () => {
    renderDrawer({ ...baseTask, description: 'Pegar extratos com o cliente', notes: 'Banco X' } as TaskResponse)
    fireEvent.click(screen.getByTitle('Editar'))
    fireEvent.change(screen.getByDisplayValue('2026-10-20'), { target: { value: '2026-10-22' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][0]).toEqual({ id: 't1', deadline: '2026-10-22' })
  })

  it('a task opened from the timeline (no description in the DTO) does not erase it', async () => {
    renderDrawer(baseTask)
    fireEvent.click(screen.getByTitle('Editar'))
    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][0]).not.toHaveProperty('description')
    expect(update.mock.calls[0][0]).not.toHaveProperty('notes')
  })
})
