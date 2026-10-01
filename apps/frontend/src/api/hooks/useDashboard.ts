import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface ActivityResponse {
    id: string;
    type: string;
    created_at: string;
    is_read: boolean;
    post_id?: string;
    triggered_by_name?: string;
    message_snippet?: string;
}

/** Tarefa do carrossel de urgentes. Não é o `TaskResponse`: o resumo entrega
 *  só o que o painel desenha (prazo, atraso e cliente), e o tipo completo
 *  mentiria sobre os outros campos. */
export interface UrgentTaskItem {
    id: string;
    title: string;
    client_name: string;
    deadline?: string;
    days_remaining?: number;
    is_overdue: boolean;
}

export interface PendingInvitation {
    invitation_id: string;
    client_name?: string;
    inviter_name?: string;
    created_at: string;
}

/** Os dois contadores da barra lateral. */
export interface DashboardStats {
    pending_tasks_count: number;
    unread_notifications_count: number;
}

export interface DashboardSummary {
    user_name: string;
    urgent_tasks: UrgentTaskItem[];
    activities: ActivityResponse[];
    pending_invitations: PendingInvitation[];
    stats: DashboardStats;
}

export const useDashboard = () => {
    const useDashboardSummary = () => {
        return useQuery<DashboardSummary>({
            queryKey: ['dashboard', 'summary'],
            queryFn: async () => {
                const { data } = await apiClient.get('/dashboard/summary');
                return data;
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
