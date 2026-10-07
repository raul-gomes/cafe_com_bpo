import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getBillingProfile, saveBillingProfile } from '../subscription';
import type { BillingDataInput } from '../../schemas/subscription';

/**
 * Dados de cobrança do assinante (bloco do meio da seção Pagamentos).
 *
 * A falta de perfil é um estado normal — nunca salvo dá 404 e o hook devolve
 * `null`, para a tela pedir os dados antes de assinar. `staleTime` de 5 minutos
 * como no `GET /access`: o perfil só muda quando o próprio usuário salva.
 */
const PROFILE_KEY = ['billing', 'profile'] as const;

export const useBillingProfile = () =>
    useQuery({
        queryKey: PROFILE_KEY,
        queryFn: async () => {
            try {
                return await getBillingProfile();
            } catch (error) {
                if (
                    (error as { response?: { status?: number } }).response?.status === 404
                ) {
                    return null;
                }
                throw error;
            }
        },
        staleTime: 5 * 60 * 1000,
    });

export const useSaveBillingProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: BillingDataInput) => saveBillingProfile(data),
        onSuccess: (profile) => {
            void queryClient.setQueryData(PROFILE_KEY, profile);
            void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
            toast.success('Dados de cobrança salvos.');
        },
    });
};