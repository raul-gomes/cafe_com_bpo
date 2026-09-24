import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfirmProvider } from '../src/components/ui/ConfirmDialog'
import { ProspectosPage } from '../src/pages/panel/ProspectosPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

vi.mock('../src/api/prospects', () => ({
  getProspects: vi.fn().mockResolvedValue([
    { id: '1', name: 'Lead A', cnpj: '12.345.678/0001-99', segment: 'B2B - Consultoria & Assessoria' },
    { id: '2', name: 'Lead B', cnpj: '98.765.432/0001-10' },
  ]),
  createProspect: vi.fn().mockResolvedValue({ id: '3', name: 'Lead C' }),
  updateProspect: vi.fn().mockResolvedValue({ id: '1', name: 'Lead A Atualizado' }),
  deleteProspect: vi.fn().mockResolvedValue({}),
  convertProspect: vi.fn().mockResolvedValue({ prospect_id: '1', client_id: 'c1' }),
}))

vi.mock('../src/lib/brasilApi', () => ({
  lookupCnpj: vi.fn(),
  lookupCep: vi.fn(),
}))

vi.mock('../src/api/clients', () => ({
  getClientSegments: vi.fn().mockResolvedValue(['B2B - Tecnologia & Software', 'Outro']),
}))

import { getProspects, createProspect, deleteProspect, convertProspect } from '../src/api/prospects'
import { lookupCnpj, lookupCep } from '../src/lib/brasilApi'
import { getClientSegments } from '../src/api/clients'

