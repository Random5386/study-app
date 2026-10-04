// Data hooks for AI summaries. While a summary is being written, the list is re-checked
// every 2 seconds (polling), and it stops as soon as nothing is running.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSummaryResponse, DocumentSummariesResponse, SummaryStyle } from '@studyapp/shared';
import { api } from '../../lib/api';

export const summariesKey = (documentId: string) => ['documents', 'detail', documentId, 'summaries'] as const;

const isWorking = (data: DocumentSummariesResponse | undefined) =>
  data?.jobs.some((j) => j.status === 'QUEUED' || j.status === 'RUNNING') ?? false;

export function useDocumentSummaries(documentId: string) {
  return useQuery({
    queryKey: summariesKey(documentId),
    queryFn: () => api.get<DocumentSummariesResponse>(`/api/documents/${documentId}/summaries`),
    refetchInterval: (query) => (isWorking(query.state.data) ? 2000 : false),
  });
}

export function useRequestSummary(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (style: SummaryStyle) =>
      api.post<CreateSummaryResponse>(`/api/documents/${documentId}/summaries`, { style }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: summariesKey(documentId) }),
  });
}
