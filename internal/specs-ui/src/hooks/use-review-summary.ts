import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Resumo do que existe para revisar. Compartilha a queryKey com a tela de
 * revisão, então abrir a revisão logo depois não refaz a chamada.
 */
export function useReviewSummary() {
  const query = useQuery({
    queryKey: ['review-changes'],
    queryFn: () => api.reviewChanges(),
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })

  const files = query.data?.files.length ?? 0
  const commits = query.data?.commits.length ?? 0

  return { files, commits, hasChanges: files > 0 || commits > 0 }
}
