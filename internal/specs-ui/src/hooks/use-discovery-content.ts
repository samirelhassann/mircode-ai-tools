import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDiscoveryContent(slug: string | undefined) {
  return useQuery({
    queryKey: ['discovery-content', slug],
    queryFn: () => {
      if (!slug) throw new Error('missing_params')
      return api.discoveryContent(slug)
    },
    enabled: Boolean(slug),
    staleTime: 1000,
  })
}