describe('ProspectosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getProspects as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: '1', name: 'Lead A', cnpj: '12.345.678/0001-99', segment: 'B2B - Consultoria & Assessoria' },
      { id: '2', name: 'Lead B', cnpj: '98.765.432/0001-10' },
    ])
    ;(lookupCnpj as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(lookupCep as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(getClientSegments as ReturnType<typeof vi.fn>).mockResolvedValue([
      'B2B - Tecnologia & Software',
      'Outro',
    ])
  })

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/painel/prospectos']}>
          <ConfirmProvider>
            <ProspectosPage />
          </ConfirmProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('rende o título "Meus Prospectos"', async () => {
    renderPage()
    const title = await screen.findByRole('heading', { level: 1 })
    expect(title).toHaveTextContent('Meus Prospectos')
  })

  it('lista os prospectos carregados', async () => {
    renderPage()
    expect(await screen.findByText('Lead A')).toBeInTheDocument()
    expect(await screen.findByText('Lead B')).toBeInTheDocument()
    expect(screen.getByText('B2B - Consultoria & Assessoria')).toBeInTheDocument()
  })

  it('mostra botão "Novo Prospecto" para criar', async () => {
    renderPage()
    const newBtn = await screen.findByText('Novo Prospecto')
    expect(newBtn).toBeInTheDocument()
  })

  it('abre form inline dentro do card ao clicar em um prospecto', async () => {
    renderPage()
    const user = userEvent.setup()
    const leadText = await screen.findByText('Lead A')
    const card = leadText.closest('[data-slot="card"]')!
    expect(card.querySelector('input[placeholder*="Nome do prospecto"]')).toBeNull()
    await user.click(card)
    const nameInput = card.querySelector('input[placeholder*="Nome do prospecto"]')
    expect(nameInput).toBeInTheDocument()
    expect(nameInput).toHaveValue('Lead A')
  })

  it('salva a edição inline e fecha o card expandido', async () => {
    renderPage()
    const user = userEvent.setup()
    const leadText = await screen.findByText('Lead A')
    const card = leadText.closest('[data-slot="card"]')!
    await user.click(card)
    await user.click(screen.getByRole('button', { name: /Salvar/i }))
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/nome do prospecto/i)).not.toBeInTheDocument()
    })
  })

  it('arquiva um prospecto após confirmação e remove da lista', async () => {
    renderPage()
    const user = userEvent.setup()
    const leadText = await screen.findByText('Lead A')
    const card = leadText.closest('[data-slot="card"]')!
    fireEvent.click(card.querySelector('button[title="Excluir"]')!)

    const confirmBtn = await screen.findByRole('button', { name: /arquivar/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(deleteProspect).toHaveBeenCalledWith('1')
      expect(screen.queryByText('Lead A')).not.toBeInTheDocument()
    })
  })

  it('converte um prospecto em Cliente após confirmação', async () => {
    renderPage()
    const user = userEvent.setup()
    const leadText = await screen.findByText('Lead A')
    const card = leadText.closest('[data-slot="card"]')!
    fireEvent.click(card.querySelector('button[aria-label="Converter em Cliente"]')!)

    const dialog = await screen.findByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: /converter/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(convertProspect).toHaveBeenCalledWith('1')
      expect(screen.queryByText('Lead A')).not.toBeInTheDocument()
    })
  })

  it('renderiza o campo CNPJ antes do nome no formulário', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Novo Prospecto'))

    const cnpjInput = screen.getByPlaceholderText('00.000.000/0000-00')
    const nameInput = screen.getByPlaceholderText('Nome do prospecto')
    expect(cnpjInput.compareDocumentPosition(nameInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('usa dropdown de segmento (mesmo do Clientes) e não preenche pelo CNAE', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Novo Prospecto'))

    expect(getClientSegments).toHaveBeenCalled()
    const segSelect = screen.getByRole('combobox')
    expect(segSelect).toHaveValue('')
    expect(within(segSelect).getByText('B2B - Tecnologia & Software')).toBeInTheDocument()

    ;(lookupCnpj as ReturnType<typeof vi.fn>).mockResolvedValue({
      razao_social: 'ACME LTDA',
      cnae_fiscal_descricao: 'Consultoria de gestão',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01310100',
      email: 'contato@acme.com',
    })

    const cnpjInput = screen.getByPlaceholderText('00.000.000/0000-00')
    await user.type(cnpjInput, '12345678000199')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('Avenida Paulista')
      expect(screen.getByPlaceholderText('contato@empresa.com')).toHaveValue('contato@acme.com')
    })
    expect(segSelect).toHaveValue('')
  })

  it('renderiza o CEP antes dos campos de endereço', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Novo Prospecto'))

    const cepInput = screen.getByPlaceholderText('00000-000')
    const streetInput = screen.getByPlaceholderText('Rua / Avenida')
    expect(cepInput.compareDocumentPosition(streetInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('preenche os campos de endereço ao sair do campo CNPJ encontrado', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Novo Prospecto'))

    ;(lookupCnpj as ReturnType<typeof vi.fn>).mockResolvedValue({
      razao_social: 'ACME LTDA',
      nome_fantasia: 'ACME',
      cnae_fiscal_descricao: 'Consultoria de gestão',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: 'Conj 55',
      bairro: 'Bela Vista',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01310100',
      email: 'contato@acme.com',
      ddd_telefone_1: '1130000000',
    })

    const cnpjInput = screen.getByPlaceholderText('00.000.000/0000-00')
    await user.type(cnpjInput, '12345678000199')
    await user.tab()

    await waitFor(() => {
      expect(lookupCnpj).toHaveBeenCalledWith('12345678000199')
      expect(screen.getByPlaceholderText('Nome do prospecto')).toHaveValue('ACME')
      expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('Avenida Paulista')
      expect(screen.getByPlaceholderText('Número')).toHaveValue('1000')
      expect(screen.getByPlaceholderText('Apto / Sala / Andar')).toHaveValue('Conj 55')
      expect(screen.getByPlaceholderText('Bairro')).toHaveValue('Bela Vista')
      expect(screen.getByPlaceholderText('Cidade')).toHaveValue('São Paulo')
      expect(screen.getByPlaceholderText('UF')).toHaveValue('SP')
      expect(screen.getByPlaceholderText('00000-000')).toHaveValue('01310-100')
    })
  })

  it('deixa os campos em branco quando o CNPJ não é encontrado', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Novo Prospecto'))

    ;(lookupCnpj as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const cnpjInput = screen.getByPlaceholderText('00.000.000/0000-00')
    await user.type(cnpjInput, '00000000000191')
    await user.tab()

    await waitFor(() => {
      expect(lookupCnpj).toHaveBeenCalledWith('00000000000191')
      expect(screen.getByPlaceholderText('Nome do prospecto')).toHaveValue('')
      expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('')
      expect(screen.getByPlaceholderText('Número')).toHaveValue('')
      expect(screen.getByPlaceholderText('Cidade')).toHaveValue('')
      expect(screen.getByPlaceholderText('UF')).toHaveValue('')
      expect(screen.getByPlaceholderText('00000-000')).toHaveValue('')
    })
  })

  it('preenche endereço separado ao sair do campo CEP encontrado', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Novo Prospecto'))

    ;(lookupCep as ReturnType<typeof vi.fn>).mockResolvedValue({
      cep: '01310100',
      state: 'SP',
      city: 'São Paulo',
      neighborhood: 'Bela Vista',
      street: 'Avenida Paulista',
    })

    const cepInput = screen.getByPlaceholderText('00000-000')
    await user.type(cepInput, '01310100')
    await user.tab()

    await waitFor(() => {
      expect(lookupCep).toHaveBeenCalledWith('01310100')
      expect(screen.getByPlaceholderText('Rua / Avenida')).toHaveValue('Avenida Paulista')
      expect(screen.getByPlaceholderText('Bairro')).toHaveValue('Bela Vista')
      expect(screen.getByPlaceholderText('Cidade')).toHaveValue('São Paulo')
      expect(screen.getByPlaceholderText('UF')).toHaveValue('SP')
    })
  })

  it('mostra a seção de Representante da Empresa no formulário', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Novo Prospecto'))

    expect(screen.getByPlaceholderText('Nome do representante')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('representante@empresa.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('000.000.000-00')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ex.: Sócio(a), Diretor(a), CFO')).toBeInTheDocument()
    const phones = screen.getAllByPlaceholderText('(00) 00000-0000')
    expect(phones).toHaveLength(2)
  })

  it('cria prospecto enviando os dados do representante', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Novo Prospecto'))

    const nameInput = screen.getByPlaceholderText('Nome do prospecto')
    await user.type(nameInput, 'Empresa Potencial')

    const repName = screen.getByPlaceholderText('Nome do representante')
    await user.type(repName, 'Maria Silva')

    const repEmail = screen.getByPlaceholderText('representante@empresa.com')
    await user.type(repEmail, 'maria@potencial.com')

    const repCpf = screen.getByPlaceholderText('000.000.000-00')
    await user.type(repCpf, '12345678901')

    const repPhone = screen.getAllByPlaceholderText('(00) 00000-0000')[1]
    await user.type(repPhone, '11977771234')

    const repCargo = screen.getByPlaceholderText('Ex.: Sócio(a), Diretor(a), CFO')
    await user.type(repCargo, 'CFO')

    await user.click(screen.getByRole('button', { name: 'Criar Prospecto' }))

    await waitFor(() => {
      expect(createProspect).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Empresa Potencial',
          representante_nome: 'Maria Silva',
          representante_email: 'maria@potencial.com',
          representante_cpf: '12345678901',
          representante_telefone: '11977771234',
          representante_cargo: 'CFO',
        })
      )
    })
  })

  it('abre a edição com os dados do representante preenchidos', async () => {
    (getProspects as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: '9',
        name: 'Lead Com Rep',
        representante_nome: 'Maria Silva',
        representante_email: 'maria@potencial.com',
        representante_cpf: '12345678901',
        representante_telefone: '11977771234',
        representante_cargo: 'CFO',
      },
    ])
    renderPage()
    const user = userEvent.setup()

    const leadText = await screen.findByText('Lead Com Rep')
    const card = leadText.closest('[data-slot="card"]')!
    await user.click(card)

    expect(screen.getByPlaceholderText('Nome do representante')).toHaveValue('Maria Silva')
    expect(screen.getByPlaceholderText('representante@empresa.com')).toHaveValue('maria@potencial.com')
    expect(screen.getByPlaceholderText('000.000.000-00')).toHaveValue('123.456.789-01')
    expect(screen.getByPlaceholderText('Ex.: Sócio(a), Diretor(a), CFO')).toHaveValue('CFO')
    const phones = screen.getAllByPlaceholderText('(00) 00000-0000')
    expect(phones[1]).toHaveValue('(11) 97777-1234')
  })
})