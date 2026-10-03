import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api, setCsrfToken } from '../../lib/api';

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSettled: () => {
      setCsrfToken(null); // the session (and its token) is gone; fetch a new one next time
      queryClient.clear(); // forget every cached piece of this user's data
      navigate('/login', { replace: true });
    },
  });
}
