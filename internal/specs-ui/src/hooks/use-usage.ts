import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Uso do plano. O servidor observa os arquivos que alimentam isso e empurra a
 * invalidação por SSE, então o intervalo aqui é só uma rede de segurança para
 * quando o watch não estiver disponível.
 */
export function useUsage() {
  return useQuery({
    queryKey: ['usage'],
    queryFn: () => api.usage(),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })
}
