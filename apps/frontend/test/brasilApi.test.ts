import { describe, it, expect, vi, afterEach } from 'vitest'
import { lookupCnpj, lookupCep } from '../src/lib/brasilApi'

describe('brasilApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const jsonResponse = (data: unknown, status = 200) => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(data),
    } as unknown as Response
  }

  it('lookupCnpj retorna dados da empresa quando a API responde', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({
          razao_social: 'ACME LTDA',
          nome_fantasia: 'ACME',
          cnae_fiscal_descricao: 'Consultoria de gestão',
          logradouro: 'Avenida Paulista',
          numero: '1000',
          complemento: 'Andar 5',
          bairro: 'Bela Vista',
          municipio: 'São Paulo',
          uf: 'SP',
          cep: '01310100',
          email: 'contato@acme.com',
          ddd_telefone_1: '1130000000',
        }),
      )

    const result = await lookupCnpj('12.345.678/0001-99')

    expect(fetchMock).toHaveBeenCalledWith('https://brasilapi.com.br/api/cnpj/v1/12345678000199')
    expect(result?.razao_social).toBe('ACME LTDA')
    expect(result?.nome_fantasia).toBe('ACME')
    expect(result?.cep).toBe('01310100')
  })

  it('lookupCnpj retorna null quando a API responde 404 (CNPJ não encontrado)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ message: 'CNPJ não encontrado' }, 404))

    const result = await lookupCnpj('00.000.000/0001-91')

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lookupCnpj retorna null para CNPJ incompleto (sem chamar a API)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const result = await lookupCnpj('12.345.678/0001-9')
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lookupCep retorna endereço quando a API responde', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse({
          cep: '01310100',
          state: 'SP',
          city: 'São Paulo',
          neighborhood: 'Bela Vista',
          street: 'Avenida Paulista',
        }),
      )

    const result = await lookupCep('01310-100')

    expect(fetchMock).toHaveBeenCalledWith('https://brasilapi.com.br/api/cep/v1/01310100')
    expect(result?.street).toBe('Avenida Paulista')
    expect(result?.city).toBe('São Paulo')
  })

  it('lookupCep retorna null quando a API responde 404 (CEP não encontrado)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'Não encontrado' }, 404))
    const result = await lookupCep('99999999')
    expect(result).toBeNull()
  })
})