import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.config(),
    staleTime: Number.POSITIVE_INFINITY,
  })
}
