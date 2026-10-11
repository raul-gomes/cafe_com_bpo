import { apiClient } from './client';

import {
    type Deal,
    type DealStatus,
    type GovernancaResponse,
    governancaResponseSchema,
} from '../schemas/governanca';

/** O contrato vive em `schemas/governanca.ts`, com validação em runtime: o tipo
 *  sai do schema pelo `z.infer`, então a tela e o servidor não podem divergir sem
 *  que o teste acuse. As interfaces estavam aqui e conferiam só o palpite do
 *  autor contra ele mesmo. */
export type {
    Deal,
    DealStatus,
    GovernancaResponse,
};
export type { DealAppearance, DealContract, DealProposal, TimelineEvent } from '../schemas/governanca';

export const getGovernanca = async () => {
    const response = await apiClient.get('/governanca/deals');
    return governancaResponseSchema.parse(response.data);
};
