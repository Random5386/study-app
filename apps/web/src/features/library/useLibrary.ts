// Data hooks for the study guide library. Each one wraps a TanStack Query call,
// so components get loading/error states and caching for free. See docs/13-react-frontend.md.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DocumentDetail,
  DocumentSummary,
  DocumentUpdateInput,
  LibraryStats,
  SubjectCreateInput,
  SubjectDto,
  UploadResponse,
} from '@studyapp/shared';
import { api } from '../../lib/api';

export type DocumentFilters = { subjectId?: string; q?: string; tag?: string };

const keys = {
  subjects: ['subjects'] as const,
  documents: (f: DocumentFilters = {}) => ['documents', 'list', f] as const,
  document: (id: string) => ['documents', 'detail', id] as const,
  stats: ['documents', 'stats'] as const,
};

/** Anything that changed the library: refetch lists, counts and storage use. */
function useRefreshLibrary() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['documents'] });
    void queryClient.invalidateQueries({ queryKey: keys.subjects });
  };
}

const isProcessing = (docs: { status: string }[] | undefined) => docs?.some((d) => d.status === 'PROCESSING');

export function useSubjects() {
  return useQuery({ queryKey: keys.subjects, queryFn: () => api.get<SubjectDto[]>('/api/subjects') });
}

export function useDocuments(filters: DocumentFilters) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  const qs = params.toString();
  return useQuery({
    queryKey: keys.documents(filters),
    queryFn: () => api.get<DocumentSummary[]>(`/api/documents${qs ? `?${qs}` : ''}`),
    // While any document is still being processed, check again every 2 seconds.
    refetchInterval: (query) => (isProcessing(query.state.data) ? 2000 : false),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: keys.document(id),
    queryFn: () => api.get<DocumentDetail>(`/api/documents/${id}`),
    refetchInterval: (query) => (query.state.data?.status === 'PROCESSING' ? 2000 : false),
  });
}

export function useLibraryStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => api.get<LibraryStats>('/api/documents/stats') });
}

export function useUploadDocument() {
  const refresh = useRefreshLibrary();
  return useMutation({
    mutationFn: ({ file, subjectId }: { file: File; subjectId?: string }) => {
      const form = new FormData();
      if (subjectId) form.append('subjectId', subjectId);
      form.append('file', file);
      return api.post<UploadResponse>('/api/documents', form);
    },
    onSuccess: refresh,
  });
}

export function useUpdateDocument(id: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshLibrary();
  return useMutation({
    mutationFn: (input: DocumentUpdateInput) => api.patch<DocumentDetail>(`/api/documents/${id}`, input),
    onSuccess: (doc) => {
      queryClient.setQueryData(keys.document(id), doc);
      refresh();
    },
  });
}

export function useDeleteDocument() {
  const refresh = useRefreshLibrary();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/documents/${id}`), onSuccess: refresh });
}

export function useRetryDocument(id: string) {
  const refresh = useRefreshLibrary();
  return useMutation({
    mutationFn: () => api.post<DocumentDetail>(`/api/documents/${id}/retry`),
    onSuccess: refresh,
  });
}

export function useCreateSubject() {
  const refresh = useRefreshLibrary();
  return useMutation({
    mutationFn: (input: SubjectCreateInput) => api.post<SubjectDto>('/api/subjects', input),
    onSuccess: refresh,
  });
}

export function useDeleteSubject() {
  const refresh = useRefreshLibrary();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/subjects/${id}`), onSuccess: refresh });
}
