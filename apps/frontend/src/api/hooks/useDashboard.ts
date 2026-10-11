import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import {
    type ActivityItem,
    type DashboardStats,
    type DashboardSummary,
    dashboardSummarySchema,
    type PendingInvitationItem,
    type UrgentTaskItem,
} from '../../schemas/dashboard';

/** O contrato vive em `schemas/dashboard.ts`, com validação em runtime: o tipo
 *  sai do schema pelo `z.infer`, então página e servidor não podem divergir sem
 *  que o teste acuse. As interfaces escritas à mão conferiam só o que o próprio
 *  TypeScript escrevia — um campo que saísse do backend chegaria na tela e o
 *  tipo continuaria afirmando que ele existia. */
export type {
    ActivityItem,
    DashboardStats,
    DashboardSummary,
    PendingInvitationItem,
    UrgentTaskItem,
};

/** Aliases dos nomes antigos, para não espalhar o rename por três arquivos: o
 *  que muda aqui é a origem do tipo, não o nome que a página importa. */
export type ActivityResponse = ActivityItem;
export type PendingInvitation = PendingInvitationItem;

export const useDashboard = () => {
    const useDashboardSummary = () => {
        return useQuery<DashboardSummary>({
            queryKey: ['dashboard', 'summary'],
            queryFn: async () => {
                const { data } = await apiClient.get('/dashboard/summary');
                return dashboardSummarySchema.parse(data);
            },
            // Mantém o dashboard sempre refletindo o estado atual do fórum e do gestor
            refetchInterval: 30000,
            refetchOnWindowFocus: true,
        });
    };

    return {
        useDashboardSummary,
    };
};
