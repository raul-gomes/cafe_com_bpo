export interface TaskResponse {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description?: string;
  priority: string;
  process_type?: string;
  deadline?: string;
  phase_id?: string;
  phase?: TaskPhaseResponse | null;
  time_estimate_minutes?: number;
  notes?: string;
  template_id?: string;
  assignment_id?: string;
  template_name?: string;
  moved_by?: string;
  moved_by_name?: string;
  assignee_name?: string;
  client_name?: string;
  client_color?: string;
  cancelled_at?: string;
  is_cancelled: boolean;
  completed_at?: string;
  deleted_at?: string;
  /** Estado derivado no servidor (regra de calendário em `src/core/deadline`).
   *  O front não re-deriva: mesma tarefa, mesmo veredito em qualquer tela. */
  is_overdue: boolean;
  days_remaining?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  client_id: string;
  priority?: string;
  process_type?: string;
  deadline?: string;
  phase_id?: string;
  time_estimate_minutes?: number;
  notes?: string;
}

/** Partial update: omitted fields stay as stored; null clears an optional field. */
export interface TaskUpdate {
  title?: string;
  description?: string | null;
  client_id?: string;
  priority?: string;
  process_type?: string;
  deadline?: string | null;
  phase_id?: string;
  time_estimate_minutes?: number | null;
  notes?: string | null;
}

export interface TaskPhaseResponse {
  id: string;
  name: string;
  color: string;
  order: number;
  is_done: boolean;
  is_default: boolean;
  created_at: string;
}

export interface TimelineTask {
  id: string;
  title: string;
  client_id: string;
  deadline?: string;
  time_estimate_minutes?: number;
  priority: string;
  process_type?: string;
  phase?: TaskPhaseResponse | null;
}

export interface TimelineDay {
  date: string;
  tasks: TimelineTask[];
  total_minutes: number;
}

export interface TimelineResponse {
  timeline: TimelineDay[];
}

export interface ConflictTask {
  id: string;
  title: string;
  time_estimate_minutes?: number;
  deadline?: string;
}

export interface ConflictResponse {
  date: string;
  tasks: ConflictTask[];
  total_minutes: number;
}

export interface ConflictsResponse {
  conflicts: ConflictResponse[];
}

// ── Activity Templates ──

// ── RoutineType ──

export interface RoutineTypeResponse {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  suggestions?: string[];
  created_at: string;
}

export interface RoutineTypeCreate {
  name: string;
  color?: string;
  suggestions?: string[];
}

export interface RoutineTypeUpdate {
  name?: string;
  color?: string;
  suggestions?: string[];
}

/**
 * Dia da semana no contrato da API (P-5).
 *
 * O backend é dono do mapeamento e manda o enum como string; o frontend nunca
 * converte número em dia — era aí que nascia o off-by-one do `weekday_mask`.
 * `saturday` e `sunday` existem para exibição de rotinas antigas; o seletor de
 * dias é `SELECTABLE_WEEKDAYS` (seg–sex, só dia útil, por decisão do dono).
 */
export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** Dias que o produto permite marcar — seg a sex. */
export const SELECTABLE_WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

/** Rótulos em português para exibir os dias. */
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

export interface ActivityTemplateListItem {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  process_type?: string;
  recurrence: string;
  weekdays?: Weekday[];
  due_day?: number;
  due_month?: number;
  due_days_from_start?: number;
  is_active: boolean;
  is_general?: boolean;
  is_archived?: boolean;
  is_overdue?: boolean;
  days_overdue?: number;
  activity_count: number;
  routine_type_id?: string;
  routine_type_name?: string;
  routine_type_color?: string;
}

export interface TemplateActivityResponse {
  id: string;
  name: string;
  description?: string;
  priority: string;
  estimated_minutes?: number;
  order: number;
}

export interface ActivityTemplateResponse {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  process_type?: string;
  recurrence: string;
  weekdays?: Weekday[];
  due_day?: number;
  due_month?: number;
  due_days_from_start?: number;
  is_active: boolean;
  is_general: boolean;
  is_archived?: boolean;
  routine_type_id?: string;
  routine_type_name?: string;
  routine_type_color?: string;
  activities: TemplateActivityResponse[];
}

