import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface FeedbackPayload {
  title: string;
  description: string;
  /** Optional screenshot (PNG, JPG or WEBP, up to 3 MB — also validated by the server). */
  screenshot?: File | null;
}

interface FeedbackResponse {
  message: string;
}

export const useSendFeedback = () => {
  return useMutation<FeedbackResponse, Error, FeedbackPayload>({
    mutationFn: async ({ title, description, screenshot }) => {
      // Multipart form so the screenshot goes along.
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      if (screenshot) form.append('screenshot', screenshot);
      const { data } = await apiClient.post('/feedback/', form);
      return data;
    },
  });
};
