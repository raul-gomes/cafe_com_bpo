import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export const useNotifications = () => {
  const queryClient = useQueryClient();

  const useMarkAsRead = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.patch(`/api/network/notifications/${id}/read`);
      },
      onSuccess: () => {
        // Invalidate both notifications and dashboard summary
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      },
    });
  };

  return {
    useMarkAsRead,
  };
};
