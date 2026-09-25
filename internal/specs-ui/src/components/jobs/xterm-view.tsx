import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { createJobStream, jobsApi } from '@/lib/jobs-api'

type Props = {
  jobId: string
  initialBuffer: string
  disabled?: boolean
  onStatusChange?: (
    status: 'running' | 'needs-input' | 'done' | 'failed' | 'cancelled',
    exitCode?: number,
    hint?: string,
  ) => void
}

const THEME = {
  background: '#0a0a0a',
  foreground: '#e4e4e7',
  cursor: '#e4e4e7',
  selectionBackground: 'rgba(255,255,255,0.18)',
  black: '#18181b',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#ec4899',
  cyan: '#06b6d4',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#f472b6',
  brightCyan: '#22d3ee',
  brightWhite: '#fafafa',
}

export function XtermView({ jobId, initialBuffer, disabled, onStatusChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const lastSizeRef = useRef<{ cols: number; rows: number } | null>(null)
  const resizeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      allowProposedApi: true,
      scrollback: 5000,
      theme: THEME,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(container)
    try {
      fit.fit()
    } catch {}
    termRef.current = term
    fitRef.current = fit

    if (initialBuffer) {
      term.write(initialBuffer)
    }

    // Envia teclas digitadas para o backend
    const dataDisposable = term.onData((data) => {
      if (disabled) return
      jobsApi.sendInput(jobId, data).catch(() => {})
    })

    // Stream de chunks + status do server
    const unsubscribe = createJobStream(jobId, (ev) => {
      if (ev.type === 'chunk') {
        term.write(ev.payload)
      } else if (ev.type === 'status') {
        onStatusChange?.(ev.payload.status, ev.payload.exitCode, ev.payload.needsInputHint)
      }
    })

    // Envia resize para o server (debounce)
    const sendResize = () => {
      if (!fitRef.current || !termRef.current) return
      try {
        fitRef.current.fit()
      } catch {
        return
      }
      const cols = termRef.current.cols
      const rows = termRef.current.rows
      const last = lastSizeRef.current
      if (last && last.cols === cols && last.rows === rows) return
      lastSizeRef.current = { cols, rows }
      jobsApi.resize(jobId, cols, rows).catch(() => {})
    }

    const ro = new ResizeObserver(() => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current)
      resizeTimerRef.current = window.setTimeout(sendResize, 120)
    })
    ro.observe(container)
    // Fire inicial
    window.setTimeout(sendResize, 0)

    return () => {
      ro.disconnect()
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current)
      dataDisposable.dispose()
      unsubscribe()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  return <div ref={containerRef} className="h-full w-full" />
}
