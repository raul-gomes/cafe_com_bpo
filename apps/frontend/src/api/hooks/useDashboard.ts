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
    triggered_by_name: string;
    message_snippet?: string;
}

export interface DashboardSummary {
    user_name: string;
    urgent_tasks: (TaskResponse & { client_name?: string })[];
    activities: ActivityResponse[];
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
        });
    };

    return {
        useDashboardSummary,
    };
};
