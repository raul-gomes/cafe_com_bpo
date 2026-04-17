import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { TaskResponse, TaskCreate, TaskUpdate } from '../../schemas/tasks';

export const useTasks = () => {
  const queryClient = useQueryClient();

  const useTasksList = () => {
    return useQuery<TaskResponse[]>({
      queryKey: ['tasks'],
      queryFn: async () => {
        const { data } = await apiClient.get('/tasks/');
        return data;
      },
    });
  };

  const useCreateTask = () => {
    return useMutation({
      mutationFn: async (task: TaskCreate) => {
        const { data } = await apiClient.post('/tasks/', task);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  };

  const useUpdateTask = () => {
    return useMutation({
      mutationFn: async ({ id, ...task }: TaskUpdate & { id: string }) => {
        const { data } = await apiClient.put(`/tasks/${id}`, task);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  };

  const useUpdateTaskStatus = () => {
    return useMutation({
      mutationFn: async ({ id, status }: { id: string, status: string }) => {
        const { data } = await apiClient.put(`/tasks/${id}`, { status });
        return data;
      },
      onMutate: async ({ id, status }) => {
        await queryClient.cancelQueries({ queryKey: ['tasks'] });
        const previousTasks = queryClient.getQueryData<TaskResponse[]>(['tasks']);
        if (previousTasks) {
          queryClient.setQueryData<TaskResponse[]>(['tasks'], 
            previousTasks.map(t => t.id === id ? { ...t, status } : t)
          );
        }
        return { previousTasks };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousTasks) {
          queryClient.setQueryData(['tasks'], context.previousTasks);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  };

  const useUpdateClient = () => {
    return useMutation({
      mutationFn: async ({ id, color }: { id: string, color: string }) => {
        const { data } = await apiClient.put(`/clients/${id}`, { color });
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  };

  const useDeleteTask = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`/tasks/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  };

  return {
    useTasksList,
    useCreateTask,
    useUpdateTask,
    useUpdateTaskStatus,
    useUpdateClient,
    useDeleteTask,
  };
};
