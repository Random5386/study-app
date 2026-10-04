// PATCH /api/account/profile: change your display name.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicUser, UpdateProfileInput } from '@studyapp/shared';
import { api } from '../../lib/api';
import { ME_KEY } from '../auth/useMe';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<PublicUser>('/api/account/profile', input),
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user); // the sidebar and greeting update at once
    },
  });
}
