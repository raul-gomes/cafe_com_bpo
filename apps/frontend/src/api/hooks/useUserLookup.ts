import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface UserLookupItem {
  email: string;
  name?: string | null;
  avatar_url?: string | null;
}

export interface UserLookupResponse {
  found: UserLookupItem[];
  not_found: string[];
}

export function useUserLookup() {
  return useMutation({
    mutationFn: async (emails: string[]): Promise<UserLookupResponse> => {
      const { data } = await apiClient.post('/auth/users/lookup', { emails });
      return data;
    },
  });
}
