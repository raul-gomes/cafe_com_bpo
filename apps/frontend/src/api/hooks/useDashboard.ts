import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { TaskResponse } from '../../schemas/tasks';

export interface ActivityResponse {
    id: string;
    type: string;
    created_at: string;
    is_read: boolean;
    post_id?: string;
    comment_id?: string;
    triggered_by_name?: string;
    message_snippet?: string;
}

export interface UrgentTaskItem extends TaskResponse {
    client_name?: string;
    days_remaining?: number | null;
    is_overdue?: boolean;
}

export interface PendingInvitation {
    invitation_id: string;
    client_id?: string;
    client_name?: string;
    inviter_name?: string;
    created_at: string;
    expires_at: string;
}

export interface DashboardSummary {
    user_name: string;
    urgent_tasks: UrgentTaskItem[];
    activities: ActivityResponse[];
    pending_invitations: PendingInvitation[];
    stats: {
        pending_tasks_count?: number;
        unread_notifications_count?: number;
        [key: string]: any;
    };
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
