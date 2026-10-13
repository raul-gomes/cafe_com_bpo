import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'

const update = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false })

const MONTHLY = {
  id: 't1',
  user_id: 'u1',
  name: 'Fechamento',
  description: null,
  process_type: 'financeiro',
  recurrence: 'monthly',
  weekdays: [],
  due_day: 10,
  due_month: null,
  due_days_from_start: null,
  routine_type_id: null,
  is_general: false,
  activities: [],
}

vi.mock('../src/api/hooks/useTasks', () => ({
  useTasks: () => ({
    useTemplate: () => ({ data: MONTHLY, isLoading: false }),
    useRoutineTypes: () => ({ data: [] }),
    useUpdateTemplate: () => ({ mutateAsync: update, mutate: vi.fn(), isPending: false }),
    useCreateActivity: mutation,
    useUpdateActivity: mutation,
    useDeleteActivity: mutation,
    useReorderActivities: mutation,
  }),
}))

const { TemplateDetailPage } = await import('../src/pages/panel/TemplateDetailPage')

describe('TemplateDetailPage — routine configuration (AUD-018)', () => {
  beforeEach(() => update.mockClear())

  it('changing monthly to weekly saves the new recurrence and clears the monthly day', async () => {
    render(
      <MemoryRouter initialEntries={['/painel/templates-atividades/t1']}>
        <ConfirmProvider>
          <Routes>
            <Route path="/painel/templates-atividades/:id" element={<TemplateDetailPage />} />
          </Routes>
        </ConfirmProvider>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /Configurar/ }))
    fireEvent.change(await screen.findByDisplayValue('Mensal'), { target: { value: 'weekly' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][0]).toMatchObject({
      id: 't1',
      recurrence: 'weekly',
      due_day: null,
      due_month: null,
      due_days_from_start: null,
    })
    expect(update.mock.calls[0][0].weekdays.length).toBeGreaterThan(0)
  })
})
