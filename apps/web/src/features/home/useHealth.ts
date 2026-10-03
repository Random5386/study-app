// Asks the API whether it (and the database) are up.
// TanStack Query handles loading, errors, caching and refreshing for us.
import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@studyapp/shared';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      // Plain fetch here (not lib/api.ts) because a 503 "database down" reply is
      // still a useful answer we want to show, not an error to throw.
      const res = await fetch('/api/health', { headers: { Accept: 'application/json' } });
      if (res.status !== 200 && res.status !== 503) throw new Error(`Unexpected status ${res.status}`);
      // Validate with the same schema the API uses: if the shapes ever drift apart, we find out here.
      return healthResponseSchema.parse(await res.json());
    },
    refetchInterval: 15_000, // re-check every 15 seconds
    retry: false,
  });
}
