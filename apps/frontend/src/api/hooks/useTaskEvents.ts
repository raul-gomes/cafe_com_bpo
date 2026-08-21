import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '../client';

/**
 * Hook that connects to the SSE endpoint for real-time updates.
 * Handles both task phase changes and team management changes.
 *
 * - task_updates: invalidates ['tasks'] so boards update card positions
 * - team_updates: invalidates ['tasks'] so operator boards reflect
 *   routine/member/invitation changes (add/remove/revoke/deactivate)
 *
 * Usage: call useTaskEvents() in the component that renders the board.
 */
export const useTaskEvents = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/tasks/events`;
    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const channel = payload.channel;

        if (channel === 'task_updates') {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        } else if (channel === 'team_updates') {
          // Team changes affect which tasks the operator can see
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      } catch {
        // Fallback: invalidate everything
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    };

    es.onerror = () => {
      console.warn('[SSE] Connection error, will retry...');
    };

    return () => {
      es.close();
    };
  }, [queryClient]);
};
