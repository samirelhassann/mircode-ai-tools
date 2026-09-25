import { useEffect, useRef, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

/** Espelha `SpecsChangeEvent` do servidor. */
export type SpecsChangeEvent =
  | { type: 'tree' }
  | { type: 'content'; feature: string; task: string }
  | { type: 'discovery'; slug: string }
  | { type: 'drawing'; slug: string }
  | { type: 'config' }
  | { type: 'usage' }

/**
 * Traduz um evento do watcher nas queries que ele torna obsoletas. Separado do
 * hook para poder ser testado sem EventSource.
 */
export function invalidateFor(qc: QueryClient, event: SpecsChangeEvent): void {
  switch (event.type) {
    case 'tree':
      void qc.invalidateQueries({ queryKey: ['tree'] })
      break
    case 'content':
      void qc.invalidateQueries({ queryKey: ['content', event.feature, event.task] })
      break
    case 'discovery':
      void qc.invalidateQueries({ queryKey: ['discovery-content', event.slug] })
      break
    case 'drawing':
      void qc.invalidateQueries({ queryKey: ['drawing-content', event.slug] })
      break
    case 'config':
      // O protótipo é declarado dentro do config, então anda junto.
      void qc.invalidateQueries({ queryKey: ['config'] })
      void qc.invalidateQueries({ queryKey: ['prototype'] })
      break
    case 'usage':
      void qc.invalidateQueries({ queryKey: ['usage'] })
      break
  }
}

export type SpecsEventsState = {
  /** true enquanto o SSE está aberto **e** o servidor consegue observar o disco. */
  live: boolean
}

/**
 * Assina o SSE de mudanças em `.specs/` e invalida as queries afetadas. Substitui
 * o polling: enquanto `live` for true, árvore, conteúdo e uso se atualizam sozinhos
 * em menos de um segundo depois de o arquivo mudar no disco.
 *
 * Devolve `live: false` quando a conexão cai ou o SO não suporta watch recursivo
 * — nesse caso quem chama volta a pollar.
 */
export function useSpecsEvents(): SpecsEventsState {
  const qc = useQueryClient()
  const [live, setLive] = useState(false)
  const retryRef = useRef(0)

  useEffect(() => {
    let source: EventSource | null = null
    let reconnect: number | null = null
    let closed = false

    function connect() {
      if (closed) return
      source = new EventSource('/api/events')

      source.onmessage = (ev) => {
        let payload: unknown
        try {
          payload = JSON.parse(ev.data)
        } catch {
          return
        }
        const message = payload as {
          type?: string
          watching?: boolean
          events?: SpecsChangeEvent[]
        }
        if (message.type === 'hello') {
          retryRef.current = 0
          setLive(message.watching === true)
          return
        }
        if (message.type === 'change' && Array.isArray(message.events)) {
          for (const event of message.events) invalidateFor(qc, event)
        }
      }

      source.onerror = () => {
        setLive(false)
        source?.close()
        source = null
        if (closed) return
        // Backoff até 30s: o servidor pode estar reiniciando.
        retryRef.current = Math.min(retryRef.current + 1, 6)
        reconnect = window.setTimeout(connect, Math.min(1000 * 2 ** retryRef.current, 30_000))
      }
    }

    connect()
    return () => {
      closed = true
      if (reconnect) window.clearTimeout(reconnect)
      source?.close()
    }
  }, [qc])

  return { live }
}
