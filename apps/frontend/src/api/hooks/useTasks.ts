import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { TaskResponse, TaskCreate, TaskUpdate, RoutineResponse, RoutineCreate, TaskPhaseResponse, TaskPhaseCreate, TaskPhaseUpdate, TaskAIAnalyzeResponse, TaskAISuggestion, TimelineResponse, ConflictsResponse } from '../../schemas/tasks';

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

  const useRoutinesList = () => {
    return useQuery<RoutineResponse[]>({
      queryKey: ['routines'],
      queryFn: async () => {
        const { data } = await apiClient.get('/tasks/rotinas');
        return data;
      },
    });
  };

  const useCreateRoutine = () => {
    return useMutation({
      mutationFn: async (routine: RoutineCreate) => {
        const { data } = await apiClient.post('/tasks/rotinas', routine);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['routines'] });
      },
    });
  };

  const useDeleteRoutine = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`/tasks/rotinas/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['routines'] });
      },
    });
  };

  const useGenerateRoutineTasks = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await apiClient.post(`/tasks/rotinas/${id}/generate`);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['routines'] });
      },
    });
  };

  const usePhases = () => {
    return useQuery<TaskPhaseResponse[]>({
      queryKey: ['task-phases'],
      queryFn: async () => {
        const { data } = await apiClient.get('/tasks/phases/');
        return data;
      },
    });
  };

  const useCreatePhase = () => {
    return useMutation({
      mutationFn: async (phase: TaskPhaseCreate) => {
        const { data } = await apiClient.post('/tasks/phases/', phase);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['task-phases'] });
      },
    });
  };

  const useUpdatePhase = () => {
    return useMutation({
      mutationFn: async ({ id, ...phase }: TaskPhaseUpdate & { id: string }) => {
        const { data } = await apiClient.put(`/tasks/phases/${id}`, phase);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['task-phases'] });
      },
    });
  };

  const useDeletePhase = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`/tasks/phases/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['task-phases'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  };

  const useReorderPhases = () => {
    return useMutation({
      mutationFn: async (phases: { id: string; order: number }[]) => {
        const { data } = await apiClient.post('/tasks/phases/reorder', { phases });
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['task-phases'] });
      },
    });
  };

  const useTimeline = (startDate?: string, endDate?: string) => {
    return useQuery<TimelineResponse>({
      queryKey: ['tasks-timeline', startDate, endDate],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        const { data } = await apiClient.get(`/tasks/timeline/?${params}`);
        return data;
      },
    });
  };

  const useConflicts = (maxHours = 8) => {
    return useQuery<ConflictsResponse>({
      queryKey: ['tasks-conflicts', maxHours],
      queryFn: async () => {
        const { data } = await apiClient.get(`/tasks/conflicts/?max_hours=${maxHours}`);
        return data;
      },
    });
  };

  const useAnalyzeTask = () => {
    return useMutation({
      mutationFn: async (task: { title: string; description?: string; process_type?: string }) => {
        const { data } = await apiClient.post('/tasks/ai/analyze', task);
        return data as TaskAIAnalyzeResponse;
      },
    });
  };

  const useTaskSuggestions = () => {
    return useQuery<{ suggestions: TaskAISuggestion[] }>({
      queryKey: ['task-suggestions'],
      queryFn: async () => {
        const { data } = await apiClient.get('/tasks/ai/suggestions');
        return data;
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
    useRoutinesList,
    useCreateRoutine,
    useDeleteRoutine,
    useGenerateRoutineTasks,
    usePhases,
    useCreatePhase,
    useUpdatePhase,
    useDeletePhase,
    useReorderPhases,
    useTimeline,
    useConflicts,
    useAnalyzeTask,
    useTaskSuggestions,
  };
};
