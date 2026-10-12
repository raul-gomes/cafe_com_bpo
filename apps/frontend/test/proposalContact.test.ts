import { describe, it, expect } from 'vitest'
import { resolveProposalContact } from '../src/lib/proposalContact'

const clients = [{ id: 'c1', name: 'Empresa Exemplo', email: 'cliente@exemplo.com', phone: '11988887777' }]
const prospects = [{ id: 'p1', name: 'Empresa Exemplo', representante_email: 'lead@exemplo.com', representante_telefone: '11977776666' }]

describe('proposal recipient (AUD-022)', () => {
  it('follows the company link, even when a client has the same name', () => {
    expect(resolveProposalContact({ client_name: 'Empresa Exemplo', company_id: 'p1' }, clients, prospects)).toEqual({
      name: 'Empresa Exemplo',
      email: 'lead@exemplo.com',
      phone: '11977776666',
    })
  })

  it('uses the name only for legacy proposals, and only when it is unambiguous', () => {
    expect(resolveProposalContact({ client_name: 'empresa exemplo ' }, clients, [])?.email).toBe('cliente@exemplo.com')
    expect(resolveProposalContact({ client_name: 'Empresa Exemplo' }, clients, prospects)).toBeNull()
  })

  it('returns null when the linked company is not found', () => {
    expect(resolveProposalContact({ client_name: 'X', company_id: 'gone' }, clients, prospects)).toBeNull()
  })
})
