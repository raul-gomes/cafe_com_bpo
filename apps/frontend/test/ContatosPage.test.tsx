import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { ContatosPage } from '../src/pages/panel/ContatosPage'
import { ContactResponse } from '../src/api/contacts'

const mockListContacts = vi.hoisted(() => vi.fn())
const mockCreateContact = vi.hoisted(() => vi.fn())
const mockUpdateContact = vi.hoisted(() => vi.fn())
const mockDeleteContact = vi.hoisted(() => vi.fn())

vi.mock('../src/api/contacts', () => ({
  listContacts: mockListContacts,
  createContact: mockCreateContact,
  updateContact: mockUpdateContact,
  deleteContact: mockDeleteContact,
}))

const LIVRE: ContactResponse = {
  id: 'c1',
  nome: 'João Batista',
  telefone: '21998761122',
  email: 'joao@empresa.com.br',
  empresa: 'Empresa Beta',
  origem: 'livre',
  tem_pessoa: true,
}

const DO_CLIENTE: ContactResponse = {
  id: 'p9',
  nome: 'Marina Reis',
  telefone: '11988771234',
  email: 'marina@alfa.com.br',
  empresa: 'Contabilidade Alfa',
  origem: 'cliente',
  tem_pessoa: true,
}

const PROSPECTO: ContactResponse = {
  id: 'p10',
  nome: 'Nina Prospecto',
  telefone: '2132221111',
  email: 'nina@aberto.com.br',
  empresa: 'Lead Aberto Ltda',
  origem: 'prospecto',
  tem_pessoa: true,
}

/** Empresa sem representante: a linha traz o contato da própria empresa. */
const SEM_PESSOA: ContactResponse = {
  id: 'cl7',
  nome: 'Cliente Sem Pessoa',
  telefone: '1155556666',
  email: 'geral@cliente.com.br',
  empresa: 'Cliente Sem Pessoa',
  origem: 'cliente',
  tem_pessoa: false,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ConfirmProvider>
        <ContatosPage />
      </ConfirmProvider>
    </MemoryRouter>
  )
}

async function renderWith(rows: ContactResponse[]) {
  mockListContacts.mockResolvedValue(rows)
  renderPage()
  await screen.findAllByText(rows[0].nome)
}

function row(nome: string): HTMLElement {
  // empresa sem pessoa tem nome == empresa, então pega a 1ª ocorrência
  return screen.getAllByText(nome)[0].closest('tr') as HTMLElement
}

const busca = () => screen.getByLabelText('Buscar contatos')

