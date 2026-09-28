import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Botão "voltar" que respeita a última página vista.
 *
 * O React Router rotula a entrada inicial do histórico com a chave `'default'`
 * e gera chaves únicas para cada navegação seguinte. Então:
 * - chave diferente de `'default'` → existe página anterior dentro do app e o
 *   certo é `navigate(-1)`;
 * - chave `'default'` → o perfil foi aberto direto (F5, link compartilhado,
 *   nova aba) e `navigate(-1)` tiraria o usuário do app, então caímos no
 *   `fallback`, que precisa ser uma rota existente.
 *
 * Funciona com BrowserRouter e com MemoryRouter (nos testes), sem depender de
 * `window.history`.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }, [navigate, fallback, location.key]);
}
