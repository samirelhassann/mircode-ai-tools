import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Protótipo em vigor para o contexto atual. Sem `feature`, devolve o default do
 * projeto; com ela, o override declarado no `meta.json` da feature (quando houver).
 */
export function usePrototype(feature?: string) {
  return useQuery({
    queryKey: ['prototype', feature ?? null],
    queryFn: () => api.prototype(feature),
    staleTime: 30_000,
  })
}
