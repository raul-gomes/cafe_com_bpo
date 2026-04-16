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

export interface NotificationResponse {
  id: string;
  user_id: string;
  type: string;
  post_id: string;
  comment_id: string;
  triggered_by_user_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface PaginatedNotifications {
  items: NotificationResponse[];
  total: number;
}

export const getPosts = async (limit = 10, offset = 0): Promise<PaginatedPosts> => {
  const { data } = await apiClient.get('/api/network/posts', { params: { limit, offset } });
  return data;
};

export const getPost = async (postId: string): Promise<PostResponse> => {
  const { data } = await apiClient.get(`/api/network/posts/${postId}`);
  return data;
};

export const createPost = async (payload: { title: string; message: string; tags: string[] }): Promise<PostResponse> => {
  const { data } = await apiClient.post('/api/network/posts', payload);
  return data;
};

export const deletePost = async (postId: string): Promise<void> => {
  await apiClient.delete(`/api/network/posts/${postId}`);
};

export const createComment = async (postId: string, message: string): Promise<CommentResponse> => {
  const { data } = await apiClient.post(`/api/network/posts/${postId}/comments`, { message });
  return data;
};

export const getComments = async (postId: string): Promise<CommentResponse[]> => {
  const { data } = await apiClient.get(`/api/network/posts/${postId}/comments`);
  return data;
};

export const getNotifications = async (limit = 20): Promise<PaginatedNotifications> => {
  const { data } = await apiClient.get('/api/network/notifications', { params: { limit } });
  return data;
};
