import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useTree() {
  return useQuery({
    queryKey: ['tree'],
    queryFn: () => api.tree(),
    staleTime: 30_000,
  })
}
