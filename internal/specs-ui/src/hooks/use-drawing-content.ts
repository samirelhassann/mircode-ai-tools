import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDrawingContent(slug: string | undefined) {
  return useQuery({
    queryKey: ['drawing-content', slug],
    queryFn: () => {
      if (!slug) throw new Error('missing_params')
      return api.drawingContent(slug)
    },
    enabled: Boolean(slug),
    staleTime: 1000,
  })
}
