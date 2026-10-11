import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface FeedbackPayload {
  title: string;
  description: string;
  /** Print opcional do erro (PNG, JPG ou WEBP, até 3 MB — validado também no servidor). */
  screenshot?: File | null;
}

interface FeedbackResponse {
  message: string;
}

export const useSendFeedback = () => {
  return useMutation<FeedbackResponse, Error, FeedbackPayload>({
    mutationFn: async ({ title, description, screenshot }) => {
      // Formulário multipart para levar o print junto.
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      if (screenshot) form.append('screenshot', screenshot);
      const { data } = await apiClient.post('/feedback/', form);
      return data;
    },
  });
};
