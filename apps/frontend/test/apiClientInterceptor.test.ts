import { afterEach, describe, expect, it, vi } from 'vitest';
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { apiClient, tokenStorage } from '../src/api/client';
import { PLAN_GATE_DETAIL, subscribePlanGate } from '../src/api/planGate';

describe('interceptor 401 do apiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    tokenStorage.clearToken();
    delete apiClient.defaults.adapter;
  });

  // Adapters customizados devem rejeitar manualmente (validateStatus não roda)
  const respondWith = (status: number, body: unknown) => (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (status < 400) {
      return Promise.resolve({
        data: body,
        status,
        statusText: String(status),
        headers: {},
        config,
      });
    }
    const err = Object.assign(new Error('Request failed'), {
      config,
      response: { data: body, status, statusText: String(status), headers: {}, config },
    });
    return Promise.reject(err);
  };

  it('faz upload de FormData SEM Content-Type default global (evita 422 no avatar/logo)', () => {
    // Regressão: o Content-Type default 'application/json' no instance level era
    // enviado junto com FormData, fazendo o FastAPI ignorar o multipart → 422.
    expect(apiClient.defaults.headers['Content-Type']).toBeUndefined();
  });

  it('falha de login NÃO dispara refresh e preserva a mensagem original', async () => {
    const postSpy = vi.spyOn(axios, 'post');
    apiClient.defaults.adapter = respondWith(401, { detail: 'Credenciais inválidas' });

    await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject({
      response: { data: { detail: 'Credenciais inválidas' } },
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('401 em endpoint protegido dispara o fluxo de refresh', async () => {
    const postSpy = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { access_token: 'novo-token' } });

    let call = 0;
    apiClient.defaults.adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      call += 1;
      if (call === 1) {
        const err = Object.assign(new Error('Request failed'), {
          config,
          response: { data: {}, status: 401, statusText: '401', headers: {}, config },
        });
        return Promise.reject(err);
      }
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: '200',
        headers: {},
        config,
      });
    };

    // Rota fora de /login para não redirecionar no jsdom
    window.history.replaceState(null, '', '/painel');

    await expect(apiClient.get('/tasks')).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      {},
      expect.objectContaining({ withCredentials: true }),
    );
    expect(tokenStorage.getToken()).toBe('novo-token');
  });

  it('403 do write gate notifica o modal de upgrade', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlanGate(listener);
    try {
      apiClient.defaults.adapter = respondWith(403, { detail: PLAN_GATE_DETAIL });
      await expect(apiClient.post('/prospects', {})).rejects.toThrow('Request failed');
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('403 com outro detail NÃO notifica o modal de upgrade', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlanGate(listener);
    try {
      apiClient.defaults.adapter = respondWith(403, { detail: 'Você não tem permissão' });
      await expect(apiClient.get('/prospects')).rejects.toThrow('Request failed');
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
