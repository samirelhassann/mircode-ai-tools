import { useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { TaskNode } from '@/lib/types'
import { cn } from '@/lib/cn'
import { STATUS_ICON, STATUS_COLOR_VAR } from '@/lib/status'
import { stripFeaturePrefix } from '../content/strip-duplicate-title'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { api } from '@/lib/api'

type Props = {
  featureSlug: string
  featureTitle?: string
  task: TaskNode
  isActive: boolean
}

export function SidebarTaskItem({ featureSlug, featureTitle, task, isActive }: Props) {
  const label = stripFeaturePrefix(task.title, featureTitle)
  const StatusIcon = STATUS_ICON[task.status]
  const statusColor = STATUS_COLOR_VAR[task.status]
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const { taskSlug: currentTaskSlug, featureSlug: currentFeatureSlug } = useParams()
  const qc = useQueryClient()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${featureSlug}:${task.slug}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.deleteTask(featureSlug, task.slug)
      void qc.invalidateQueries({ queryKey: ['tree'] })
      void qc.invalidateQueries({ queryKey: ['content', featureSlug, task.slug] })
      if (currentFeatureSlug === featureSlug && currentTaskSlug === task.slug) {
        navigate(`/features/${featureSlug}`)
      }
      toast.success(`Task "${task.title}" removida.`)
      setDeleteOpen(false)
    } catch {
      toast.error('Não foi possível remover a task.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <li ref={setNodeRef} style={style}>
      <div
        data-task-slug={task.slug}
        className={cn(
          'flex items-center gap-1.5 rounded group transition-colors',
          isActive
            ? 'bg-[var(--accent-subtle-weak)] text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.02)]',
        )}
        style={{
          height: '32px',
          padding: '0 8px 0 28px',
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastar task para reordenar"
          className="p-0 bg-transparent border-none text-inherit cursor-grab active:cursor-grabbing"
        >
          <GripVertical
            className="size-3 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-hidden="true"
            data-dnd-handle
          />
        </button>
        <Link
          to={`/features/${featureSlug}/${task.slug}`}
          className={cn(
            'flex-1 truncate text-xs no-underline',
            isActive ? 'font-medium text-[var(--accent)]' : 'font-normal text-inherit',
            task.status === 'completed' && !isActive ? 'text-[var(--text-muted)]' : '',
          )}
        >
          {label}
        </Link>
        <button
          type="button"
          aria-label={`Remover task "${task.title}"`}
          title="Remover task"
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
          <Trash2 className="size-3 shrink-0" aria-hidden="true" />
        </button>
        <StatusIcon
          className="size-3 shrink-0"
          style={{ color: statusColor }}
          aria-label={`Status: ${task.status}`}
        />
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remover task"
        description={
          <>
            Tem certeza que deseja remover a task <strong>{task.title}</strong>? Isso apaga o
            arquivo{' '}
            <code className="text-[var(--accent)]">
              .specs/specs/{featureSlug}/{task.slug}.md
            </code>{' '}
            e remove o slug do <code className="text-[var(--accent)]">meta.json</code>. Esta ação
            não pode ser desfeita.
          </>
        }
        confirmLabel="Remover task"
        onConfirm={handleDelete}
        submitting={deleting}
      />
    </li>
  )
}
