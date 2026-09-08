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
