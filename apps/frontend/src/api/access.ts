import { apiClient } from './client';

import { accessSchema, type Access } from '../schemas/access';

/**
 * O contrato vive em `schemas/access.ts`, com validação em runtime: o tipo sai
 * do schema pelo `z.infer`, então a tela e o servidor não divergem sem que o
 * teste acuse. Campos datados atravessam como string e são formatados em UTC
 * onde aparecem — o backend grava `expires_at` em UTC.
 */

/** Permissão de módulos, vencimento e banners para a sessão atual. */
export const getAccess = async (): Promise<Access> => {
    const response = await apiClient.get('/access');
    return accessSchema.parse(response.data);
};
