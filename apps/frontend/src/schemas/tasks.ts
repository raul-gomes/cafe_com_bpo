export interface TaskResponse {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  process_type?: string;
  deadline?: string;
  phase_id?: string;
  time_estimate_hours?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  client_id: string;
  status?: string;
  priority?: string;
  process_type?: string;
  deadline?: string;
  phase_id?: string;
  time_estimate_hours?: number;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  client_id?: string;
  status?: string;
  priority?: string;
  process_type?: string;
  deadline?: string;
  phase_id?: string;
  time_estimate_hours?: number;
}

export interface TaskPhaseResponse {
  id: string;
  user_id: string;
  name: string;
  color: string;
  order: number;
  is_default: boolean;
  created_at: string;
}

export interface TaskPhaseCreate {
  name: string;
  color: string;
  order: number;
}

export interface TaskPhaseUpdate {
  name?: string;
  color?: string;
  order?: number;
}

export interface TimelineTask {
  id: string;
  title: string;
  client_id: string;
  deadline?: string;
  time_estimate_hours?: number;
  priority: string;
  process_type?: string;
  status: string;
}

export interface TimelineDay {
  date: string;
  tasks: TimelineTask[];
  total_hours: number;
}

export interface TimelineResponse {
  timeline: TimelineDay[];
}

export interface ConflictTask {
  id: string;
  title: string;
  time_estimate_hours?: number;
  deadline?: string;
}

export interface ConflictResponse {
  date: string;
  tasks: ConflictTask[];
  total_hours: number;
}

export interface ConflictsResponse {
  conflicts: ConflictResponse[];
}

// ── Activity Templates ──

export interface ActivityTemplateListItem {
  id: string;
  name: string;
  description?: string;
  process_type?: string;
  recurrence: string;
  due_date?: string;
  recurrence_end_date?: string;
  is_active: boolean;
  is_overdue?: boolean;
  days_overdue?: number;
  activity_count: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateActivityResponse {
  id: string;
  template_id: string;
  name: string;
  description?: string;
  due_day: number;
  estimated_hours?: number;
  order: number;
  phase_id?: string;
  created_at: string;
}

export interface ActivityTemplateResponse {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  process_type?: string;
  recurrence: string;
  due_date?: string;
  recurrence_end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  activities: TemplateActivityResponse[];
}

export interface ActivityTemplateCreate {
  name: string;
  description?: string;
  process_type?: string;
  recurrence?: string;
  due_date?: string;
  recurrence_end_date?: string;
  is_active?: boolean;
}

export interface ActivityTemplateUpdate {
  name?: string;
  description?: string;
  process_type?: string;
  recurrence?: string;
  due_date?: string;
  recurrence_end_date?: string;
  is_active?: boolean;
}

export interface TemplateActivityCreate {
  name: string;
  description?: string;
  due_day: number;
  estimated_hours?: number;
  order?: number;
  phase_id?: string;
}

export interface TemplateActivityUpdate {
  name?: string;
  description?: string;
  due_day?: number;
  estimated_hours?: number;
  order?: number;
  phase_id?: string;
}

// ── Client Template Assignment ──

export interface ClientTemplateAssignmentCreate {
  client_id: string;
  template_id: string;
  start_date?: string;
}

export interface ClientTemplateAssignmentResponse {
  id: string;
  client_id: string;
  template_id: string;
  user_id: string;
  start_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  status: string;
  priority: string;
  process_type?: string;
  deadline?: string;
  time_estimate_hours?: number;
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
