import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Render do Mermaid e a superfície de zoom/pan, isolados do card do markdown.
 * O `MermaidBlock` usa isto dentro de um dialog; a página de desenho usa a mesma
 * superfície ocupando a tela inteira, sem dialog nenhum.
 */

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null
async function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mermaid = m.default
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          background: '#1f1f1f',
          primaryColor: '#986dff',
          primaryTextColor: '#f9fafb',
          primaryBorderColor: '#2a2a2a',
          lineColor: '#6b7280',
          secondaryColor: '#151515',
          tertiaryColor: '#111111',
        },
        fontFamily: 'Inter, sans-serif',
      })
      return mermaid
    })
  }
  return mermaidPromise
}

let counter = 0

export function useMermaidSvg(source: string) {
  const [svg, setSvg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    counter += 1
    const id = `mermaid-${counter}`
    void loadMermaid().then(async (mermaid) => {
      if (cancelled) return
      try {
        const rendered = await mermaid.render(id, source)
        if (!cancelled) setSvg(rendered.svg)
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    })
    return () => {
      cancelled = true
    }
  }, [source])

  return { svg, err }
}

const MIN_SCALE = 0.1
const MAX_SCALE = 8
const FIT_PADDING = 48
const WHEEL_SENSITIVITY = 0.0012
const MAX_WHEEL_DELTA = 60

function readIntrinsicSize(svg: string): { width: number; height: number } | null {
  const viewBox = /viewBox="([\d.\-\s]+)"/.exec(svg)?.[1]
  if (!viewBox) return null
  const parts = viewBox.trim().split(/\s+/).map(Number)
  if (parts.length !== 4) return null
  const [, , width, height] = parts as [number, number, number, number]
  if (!width || !height) return null
  return { width, height }
}

export function PanZoom({ svg, onClose }: { svg: string; onClose?: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const fitSvg = useMemo(() => svg.replace(/max-width:\s*[\d.]+px;?/g, 'max-width:none;'), [svg])
  const size = useMemo(() => readIntrinsicSize(svg), [svg])
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const fitScaleRef = useRef(1)
  const scaleRef = useRef(1)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const zoomTo = useCallback((next: number, origin?: { x: number; y: number }) => {
    const prev = scaleRef.current
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
    if (clamped === prev) return
    const el = viewportRef.current
    if (el && origin) {
      const rect = el.getBoundingClientRect()
      const cx = origin.x - rect.left - rect.width / 2
      const cy = origin.y - rect.top - rect.height / 2
      const ratio = clamped / prev
      setOffset((o) => ({ x: cx - (cx - o.x) * ratio, y: cy - (cy - o.y) * ratio }))
    }
    scaleRef.current = clamped
    setScale(clamped)
  }, [])

  const zoomBy = useCallback(
    (factor: number, origin?: { x: number; y: number }) =>
      zoomTo(scaleRef.current * factor, origin),
    [zoomTo],
  )

  useEffect(() => {
    const el = viewportRef.current
    if (!el || !size) return
    const rect = el.getBoundingClientRect()
    const fit = Math.min(
      (rect.width - FIT_PADDING) / size.width,
      (rect.height - FIT_PADDING) / size.height,
    )
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit))
    fitScaleRef.current = clamped
    scaleRef.current = clamped
    setScale(clamped)
    setOffset({ x: 0, y: 0 })
  }, [size])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const delta = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, e.deltaY))
      zoomBy(Math.exp(-delta * WHEEL_SENSITIVITY), { x: e.clientX, y: e.clientY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    setOffset({ x: drag.ox + (e.clientX - drag.x), y: drag.oy + (e.clientY - drag.y) })
  }

  function onPointerUp(e: React.PointerEvent) {
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function reset() {
    scaleRef.current = fitScaleRef.current
    setScale(fitScaleRef.current)
    setOffset({ x: 0, y: 0 })
  }

  return (
    <>
      <div
        className="flex items-center justify-between border-b border-[var(--border)]"
        style={{ padding: '10px 16px' }}
      >
        <span className="text-xs text-[var(--text-muted)]">
          Arraste para navegar · scroll para dar zoom{onClose ? ' · Esc para fechar' : ''}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--text-muted)] font-mono w-12 text-right">
            {Math.round(scale * 100)}%
          </span>
          <ToolbarButton label="Diminuir zoom" onClick={() => zoomBy(1 / 1.25)}>
            <Minus className="size-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Aumentar zoom" onClick={() => zoomBy(1.25)}>
            <Plus className="size-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Restaurar zoom" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </ToolbarButton>
          {onClose ? (
            <ToolbarButton label="Fechar diagrama" onClick={onClose}>
              <X className="size-4" aria-hidden="true" />
            </ToolbarButton>
          ) : null}
        </div>
      </div>
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={reset}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing flex items-center justify-center"
        style={{ touchAction: 'none' }}
      >
        <div
          className="shrink-0 [&>svg]:block [&>svg]:size-full"
          style={{
            width: size ? `${size.width}px` : undefined,
            height: size ? `${size.height}px` : undefined,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG gerado pelo mermaid a partir do markdown local
          dangerouslySetInnerHTML={{ __html: fitSvg }}
        />
      </div>
    </>
  )
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-lg p-2 border border-[var(--border)] bg-[var(--bg-surface)]',
        'text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors',
      )}
    >
      {children}
    </button>
  )
}
