/**
 * Write gate de plano (backend `src/core/entitlements.py`).
 *
 * O backend devolve 403 com este `detail` quando o usuário free tenta uma
 * escrita em módulo read-only (ex.: criar prospecto em "captar"). O frontend
 * usa o módulo como a única fonte de verdade da mensagem: o interceptor do
 * `apiClient` detecta o erro, páginas supõem que ele será tratado (o toast
 * genérico não deve aparecer) e o `UpgradeProvider` abre o modal de assinatura.
 */

/** Mensagem exata que o write gate devolve no corpo 403. */
export const PLAN_GATE_DETAIL = 'Seu plano não permite esta ação';

/**
 * Detecta se um erro de axios (ou objeto com o mesmo shape) é o write gate de
 * plano — 403 cujo `detail` bate com `PLAN_GATE_DETAIL`.
 *
 * @param error erro vindo de um catch (axios ou mock com o mesmo shape)
 * @returns `true` quando o backend recusou a escrita por limite do plano
 */
export const isPlanGateError = (error: unknown): boolean => {
  const shape = error as {
    response?: { status?: number; data?: { detail?: unknown } };
  };
  return (
    shape?.response?.status === 403 &&
    shape?.response?.data?.detail === PLAN_GATE_DETAIL
  );
};

type PlanGateListener = () => void;

const planGateListeners = new Set<PlanGateListener>();

/**
 * Assina o aviso de write gate disparado pelo `apiClient`. O `UpgradeProvider`
 * registra um único listener na raiz; testes podem assinar/desassinar à vontade.
 *
 * @param listener função chamada quando o gate de plano bloqueia uma ação
 * @returns função que cancela a assinatura
 */
export const subscribePlanGate = (listener: PlanGateListener): (() => void) => {
  planGateListeners.add(listener);
  return () => {
    planGateListeners.delete(listener);
  };
};

/**
 * Notifica os assinantes (usado pelo interceptor do `apiClient`). Descartado
 * silenciosamente quando ninguém está montado (ex.: testes de página que não
 * renderizam o `UpgradeProvider`).
 */
export const notifyPlanGate = (): void => {
  planGateListeners.forEach((listener) => listener());
};