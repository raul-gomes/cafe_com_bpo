import { describe, expect, it } from 'vitest';

import { User } from '../src/context/AuthContext';
import {
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  resolveBrandColors,
  resolveProviderTitle,
} from '../src/lib/brandColors';

describe('resolveBrandColors', () => {
  it('usa as cores do perfil quando presentes', () => {
    const provider = {
      company_color_code: '#ff0000',
      company_color_secondary: '#00ff00',
    } as User;

    expect(resolveBrandColors(provider)).toEqual({
      primary: '#ff0000',
      secondary: '#00ff00',
    });
  });

  it('cai no padrão do modelo whitelabel sem provider', () => {
    expect(resolveBrandColors(null)).toEqual({
      primary: DEFAULT_PRIMARY,
      secondary: DEFAULT_SECONDARY,
    });
  });

  it('preenche apenas a cor ausente', () => {
    const provider = { company_color_code: '#123456' } as User;

    expect(resolveBrandColors(provider)).toEqual({
      primary: '#123456',
      secondary: DEFAULT_SECONDARY,
    });
  });
});

describe('resolveProviderTitle', () => {
  it('prioriza o nome fantasia', () => {
    const provider = {
      company_nome_fantasia: 'Contabilidade Alpha',
      company_razao_social: 'Alpha Serviços LTDA',
      name: 'Raul Gomes',
    } as User;

    expect(resolveProviderTitle(provider)).toEqual({
      title: 'Contabilidade Alpha',
      requiresChoice: false,
    });
  });

  it('usa a razão social quando não há nome fantasia', () => {
    const provider = {
      company_razao_social: 'Alpha Serviços LTDA',
      name: 'Raul Gomes',
    } as User;

    expect(resolveProviderTitle(provider)).toEqual({
      title: 'Alpha Serviços LTDA',
      requiresChoice: false,
    });
  });

  it('sem nome empresarial pede escolha e sugere o nome pessoal', () => {
    const provider = { name: 'Raul Gomes' } as User;

    expect(resolveProviderTitle(provider)).toEqual({
      title: '',
      requiresChoice: true,
      personalName: 'Raul Gomes',
    });
  });

  it('usuário anônimo fica em branco sem pedir escolha', () => {
    expect(resolveProviderTitle(null)).toEqual({
      title: '',
      requiresChoice: false,
    });
  });

  it('ignora campos só com espaços', () => {
    const provider = {
      company_nome_fantasia: '   ',
      company_razao_social: '',
      name: 'Raul Gomes',
    } as User;

    expect(resolveProviderTitle(provider)).toEqual({
      title: '',
      requiresChoice: true,
      personalName: 'Raul Gomes',
    });
  });
});
