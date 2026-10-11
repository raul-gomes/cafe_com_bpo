import { describe, expect, it } from 'vitest';

import { clientSchema } from '../src/schemas/clients';

/**
 * Contrato de payload de `clients` (regra §6).
 *
 * `ClientData` era uma `interface` escrita à mão e a resposta era devolvida com
 * `as ClientData[]` — sem validação nenhuma. Um campo que o backend parasse de
 * enviar, ou que voltasse a enviar, entrava na tela sem reclamar; e a tipagem
 * prometia ao compilador campos que ninguém lia.
 *
 * Aqui o contrato tem um lugar só (o schema) e o `.strict()` faz a deriva
 * virar erro: `user_id`, `created_at` e `updated_at` saíram do payload porque
 * a tela não os renderiza, e a lista é das empresas do próprio usuário — o dono
 * já está implícito.
 */

const CLIENTE = {
    id: 'c-1',
    name: 'Empresa Alfa',
    cnpj: '39123456000180',
    phone: '11987654321',
    email: 'contato@alfa.com',
    segment: 'Financeiro',
    city: 'São Paulo',
    state: 'SP',
};

describe('contrato de clients', () => {
    it('aceita o cadastro mínimo que a tela de empresas renderiza', () => {
        expect(clientSchema.parse({ id: 'c-1', name: 'Empresa Alfa' })).toEqual({
            id: 'c-1',
            name: 'Empresa Alfa',
        });
    });

    it('aceita a empresa completa, com contato e endereço', () => {
        expect(clientSchema.parse(CLIENTE)).toEqual(CLIENTE);
    });

    it('aceita os campos opcionais nulos, como o backend envia', () => {
        const empresa = { ...CLIENTE, cnpj: null, phone: null, color: null };
        expect(clientSchema.parse(empresa)).toEqual(empresa);
    });

    it('rejeita os campos de auditoria que saíram do payload', () => {
        for (const extra of [
            { user_id: 'u-1' },
            { created_at: '2026-01-01T00:00:00Z' },
            { updated_at: '2026-01-01T00:00:00Z' },
        ]) {
            expect(() => clientSchema.parse({ ...CLIENTE, ...extra })).toThrow();
        }
    });

    it('exige id e name: são o que a tela usa para chavear e titular a linha', () => {
        expect(() => clientSchema.parse({ name: 'Sem id' })).toThrow();
        expect(() => clientSchema.parse({ id: 'c-1' })).toThrow();
    });
});
