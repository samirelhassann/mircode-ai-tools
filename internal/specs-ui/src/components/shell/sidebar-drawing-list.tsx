import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { DrawingNode, TreeResponse } from '@/lib/types'
import { SidebarDrawingItem } from './sidebar-drawing-item'
import { NewDrawingButton } from './new-drawing-button'
import { api } from '@/lib/api'

type Props = {
  drawings: DrawingNode[]
  activeDrawing: string | undefined
}

export function SidebarDrawingList({ drawings, activeDrawing }: Props) {
  const qc = useQueryClient()
  const [isDragging, setIsDragging] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(ev: DragEndEvent) {
    setIsDragging(false)
    const { active, over } = ev
    if (!over || active.id === over.id) return

    const activeSlug = String(active.id).split(':')[1]
    const overSlug = String(over.id).split(':')[1]
    if (!activeSlug || !overSlug) return

    const prev = qc.getQueryData<TreeResponse>(['tree'])
    if (!prev) return

    const oldIdx = drawings.findIndex((d) => d.slug === activeSlug)
    const newIdx = drawings.findIndex((d) => d.slug === overSlug)
    if (oldIdx < 0 || newIdx < 0) return

    const newDrawings = arrayMove(drawings, oldIdx, newIdx)
    qc.setQueryData<TreeResponse>(['tree'], { ...prev, drawings: newDrawings })

    try {
      await api.reorderDrawings(newDrawings.map((d) => d.slug))
      void qc.invalidateQueries({ queryKey: ['tree'] })
    } catch {
      qc.setQueryData(['tree'], prev)
      toast.error('Não foi possível reordenar. Tente novamente.')
    }
  }

  return (
    <section aria-label="Desenhos" className="flex flex-col" style={{ marginTop: '16px' }}>
      <div
        className="flex items-center justify-between border-t border-b border-[var(--border)] bg-[var(--bg-surface)]"
        style={{ height: '40px', padding: '0 16px' }}
      >
        <h2
          className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]"
          style={{ letterSpacing: '0.06em' }}
        >
          Desenhos
        </h2>
        <NewDrawingButton />
      </div>

      <div style={{ padding: '8px 10px' }}>
        {drawings.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] px-2 py-2 leading-relaxed">
            Nenhum desenho ainda. Clique em{' '}
            <span className="font-semibold text-[var(--text-secondary)]">+</span> para disparar o
            agent <code className="text-[var(--accent)]">drawing-agent</code>.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={() => setIsDragging(true)}
            onDragCancel={() => setIsDragging(false)}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={drawings.map((d) => `drawing:${d.slug}`)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-0.5" data-dragging={isDragging || undefined}>
                {drawings.map((drawing) => (
                  <SidebarDrawingItem
                    key={drawing.slug}
                    drawing={drawing}
                    isActive={drawing.slug === activeDrawing}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  )
}