describe('ContatosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListContacts.mockResolvedValue([])
  })

  it('lista nome, telefone, e-mail e empresa dos contatos, prospectos e clientes', async () => {
    await renderWith([LIVRE, PROSPECTO, DO_CLIENTE])

    expect(within(row('João Batista')).getByText('(21) 99876-1122')).toBeInTheDocument()
    expect(within(row('João Batista')).getByText('joao@empresa.com.br')).toBeInTheDocument()
    expect(within(row('João Batista')).getByText('Empresa Beta')).toBeInTheDocument()
    expect(within(row('Marina Reis')).getByText('Contabilidade Alfa')).toBeInTheDocument()
    expect(within(row('Nina Prospecto')).getByText('Lead Aberto Ltda')).toBeInTheDocument()
  })

  it('mostra o telefone com máscara na tabela, a partir dos dígitos do banco', async () => {
    mockListContacts.mockResolvedValue([
      { ...LIVRE, telefone: '1133334444' },
      { ...LIVRE, id: 'c2', nome: 'Fixo', telefone: '1133334444' },
    ])
    renderPage()

    await screen.findByText('João Batista')
    expect(screen.getAllByText('(11) 3333-4444')).toHaveLength(2)
  })

  it('distingue a origem da linha para o BPO saber de onde vem o contato', async () => {
    await renderWith([LIVRE, PROSPECTO, DO_CLIENTE])

    expect(within(row('João Batista')).getByText('Cadastro próprio')).toBeInTheDocument()
    expect(within(row('Marina Reis')).getByText('Cliente')).toBeInTheDocument()
    expect(within(row('Nina Prospecto')).getByText('Prospecto')).toBeInTheDocument()
  })

  it('avisa que a empresa não tem pessoa cadastrada e não deixa editar por aqui', async () => {
    await renderWith([SEM_PESSOA])

    const linha = within(row('Cliente Sem Pessoa'))
    expect(linha.getByText('sem pessoa cadastrada')).toBeInTheDocument()
    expect(linha.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(linha.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument()
  })

  it('trata coluna vazia como placeholder em vez de mostrar null', async () => {
    mockListContacts.mockResolvedValue([
      { ...LIVRE, telefone: null, email: null, empresa: null },
    ])
    renderPage()

    expect(await screen.findByText('João Batista')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBe(3)
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('busca por nome, empresa, telefone ou e-mail', async () => {
    await renderWith([LIVRE])

    fireEvent.change(busca(), { target: { value: 'beta' } })

    await waitFor(() =>
      expect(mockListContacts).toHaveBeenLastCalledWith({ q: 'beta' })
    )
  })

  it('não dispara uma busca por tecla: espera o usuário parar de digitar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      mockListContacts.mockResolvedValue([LIVRE])
      renderPage()
      await screen.findByText('João Batista')

      const { default: userEvent } = await import('@testing-library/user-event')
      const digitador = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await digitador.type(busca(), 'beta')

      // enquanto digita, só a carga inicial foi para a API
      expect(mockListContacts).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(400)
      await waitFor(() =>
        expect(mockListContacts).toHaveBeenLastCalledWith({ q: 'beta' })
      )
      expect(mockListContacts).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('filtra por origem usando a origem do filtro', async () => {
    await renderWith([LIVRE, DO_CLIENTE, PROSPECTO])

    fireEvent.click(screen.getByRole('tab', { name: /prospecto/i }))

    await waitFor(() =>
      expect(mockListContacts).toHaveBeenLastCalledWith({ origem: 'prospecto' })
    )
  })

  it('mantém a lupa dentro do campo de busca (design system)', async () => {
    await renderWith([LIVRE])

    const grupo = busca().closest('[data-slot="input-group"]')
    expect(grupo).not.toBeNull()
    expect(grupo?.querySelector('[data-slot="input-group-addon"] svg')).not.toBeNull()
  })

  it('limpa a busca pelo botão de limpar', async () => {
    await renderWith([LIVRE])

    fireEvent.change(busca(), { target: { value: 'beta' } })
    await waitFor(() =>
      expect(mockListContacts).toHaveBeenLastCalledWith({ q: 'beta' })
    )

    fireEvent.click(screen.getByRole('button', { name: /limpar busca/i }))

    expect(busca()).toHaveValue('')
  })

  it('cria um contato com nome, telefone, e-mail e empresa', async () => {
    mockCreateContact.mockResolvedValue(LIVRE)
    await renderWith([LIVRE])

    fireEvent.click(screen.getByRole('button', { name: /novo contato/i }))
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Novo Contato' },
    })
    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(21) 3456-7890' },
    })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'novo@empresa.com.br' },
    })
    fireEvent.change(screen.getByLabelText('Empresa'), {
      target: { value: 'Empresa Delta' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(mockCreateContact).toHaveBeenCalledWith({
        nome: 'Novo Contato',
        telefone: '2134567890',
        email: 'novo@empresa.com.br',
        empresa: 'Empresa Delta',
      })
    )
  })

  it('aplica a máscara de telefone enquanto o BPO digita', async () => {
    await renderWith([LIVRE])

    fireEvent.click(screen.getByRole('button', { name: /novo contato/i }))
    const telefone = await screen.findByLabelText('Telefone')
    fireEvent.change(telefone, { target: { value: '21987654321' } })

    expect(telefone).toHaveValue('(21) 98765-4321')
  })

  it('exige o nome do contato no formulário', async () => {
    await renderWith([LIVRE])

    fireEvent.click(screen.getByRole('button', { name: /novo contato/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome do contato')).toBeInTheDocument()
    expect(mockCreateContact).not.toHaveBeenCalled()
  })

  it('avisa quando o e-mail informado é inválido', async () => {
    await renderWith([LIVRE])

    fireEvent.click(screen.getByRole('button', { name: /novo contato/i }))
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'nao-e-email' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument()
    expect(mockCreateContact).not.toHaveBeenCalled()
  })

  it('edita um contato do próprio cadastro', async () => {
    mockUpdateContact.mockResolvedValue({ ...LIVRE, nome: 'João B. Silva' })
    await renderWith([LIVRE])

    fireEvent.click(within(row('João Batista')).getByRole('button', { name: /editar/i }))
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'João B. Silva' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(mockUpdateContact).toHaveBeenCalledWith('c1', {
        nome: 'João B. Silva',
        telefone: '21998761122',
        email: 'joao@empresa.com.br',
        empresa: 'Empresa Beta',
      })
    )
  })

  it('edita o contato do cliente pelo id do contato, sem empresa', async () => {
    mockUpdateContact.mockResolvedValue({ ...DO_CLIENTE, nome: 'Marina R. Costa' })
    await renderWith([LIVRE, DO_CLIENTE])

    fireEvent.click(within(row('Marina Reis')).getByRole('button', { name: /editar/i }))
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Marina R. Costa' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(mockUpdateContact).toHaveBeenCalledWith('p9', {
        nome: 'Marina R. Costa',
        telefone: '11988771234',
        email: 'marina@alfa.com.br',
      })
    )
  })

  it('edita o contato do prospecto pelo id do contato', async () => {
    mockUpdateContact.mockResolvedValue({ ...PROSPECTO, nome: 'Nina Nova' })
    await renderWith([PROSPECTO])

    fireEvent.click(within(row('Nina Prospecto')).getByRole('button', { name: /editar/i }))
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Nina Nova' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(mockUpdateContact).toHaveBeenCalledWith('p10', {
        nome: 'Nina Nova',
        telefone: '2132221111',
        email: 'nina@aberto.com.br',
      })
    )
  })

  it('explica onde o contato do cliente é corrigido', async () => {
    await renderWith([DO_CLIENTE])

    fireEvent.click(within(row('Marina Reis')).getByRole('button', { name: /editar/i }))

    expect(await screen.findByText(/cadastro do cliente/i)).toBeInTheDocument()
  })

  it('explica onde o contato do prospecto é corrigido', async () => {
    await renderWith([PROSPECTO])

    fireEvent.click(within(row('Nina Prospecto')).getByRole('button', { name: /editar/i }))

    expect(await screen.findByText(/cadastro do prospecto/i)).toBeInTheDocument()
  })

  it('não deixa editar o nome da empresa na linha de empresa', async () => {
    await renderWith([DO_CLIENTE, PROSPECTO])

    fireEvent.click(within(row('Marina Reis')).getByRole('button', { name: /editar/i }))
    expect(await screen.findByLabelText('Empresa')).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(within(row('Nina Prospecto')).getByRole('button', { name: /editar/i }))
    expect(await screen.findByLabelText('Empresa')).toBeDisabled()
  })

  it('exclui um contato do próprio cadastro após confirmar', async () => {
    mockDeleteContact.mockResolvedValue(undefined)
    await renderWith([LIVRE])

    fireEvent.click(within(row('João Batista')).getByRole('button', { name: /excluir/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /confirmar|excluir/i }))

    await waitFor(() => expect(mockDeleteContact).toHaveBeenCalledWith('c1'))
  })

  it('cancela a exclusão sem chamar a API', async () => {
    await renderWith([LIVRE])

    fireEvent.click(within(row('João Batista')).getByRole('button', { name: /excluir/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /cancelar/i }))

    expect(mockDeleteContact).not.toHaveBeenCalled()
  })

  it('não oferece exclusão para o contato que vem do cadastro da empresa', async () => {
    await renderWith([DO_CLIENTE, PROSPECTO])

    expect(
      within(row('Marina Reis')).queryByRole('button', { name: /excluir/i })
    ).not.toBeInTheDocument()
    expect(
      within(row('Nina Prospecto')).queryByRole('button', { name: /excluir/i })
    ).not.toBeInTheDocument()
    expect(within(row('Marina Reis')).getByRole('button', { name: /editar/i })).toBeInTheDocument()
    expect(within(row('Nina Prospecto')).getByRole('button', { name: /editar/i })).toBeInTheDocument()
  })

  it('avisa que a lista não pôde ser carregada', async () => {
    mockListContacts.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument()
  })
})
