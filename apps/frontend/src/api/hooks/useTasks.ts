import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import {
  TaskResponse, TaskCreate, TaskUpdate,
  TaskPhaseResponse, TaskPhaseCreate, TaskPhaseUpdate,
  TimelineResponse, ConflictsResponse,
  ActivityTemplateListItem, ActivityTemplateResponse,
  ActivityTemplateCreate, ActivityTemplateUpdate,
  TemplateActivityCreate, TemplateActivityUpdate,
  ClientTemplateAssignmentCreate, ClientTemplateAssignmentResponse,
  RoutineTypeResponse, RoutineTypeCreate, RoutineTypeUpdate,
  ClientSLAResponse, ClientSLACreate, ClientSLAUpdate,
  TaskAttachmentResponse,
  ClientTimelineResponse,
  SLAAlertsResponse,
} from '../../schemas/tasks';

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
      mutationFn: async ({ id, phase_id, status }: { id: string, phase_id?: string, status?: string }) => {
        const payload: Record<string, any> = {};
        if (phase_id) payload.phase_id = phase_id;
        if (status) payload.status = status;
        const { data } = await apiClient.put(`/tasks/${id}`, payload);
        return data;
      },
      onMutate: async ({ id, phase_id, status }) => {
        await queryClient.cancelQueries({ queryKey: ['tasks'] });
        const previousTasks = queryClient.getQueryData<TaskResponse[]>(['tasks']);
        if (previousTasks) {
          queryClient.setQueryData<TaskResponse[]>(['tasks'], 
            previousTasks.map(t => t.id === id ? { ...t, phase_id: phase_id || t.phase_id, status: status || t.status } : t)
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

  const useCancelTask = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await apiClient.put(`/tasks/${id}/cancel`);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
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

  // ── Activity Template Hooks ──

  const useTemplatesList = () => {
    return useQuery<ActivityTemplateListItem[]>({
      queryKey: ['task-templates'],
      queryFn: async () => {
        const { data } = await apiClient.get('/tasks/templates/');
        return data;
      },
    });
  };

  const useTemplate = (id: string) => {
    return useQuery<ActivityTemplateResponse>({
      queryKey: ['task-templates', id],
      queryFn: async () => {
        const { data } = await apiClient.get(`/tasks/templates/${id}`);
        return data;
      },
      enabled: !!id,
    });
  };

  const useCreateTemplate = () => {
    return useMutation({
      mutationFn: async (template: ActivityTemplateCreate) => {
        const { data } = await apiClient.post('/tasks/templates/', template);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      },
    });
  };

  const useUpdateTemplate = () => {
    return useMutation({
      mutationFn: async ({ id, ...template }: ActivityTemplateUpdate & { id: string }) => {
        const { data } = await apiClient.put(`/tasks/templates/${id}`, template);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      },
    });
  };

  const useDeleteTemplate = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`/tasks/templates/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      },
    });
  };

  // ── Template Activity Hooks ──

  const useCreateActivity = () => {
    return useMutation({
      mutationFn: async ({ template_id, ...activity }: TemplateActivityCreate & { template_id: string }) => {
        const { data } = await apiClient.post(`/tasks/templates/${template_id}/activities/`, activity);
        return data;
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['task-templates', variables.template_id] });
      },
    });
  };

  const useUpdateActivity = () => {
    return useMutation({
      mutationFn: async ({ template_id, id, ...activity }: TemplateActivityUpdate & { template_id: string; id: string }) => {
        const { data } = await apiClient.put(`/tasks/templates/${template_id}/activities/${id}`, activity);
        return data;
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['task-templates', variables.template_id] });
      },
    });
  };

  const useDeleteActivity = () => {
    return useMutation({
      mutationFn: async ({ template_id, id }: { template_id: string; id: string }) => {
        await apiClient.delete(`/tasks/templates/${template_id}/activities/${id}`);
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['task-templates', variables.template_id] });
      },
    });
  };

  const useReorderActivities = () => {
    return useMutation({
      mutationFn: async ({ template_id, ordered_ids }: { template_id: string; ordered_ids: string[] }) => {
        const { data } = await apiClient.post(`/tasks/templates/${template_id}/activities/reorder`, ordered_ids);
        return data;
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['task-templates', variables.template_id] });
      },
    });
  };

  // ── Client Template Assignment Hooks ──

  const useAssignTemplate = () => {
    return useMutation({
      mutationFn: async (assignment: ClientTemplateAssignmentCreate) => {
        const { data } = await apiClient.post('/tasks/client-templates/', assignment);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['client-assignments'] });
      },
    });
  };

  const useClientAssignments = (client_id: string) => {
    return useQuery<ClientTemplateAssignmentResponse[]>({
      queryKey: ['client-assignments', client_id],
      queryFn: async () => {
        const { data } = await apiClient.get(`/tasks/client-templates/?client_id=${client_id}`);
        return data;
      },
      enabled: !!client_id,
    });
  };

  const useRemoveAssignment = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`/tasks/client-templates/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['client-assignments'] });
      },
    });
  };

  const useRegenerateClientTasks = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await apiClient.post(`/tasks/client-templates/${id}/regenerate`);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  };

  // ── SLA Hooks ──

  const useClientSLAs = (client_id: string) => {
    return useQuery<ClientSLAResponse[]>({
      queryKey: ['client-slas', client_id],
      queryFn: async () => {
        const { data } = await apiClient.get(`/tasks/sla/?client_id=${client_id}`);
        return data;
      },
      enabled: !!client_id,
    });
  };

  const useCreateSLA = () => {
    return useMutation({
      mutationFn: async (sla: ClientSLACreate) => {
        const { data } = await apiClient.post('/tasks/sla/', sla);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['client-slas'] });
      },
    });
  };

  const useUpdateSLA = () => {
    return useMutation({
      mutationFn: async ({ id, ...sla }: ClientSLAUpdate & { id: string }) => {
        const { data } = await apiClient.put(`/tasks/sla/${id}`, sla);
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['client-slas'] });
      },
    });
  };

  const useDeleteSLA = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`/tasks/sla/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['client-slas'] });
      },
    });
  };

  // ── Client Timeline Hook ──

  const useClientTimeline = (client_id: string, month?: string) => {
    return useQuery<ClientTimelineResponse>({
      queryKey: ['client-timeline', client_id, month],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (month) params.set('month', month);
        const { data } = await apiClient.get(`/tasks/client-timeline/${client_id}?${params}`);
        return data;
      },
      enabled: !!client_id,
    });
  };

  // ── Attachment Hooks ──

  const useTaskAttachments = (task_id: string) => {
    return useQuery<TaskAttachmentResponse[]>({
      queryKey: ['task-attachments', task_id],
      queryFn: async () => {
        const { data } = await apiClient.get(`/tasks/${task_id}/attachments/`);
        return data;
      },
      enabled: !!task_id,
    });
  };

  const useUploadAttachment = () => {
    return useMutation({
      mutationFn: async ({ task_id, file }: { task_id: string; file: File }) => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await apiClient.post(`/tasks/${task_id}/attachments/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['task-attachments', variables.task_id] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  };

  const useDeleteAttachment = () => {
    return useMutation({
      mutationFn: async ({ task_id, id }: { task_id: string; id: string }) => {
        await apiClient.delete(`/tasks/${task_id}/attachments/${id}`);
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['task-attachments', variables.task_id] });
      },
    });
  };

  // ── Email Hook ──

  const useSendTaskEmail = () => {
    return useMutation({
      mutationFn: async ({ task_id, subject, body, attachment_ids }: {
        task_id: string; subject: string; body: string; attachment_ids: string[];
      }) => {
        const { data } = await apiClient.post(`/tasks/${task_id}/send-email`, {
          subject, body, attachment_ids,
        });
        return data;
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['task-attachments', variables.task_id] });
      },
    });
  };

  // ── SLA Alerts Hook ──

  const useSLAAlerts = () => {
    return useQuery<SLAAlertsResponse>({
      queryKey: ['sla-alerts'],
      queryFn: async () => {
        const { data } = await apiClient.get('/tasks/alerts/sla');
        return data;
      },
      refetchInterval: 60000, // refresh every minute
    });
  };

  return {
    useTasksList,
    useCreateTask,
    useUpdateTask,
    useUpdateTaskStatus,
    useUpdateClient,
    useDeleteTask,
    useCancelTask,
    usePhases,
    useCreatePhase,
    useUpdatePhase,
    useDeletePhase,
    useReorderPhases,
    useTimeline,
    useConflicts,
    useTemplatesList,
    useTemplate,
    useCreateTemplate,
    useUpdateTemplate,
    useDeleteTemplate,
    useCreateActivity,
    useUpdateActivity,
    useDeleteActivity,
    useReorderActivities,
    useAssignTemplate,
    useClientAssignments,
    useRemoveAssignment,
    useRegenerateClientTasks,
    useClientSLAs,
    useCreateSLA,
    useUpdateSLA,
    useDeleteSLA,
    useClientTimeline,
    useTaskAttachments,
    useUploadAttachment,
    useDeleteAttachment,
    useSendTaskEmail,
    useSLAAlerts,

    // ── RoutineType ──
    useRoutineTypes: () => {
      return useQuery<RoutineTypeResponse[]>({
        queryKey: ['routineTypes'],
        queryFn: async () => {
          const { data } = await apiClient.get('/tasks/routine-types/');
          return data;
        },
      });
    },

    useCreateRoutineType: () => {
      return useMutation({
        mutationFn: async (input: RoutineTypeCreate) => {
          const { data } = await apiClient.post('/tasks/routine-types/', input);
          return data as RoutineTypeResponse;
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['routineTypes'] });
        },
      });
    },

    useUpdateRoutineType: () => {
      return useMutation({
        mutationFn: async ({ id, ...input }: RoutineTypeUpdate & { id: string }) => {
          const { data } = await apiClient.put(`/tasks/routine-types/${id}`, input);
          return data as RoutineTypeResponse;
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['routineTypes'] });
        },
      });
    },

    useDeleteRoutineType: () => {
      return useMutation({
        mutationFn: async (id: string) => {
          await apiClient.delete(`/tasks/routine-types/${id}`);
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['routineTypes'] });
        },
      });
    },
  };
};
