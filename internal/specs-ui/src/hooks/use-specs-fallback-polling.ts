import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

type Options = {
  /** Passe `false` enquanto o SSE estiver vivo — aí não há o que pollar. */
  enabled: boolean
  intervalMs?: number
}

/**
 * Rede de segurança para quando o SSE de `/api/events` não está disponível
 * (servidor antigo, conexão caída, SO sem watch recursivo). Repõe o
 * comportamento antigo — reler a árvore e o conteúdo de tempos em tempos — só
 * que agora é a exceção, não o padrão.
 */
export function useSpecsFallbackPolling({ enabled, intervalMs = 10_000 }: Options): void {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      if (document.hidden) return
      void qc.invalidateQueries({ queryKey: ['tree'] })
      void qc.invalidateQueries({ queryKey: ['content'] })
      void qc.invalidateQueries({ queryKey: ['discovery-content'] })
      void qc.invalidateQueries({ queryKey: ['drawing-content'] })
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs, qc])
}
