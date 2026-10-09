import { useCallback } from 'react';

import { useAccess } from './useAccess';
import { useUpgrade } from '../../components/ui/UpgradeModal';

/**
 * Nomes de módulo do write gate (mesmo vocabulário de `GET /access`
 * `read_only_modules` — `src/core/entitlements.py`).
 */
export type WriteGateModule =
  | 'operacional'
  | 'comunidade'
  | 'gestao'
  | 'captar'
  | 'pagamentos';

/**
 * Guarda proativa da escrita bloqueada pelo plano, para os botões de criação.
 *
 * O backend recusa por módulo (free lê tudo e escreve só em operacional,
 * comunidade e pagamentos; captar/gestao são read-only). Em vez de deixar o
 * usuário free preencher um formulário inteiro para então receber o 403, a
 * página chama o guard no clique do botão: se o módulo do botão está em
 * `read_only_modules` do payload de `GET /access`, bloqueia na hora e abre o
 * modal de upgrade (sem enviar request), retornando `false`.
 *
 * Regressão segura: `access` indefinido (carga/falha) **não** bloqueia — o
 * interceptor do `apiClient` continua sendo a autoridade final e abre o modal
 * quando o backend responder 403. Nunca travar um botão que o backend libera
 * (ex.: `operacional`, gravável por free).
 *
 * @param module Módulo do write gate que o botão escreve (`captar`/`gestao`).
 * @returns função-teste: `true` para seguir o fluxo, `false` bloqueado.
 */
export const useWriteGate = (module: WriteGateModule): (() => boolean) => {
  const { open } = useUpgrade();
  const { data: access } = useAccess();

  return useCallback(() => {
    if (!access || !access.read_only_modules.includes(module)) {
      return true;
    }
    open();
    return false;
  }, [access, module, open]);
};