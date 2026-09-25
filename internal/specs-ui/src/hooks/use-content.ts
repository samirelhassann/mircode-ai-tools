import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useContent(feature: string | undefined, task: string | undefined) {
  return useQuery({
    queryKey: ['content', feature, task],
    queryFn: () => {
      if (!feature || !task) throw new Error('missing_params')
      return api.content(feature, task)
    },
    enabled: Boolean(feature && task),
    staleTime: 1000,
  })
}
