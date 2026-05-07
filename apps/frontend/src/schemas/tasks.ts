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
  routine_id?: string;
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

export interface RoutineResponse {
  id: string;
  user_id: string;
  client_id?: string;
  title: string;
  description?: string;
  process_type?: string;
  priority: string;
  recurrence: string;
  day_of_week?: number;
  day_of_month?: number;
  days_before_deadline: number;
  deadline_time?: string;
  is_active: boolean;
  last_generated?: string;
  created_at: string;
  updated_at: string;
}

export interface RoutineCreate {
  title: string;
  description?: string;
  client_id?: string;
  process_type?: string;
  priority?: string;
  recurrence: string;
  day_of_week?: number;
  day_of_month?: number;
  days_before_deadline?: number;
  deadline_time?: string;
  is_active?: boolean;
}

export interface RoutineUpdate {
  title?: string;
  description?: string;
  client_id?: string;
  process_type?: string;
  priority?: string;
  recurrence?: string;
  day_of_week?: number;
  day_of_month?: number;
  days_before_deadline?: number;
  deadline_time?: string;
  is_active?: boolean;
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

export interface TaskAIAnalyzeResponse {
  suggested_priority: string;
  suggested_process_type?: string;
  estimated_deadline_days?: number;
  reasoning: string;
}

export interface TaskAISuggestion {
  title: string;
  description: string;
  process_type: string;
  priority: string;
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
