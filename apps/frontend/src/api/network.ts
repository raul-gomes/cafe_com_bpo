import { apiClient } from './client';

export interface UserPublic {
  id: string;
  name: string | null;
  email: string;
}

export interface PostResponse {
  id: string;
  author_id: string;
  author: UserPublic;
  title: string;
  message: string;
  tags: string[];
  status: string;
  comments_count: number;
  views_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedPosts {
  items: PostResponse[];
  total: number;
}

export interface CommentResponse {
  id: string;
  post_id: string;
  author_id: string;
  author: UserPublic;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at?: string;
}

export const getPosts = async (limit = 10, offset = 0): Promise<PaginatedPosts> => {
  const { data } = await apiClient.get('/network/posts', { params: { limit, offset } });
  return data;
};

export const getPost = async (postId: string): Promise<PostResponse> => {
  const { data } = await apiClient.get(`/network/posts/${postId}`);
  return data;
};

export const createPost = async (payload: { title: string; message: string; tags: string[] }): Promise<PostResponse> => {
  const { data } = await apiClient.post('/network/posts', payload);
  return data;
};

export const deletePost = async (postId: string): Promise<void> => {
  await apiClient.delete(`/network/posts/${postId}`);
};

export const createComment = async (postId: string, message: string): Promise<CommentResponse> => {
  const { data } = await apiClient.post(`/network/posts/${postId}/comments`, { message });
  return data;
};

export const getComments = async (postId: string): Promise<CommentResponse[]> => {
  const { data } = await apiClient.get(`/network/posts/${postId}/comments`);
  return data;
};

export const searchSkills = async (query: string, limit = 10): Promise<Skill[]> => {
  const { data } = await apiClient.get('/network/skills', { params: { query, limit } });
  return data;
};

export const getMySkills = async (): Promise<Skill[]> => {
  const { data } = await apiClient.get('/network/me/skills');
  return data;
};

export const addMySkill = async (name: string): Promise<Skill> => {
  const { data } = await apiClient.post('/network/me/skills', { name });
  return data;
};

export const removeMySkill = async (skillId: string): Promise<void> => {
  await apiClient.delete(`/network/me/skills/${skillId}`);
};

export type RemoteType = 'remote' | 'onsite' | 'hybrid';

export interface ProjectResponse {
  id: string;
  owner_id: string;
  owner: UserPublic;
  title: string;
  description: string;
  status: string;
  team_size: number;
  remote_type: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  skills: Skill[];
}

export interface PaginatedProjects {
  items: ProjectResponse[];
  total: number;
}

export interface ProjectCreatePayload {
  title: string;
  description: string;
  skills?: string[];
  team_size?: number;
  remote_type?: RemoteType;
}

export interface ProjectUpdatePayload {
  title?: string;
  description?: string;
  skills?: string[];
}

export const getProjects = async (
  limit = 20,
  offset = 0
): Promise<PaginatedProjects> => {
  const { data } = await apiClient.get('/network/projects', {
    params: { limit, offset },
  });
  return data;
};

export const createProject = async (
  payload: ProjectCreatePayload
): Promise<ProjectResponse> => {
  const { data } = await apiClient.post('/network/projects', payload);
  return data;
};

export const updateProject = async (
  projectId: string,
  payload: ProjectUpdatePayload
): Promise<ProjectResponse> => {
  const { data } = await apiClient.patch(`/network/projects/${projectId}`, payload);
  return data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await apiClient.delete(`/network/projects/${projectId}`);
};

export interface ProfessionalMatch {
  id: string;
  name: string | null;
  email: string;
  biografia: string | null;
  skills: Skill[];
}

export const searchProfessionals = async (
  skills: string[],
  mode: 'any' | 'all' = 'any'
): Promise<ProfessionalMatch[]> => {
  const { data } = await apiClient.get('/network/users/search', {
    params: { skills: skills.join(','), mode },
  });
  return data;
};

export interface ProjectInvitation {
  id: string;
  project_id: string;
  project_title: string;
  invited_user: UserPublic;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  responded_at: string | null;
  created_at: string;
  conversation_id: string | null;
}

export interface ProjectInviteCreatePayload {
  invited_user_id: string;
  message: string;
}

export interface ConversationListItem {
  id: string;
  project_id: string;
  project_title: string;
  participant: UserPublic;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender: UserPublic;
  body: string;
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  project_id: string;
  project_title: string;
  participants: UserPublic[];
  messages: ConversationMessage[];
  created_at: string;
}

export const createInvitation = async (
  projectId: string,
  payload: ProjectInviteCreatePayload
): Promise<ProjectInvitation> => {
  const { data } = await apiClient.post(`/network/projects/${projectId}/invites`, payload);
  return data;
};

export const getProjectInvitations = async (
  projectId: string
): Promise<ProjectInvitation[]> => {
  const { data } = await apiClient.get(`/network/projects/${projectId}/invites`);
  return data;
};

export const getMyInvitations = async (): Promise<ProjectInvitation[]> => {
  const { data } = await apiClient.get('/network/me/invites');
  return data;
};

export const acceptInvitation = async (
  invitationId: string
): Promise<ProjectInvitation> => {
  const { data } = await apiClient.post(`/network/invites/${invitationId}/accept`);
  return data;
};

export const declineInvitation = async (
  invitationId: string
): Promise<ProjectInvitation> => {
  const { data } = await apiClient.post(`/network/invites/${invitationId}/decline`);
  return data;
};

export const getConversations = async (): Promise<ConversationListItem[]> => {
  const { data } = await apiClient.get('/network/conversations');
  return data;
};

export const getConversation = async (
  conversationId: string
): Promise<ConversationDetail> => {
  const { data } = await apiClient.get(`/network/conversations/${conversationId}`);
  return data;
};

export const sendMessage = async (
  conversationId: string,
  body: string
): Promise<ConversationMessage> => {
  const { data } = await apiClient.post(`/network/conversations/${conversationId}/messages`, {
    body,
  });
  return data;
};