export interface ActivityTemplateCreate {
  name: string;
  description?: string;
  process_type?: string;
  recurrence?: string;
  weekdays?: Weekday[];
  due_day?: number;
  due_month?: number;
  due_days_from_start?: number;
  due_date?: string;
  recurrence_end_date?: string;
  is_active?: boolean;
  is_general?: boolean;
  routine_type_id?: string;
}

export interface ActivityTemplateUpdate {
  name?: string;
  description?: string;
  process_type?: string;
  recurrence?: string;
  weekdays?: Weekday[];
  due_day?: number;
  due_month?: number;
  due_days_from_start?: number;
  due_date?: string;
  recurrence_end_date?: string;
  is_active?: boolean;
  is_archived?: boolean;
  routine_type_id?: string;
}

export interface TemplateActivityCreate {
  name: string;
  description?: string;
  priority?: string;
  due_day?: number;
  due_days?: number;
  estimated_minutes?: number;
  order?: number;
  phase_id?: string;
}

export interface TemplateActivityUpdate {
  name?: string;
  description?: string;
  priority?: string;
  due_day?: number;
  due_days?: number;
  estimated_minutes?: number;
  order?: number;
  phase_id?: string;
}

// ── Client Template Assignment ──

export interface ClientTemplateAssignmentCreate {
  client_id: string;
  template_id: string;
  start_date?: string;
}

export interface ClientTemplateAssignmentUpdate {
  is_active?: boolean;
}

export interface ClientTemplateAssignmentResponse {
  id: string;
  client_id: string;
  template_id: string;
  is_active: boolean;
}

/** Resposta de vincular uma rotina a um cliente: o vínculo e as tarefas geradas. */
export interface ClientTemplateAssignResponse {
  assignment_id: string;
  tasks_generated: number;
}

/** Resposta de regerar as tarefas de um vínculo: quantas foram criadas. */
export interface ClientTemplateRegenerateResponse {
  tasks_generated: number;
}

// ── SLA ──

export interface ClientSLACreate {
  client_id: string;
  process_type: string;
  sla_days: number;
  warning_threshold: number;
}

export interface ClientSLAUpdate {
  sla_days?: number;
  warning_threshold?: number;
}

export interface ClientSLAResponse {
  id: string;
  client_id: string;
  user_id: string;
  process_type: string;
  sla_days: number;
  warning_threshold: number;
  created_at: string;
  updated_at: string;
}

// ── Attachments ──

export interface TaskAttachmentResponse {
  id: string;
  task_id: string;
  file_name: string;
  file_size?: number;
  content_type?: string;
  uploaded_by?: string;
  sent_to_client: boolean;
  sent_at?: string;
  created_at: string;
}

// ── Client Timeline ──

export interface ClientTimelineTask {
  id: string;
  title: string;
  description?: string;
  phase_id?: string;
  phase?: TaskPhaseResponse | null;
  priority: string;
  process_type?: string;
  deadline?: string;
  time_estimate_minutes?: number;
  sla_status: string; // on_time, warning, overdue
  sla_days_used?: number;
  sla_days_limit?: number;
  attachment_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClientTimelineStats {
  total: number;
  completed: number;
  on_time: number;
  warning: number;
  overdue: number;
  in_progress: number;
}

export interface ClientTimelineResponse {
  client_id: string;
  client_name: string;
  client_email?: string;
  month: string;
  stats: ClientTimelineStats;
  slas: { process_type: string; sla_days: number; warning_threshold: number }[];
  tasks: ClientTimelineTask[];
}

// ── Overdue Templates ──

export interface OverdueTemplateResponse {
  id: string;
  name: string;
  recurrence: string;
  days_overdue: number;
  activity_count: number;
}

// ── Dashboard Alerts ──

export interface SLAAlert {
  type: string; // overdue or warning
  message: string;
  count: number;
  tasks: { id: string; title: string; client_name: string }[];
}

export interface SLAAlertsResponse {
  overdue: SLAAlert[];
  warning: SLAAlert[];
  total_overdue: number;
  total_warning: number;
}
