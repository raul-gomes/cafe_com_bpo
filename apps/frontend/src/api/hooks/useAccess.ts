import { useQuery } from '@tanstack/react-query';

import { getAccess } from '../access';

/**
 * Permissão de módulos, vencimento e banners (D12/§17.6).
 *
 * `staleTime` de 5 minutos porque `GET /access` só muda em evento (pagamento,
 * vencimento de beta, dunning): a tela é lida de novo a cada rota, mas o
 * servidor não precisa ser batido a cada navegação. Janela curta o bastante
 * para um pagamento refletir no banner sem reload.
 */
const ACCESS_KEY = ['access'] as const;

export const useAccess = () =>
    useQuery({
        queryKey: ACCESS_KEY,
        queryFn: getAccess,
        staleTime: 5 * 60 * 1000,
    });
