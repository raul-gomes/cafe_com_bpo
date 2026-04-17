export interface TaskResponse {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  deadline?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  client_id: string;
  status?: string;
  priority?: string;
  deadline?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  client_id?: string;
  status?: string;
  priority?: string;
  deadline?: string;
}
