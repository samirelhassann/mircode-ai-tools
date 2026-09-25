import { useTree } from '@/hooks/use-tree'
import { DrawingTypeBadge } from './drawing-type-badge'
import { EditarDrawingButton } from '../topbar/editar-drawing-button'

type Props = {
  drawingSlug: string | undefined
}

export function DrawingTopbar({ drawingSlug }: Props) {
  const { data } = useTree()
  const drawing = data?.drawings.find((d) => d.slug === drawingSlug)

  return (
    <header
      className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0"
      style={{ height: '64px', padding: '0 40px' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[13px] font-semibold text-[var(--text-muted)]">Desenhos</span>
        <span className="shrink-0 text-[var(--text-muted)]">/</span>
        {drawing ? (
          <>
            <DrawingTypeBadge type={drawing.type} />
            <h1 className="truncate text-[15px] font-bold text-[var(--text-primary)]">
              {drawing.title}
            </h1>
            {drawing.date ? (
              <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
                {drawing.date}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-[13px] font-semibold text-[var(--text-muted)]">—</span>
        )}
      </div>

      <div className="flex items-center" style={{ gap: '8px' }}>
        <EditarDrawingButton drawingSlug={drawingSlug} />
      </div>
    </header>
  )
}
