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
import type { FeatureNode, TreeResponse } from '@/lib/types'
import { SidebarFeatureItem } from './sidebar-feature-item'
import { api } from '@/lib/api'

type Props = {
  features: FeatureNode[]
  activeFeature: string | undefined
  activeTask: string | undefined
}

export function SidebarFeatureList({ features, activeFeature, activeTask }: Props) {
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

    const prev = qc.getQueryData<TreeResponse>(['tree'])
    if (!prev) return

    const oldIdx = prev.features.findIndex((f) => f.slug === active.id)
    const newIdx = prev.features.findIndex((f) => f.slug === over.id)
    if (oldIdx < 0 || newIdx < 0) return

    const newFeatures = arrayMove(prev.features, oldIdx, newIdx)
    qc.setQueryData<TreeResponse>(['tree'], { ...prev, features: newFeatures })

    try {
      await api.reorderFeatures(newFeatures.map((f) => f.slug))
      void qc.invalidateQueries({ queryKey: ['tree'] })
    } catch {
      qc.setQueryData(['tree'], prev)
      toast.error('Não foi possível reordenar. Tente novamente.')
    }
  }

  if (features.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] px-2 py-3">
        Nenhuma spec ainda. Crie{' '}
        <code className="text-[var(--accent)]">.specs/specs/&lt;slug&gt;/meta.json</code>.
      </p>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={() => setIsDragging(true)}
      onDragCancel={() => setIsDragging(false)}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Pegou o item ${active.id}. Use as setas para mover.`,
          onDragOver: ({ active, over }) =>
            over ? `Item ${active.id} está sobre ${over.id}.` : '',
          onDragEnd: ({ active, over }) =>
            over ? `Item ${active.id} foi solto na posição de ${over.id}.` : '',
          onDragCancel: ({ active }) =>
            `Movimento cancelado. Item ${active.id} voltou à posição original.`,
        },
      }}
    >
      <SortableContext items={features.map((f) => f.slug)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-0.5" data-dragging={isDragging || undefined}>
          {features.map((feature) => (
            <SidebarFeatureItem
              key={feature.slug}
              feature={feature}
              isActive={feature.slug === activeFeature}
              activeTask={feature.slug === activeFeature ? activeTask : undefined}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
