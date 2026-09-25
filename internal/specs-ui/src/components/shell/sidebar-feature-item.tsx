import { useEffect, useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { ChevronDown, ChevronRight, GripVertical, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FeatureNode, TreeResponse } from '@/lib/types'
import { cn } from '@/lib/cn'
import { STATUS_ICON, STATUS_COLOR_VAR } from '@/lib/status'
import { SidebarTaskItem } from './sidebar-task-item'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { api } from '@/lib/api'

type Props = {
  feature: FeatureNode
  isActive: boolean
  activeTask: string | undefined
}

export function SidebarFeatureItem({ feature, isActive, activeTask }: Props) {
  const [open, setOpen] = useState(isActive)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const { featureSlug: currentFeatureSlug } = useParams()
  const qc = useQueryClient()

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.deleteFeature(feature.slug)
      // Invalida a tree; se a feature deletada é a atualmente aberta, navega pra raiz
      void qc.invalidateQueries({ queryKey: ['tree'] })
      if (currentFeatureSlug === feature.slug) {
        navigate('/')
      }
      toast.success(`Spec "${feature.title}" removida.`)
      setDeleteOpen(false)
    } catch {
      toast.error('Não foi possível remover a spec.')
    } finally {
      setDeleting(false)
    }
  }

  const StatusIcon = STATUS_ICON[feature.status]
  const statusColor = STATUS_COLOR_VAR[feature.status]

  const sortable = useSortable({ id: feature.slug })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleTasksDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const activeSlug = String(active.id).split(':')[1]
    const overSlug = String(over.id).split(':')[1]
    if (!activeSlug || !overSlug) return

    const prev = qc.getQueryData<TreeResponse>(['tree'])
    if (!prev) return
    const oldIdx = feature.tasks.findIndex((t) => t.slug === activeSlug)
    const newIdx = feature.tasks.findIndex((t) => t.slug === overSlug)
    if (oldIdx < 0 || newIdx < 0) return

    const newTasks = arrayMove(feature.tasks, oldIdx, newIdx)
    qc.setQueryData<TreeResponse>(['tree'], {
      ...prev,
      features: prev.features.map((f) => (f.slug === feature.slug ? { ...f, tasks: newTasks } : f)),
    })

    try {
      await api.reorderTasks(
        feature.slug,
        newTasks.map((t) => t.slug),
      )
      void qc.invalidateQueries({ queryKey: ['tree'] })
    } catch {
      qc.setQueryData(['tree'], prev)
      toast.error('Não foi possível reordenar. Tente novamente.')
    }
  }

  return (
    <li ref={setNodeRef} style={style}>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-md cursor-pointer select-none group',
            'transition-colors',
            isActive
              ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.02)]',
          )}
          style={{ height: '36px', padding: '0 10px' }}
          onClick={() => {
            if (!isActive) navigate(`/features/${feature.slug}`)
            else setOpen((v) => !v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (!isActive) navigate(`/features/${feature.slug}`)
              else setOpen((v) => !v)
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={open}
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Arrastar para reordenar"
            className="p-0 bg-transparent border-none text-inherit cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical
              className="size-3.5 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              aria-hidden="true"
              data-dnd-handle
            />
          </button>
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="p-0 bg-transparent border-none text-inherit flex items-center"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((v) => !v)
              }}
              aria-label={open ? 'Colapsar' : 'Expandir'}
            >
              {open ? (
                <ChevronDown
                  className="size-3 shrink-0"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="size-3 shrink-0 text-[var(--text-secondary)]"
                  aria-hidden="true"
                />
              )}
            </button>
          </Collapsible.Trigger>
          <Link
            to={`/features/${feature.slug}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex-1 truncate text-[13px] font-semibold no-underline',
              isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]',
            )}
          >
            {feature.title}
          </Link>
          <button
            type="button"
            aria-label={`Remover spec "${feature.title}"`}
            title="Remover spec"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteOpen(true)
            }}
            className={cn(
              'p-0.5 rounded transition-opacity',
              'text-[var(--text-muted)] hover:text-[var(--status-blocked)]',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
          </button>
          <StatusIcon
            className="size-[13px] shrink-0"
            style={{ color: statusColor }}
            aria-label={`Status: ${feature.status}`}
          />
        </div>

        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Remover spec"
          description={
            <>
              Tem certeza que deseja remover a spec <strong>{feature.title}</strong>? Isso apaga
              permanentemente a pasta{' '}
              <code className="text-[var(--accent)]">.specs/specs/{feature.slug}/</code> com todas
              as suas tasks ({feature.tasks.length}). Esta ação não pode ser desfeita.
            </>
          }
          confirmLabel="Remover spec"
          onConfirm={handleDelete}
          submitting={deleting}
        />

        <Collapsible.Content>
          <DndContext
            sensors={taskSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleTasksDragEnd}
          >
            <SortableContext
              items={feature.tasks.map((t) => `${feature.slug}:${t.slug}`)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-0.5 py-0.5">
                {feature.tasks.map((task) => (
                  <SidebarTaskItem
                    key={task.slug}
                    featureSlug={feature.slug}
                    featureTitle={feature.title}
                    task={task}
                    isActive={task.slug === activeTask}
                  />
                ))}
                {feature.tasks.length === 0 ? (
                  <li className="text-xs text-[var(--text-muted)] pl-7 py-1">
                    Sem tasks nesta spec.
                  </li>
                ) : null}
              </ul>
            </SortableContext>
          </DndContext>
        </Collapsible.Content>
      </Collapsible.Root>
    </li>
  )
}
