import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { AppNotificationResponse, UnreadCountResponse } from '../../schemas/notifications';

export const useAppNotifications = () => {
  const queryClient = useQueryClient();

  const useNotificationsList = (typeFilter?: string, unreadOnly = false) => {
    return useQuery<AppNotificationResponse[]>({
      queryKey: ['app-notifications', typeFilter, unreadOnly],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (typeFilter) params.set('type', typeFilter);
        if (unreadOnly) params.set('unread_only', 'true');
        const { data } = await apiClient.get(`/notifications/?${params}`);
        return data;
      },
    });
  };

  const useUnreadCount = () => {
    return useQuery<UnreadCountResponse>({
      queryKey: ['app-notifications-unread'],
      queryFn: async () => {
        const { data } = await apiClient.get('/notifications/unread-count');
        return data;
      },
      refetchInterval: 30000,
    });
  };

  const useMarkAsRead = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await apiClient.put(`/notifications/${id}/read`);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['app-notifications'] });
        queryClient.invalidateQueries({ queryKey: ['app-notifications-unread'] });
      },
    });
  };

  const useMarkAllAsRead = () => {
    return useMutation({
      mutationFn: async () => {
        const { data } = await apiClient.post('/notifications/mark-all-read');
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['app-notifications'] });
        queryClient.invalidateQueries({ queryKey: ['app-notifications-unread'] });
      },
    });
  };

  const useDeleteNotification = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`/notifications/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['app-notifications'] });
        queryClient.invalidateQueries({ queryKey: ['app-notifications-unread'] });
      },
    });
  };

  return {
    useNotificationsList,
    useUnreadCount,
    useMarkAsRead,
    useMarkAllAsRead,
    useDeleteNotification,
  };
};
