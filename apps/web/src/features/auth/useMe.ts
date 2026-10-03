// Who is signed in? `null` means nobody (or sign-in isn't finished yet).
import { useQuery } from '@tanstack/react-query';
import type { PublicUser, SessionResponse } from '@studyapp/shared';
import { api } from '../../lib/api';

export const ME_KEY = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    // /api/auth/session always answers 200 ({ user: null } when signed out), so no red errors in the console.
    queryFn: async (): Promise<PublicUser | null> =>
      (await api.get<SessionResponse>('/api/auth/session')).user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
