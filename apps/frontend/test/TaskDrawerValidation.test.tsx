import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

const create = vi.hoisted(() => vi.fn())
const mutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false })

vi.mock('../src/api/hooks/useTasks', () => ({
  useTasks: () => ({
    useCreateTask: () => ({ mutateAsync: create, mutate: vi.fn(), isPending: false }),
    useUpdateTask: mutation,
    useDeleteTask: mutation,
  }),
}))

vi.mock('../src/api/client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Empresa Alpha' }] }) },
  getApiUrl: () => 'http://localhost:8000',
  tokenStorage: { getToken: () => 'test-token' },
}))

const { TaskDrawer } = await import('../src/components/tasks/TaskDrawer')

const renderDrawer = (onClose = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ConfirmProvider>
        <TaskDrawer isOpen onClose={onClose} task={null} />
      </ConfirmProvider>
    </QueryClientProvider>
  )

describe('TaskDrawer — validation and save errors (AUD-020)', () => {

  it('a blank title is refused before calling the API', async () => {
    renderDrawer()
    fireEvent.change(screen.getByPlaceholderText(/Conciliação Bancária/), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar Tarefa' }))

    expect(await screen.findByText('Título deve ter pelo menos 3 caracteres')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('a failed save shows the reason and keeps the drawer open with the data', async () => {
    // Shape of an axios error as the drawer reads it (response.data.detail).
    create.mockImplementation(async () => {
      throw Object.assign(new Error('Request failed with status code 404'), {
        response: { status: 404, data: { detail: 'Tarefa não encontrada' } },
      })
    })
    const onClose = vi.fn()
    renderDrawer(onClose)
    fireEvent.change(screen.getByPlaceholderText(/Conciliação Bancária/), { target: { value: 'Conciliar extratos' } })
    const company = await screen.findByRole('option', { name: 'Empresa Alpha' })
    fireEvent.change(company.closest('select')!, { target: { value: '00000000-0000-4000-8000-000000000001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar Tarefa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tarefa não encontrada')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Conciliar extratos')).toBeInTheDocument()
  })
})
