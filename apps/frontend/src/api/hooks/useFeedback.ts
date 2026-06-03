import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';

interface FeedbackPayload {
  title: string;
  description: string;
}

interface FeedbackResponse {
  message: string;
}

export const useSendFeedback = () => {
  return useMutation<FeedbackResponse, Error, FeedbackPayload>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post('/feedback/', payload);
      return data;
    },
  });
};
