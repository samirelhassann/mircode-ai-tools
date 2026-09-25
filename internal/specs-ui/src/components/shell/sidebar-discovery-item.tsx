import { useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { DiscoveryNode } from '@/lib/types'
import { cn } from '@/lib/cn'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { DiscoveryTypeBadge } from './discovery-type-badge'
import { api } from '@/lib/api'

type Props = {
  discovery: DiscoveryNode
  isActive: boolean
}

export function SidebarDiscoveryItem({ discovery, isActive }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const { discoverySlug: currentSlug } = useParams()
  const qc = useQueryClient()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `discovery:${discovery.slug}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.deleteDiscovery(discovery.slug)
      void qc.invalidateQueries({ queryKey: ['tree'] })
      void qc.invalidateQueries({ queryKey: ['discovery-content', discovery.slug] })
      if (currentSlug === discovery.slug) {
        navigate('/')
      }
      toast.success(`Discovery "${discovery.title}" removida.`)
      setDeleteOpen(false)
    } catch {
      toast.error('Não foi possível remover a discovery.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <li ref={setNodeRef} style={style}>
      <div
        data-discovery-slug={discovery.slug}
        className={cn(
          'flex items-center gap-1.5 rounded group transition-colors',
          isActive
            ? 'bg-[var(--accent-subtle-weak)] text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.02)]',
        )}
        style={{
          height: '32px',
          padding: '0 8px 0 10px',
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastar discovery para reordenar"
          className="p-0 bg-transparent border-none text-inherit cursor-grab active:cursor-grabbing"
        >
          <GripVertical
            className="size-3 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-hidden="true"
            data-dnd-handle
          />
        </button>
        <DiscoveryTypeBadge type={discovery.type} />
        <Link
          to={`/discoveries/${discovery.slug}`}
          className={cn(
            'flex-1 truncate text-xs no-underline',
            isActive ? 'font-medium text-[var(--accent)]' : 'font-normal text-inherit',
          )}
        >
          {discovery.title}
        </Link>
        <button
          type="button"
          aria-label={`Remover discovery "${discovery.title}"`}
          title="Remover discovery"
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
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remover discovery"
        description={
          <>
            Tem certeza que deseja remover a discovery <strong>{discovery.title}</strong>? Isso
            apaga o arquivo{' '}
            <code className="text-[var(--accent)]">.specs/discoveries/{discovery.slug}.md</code> e
            remove o slug do <code className="text-[var(--accent)]">meta.json</code>. Esta ação não
            pode ser desfeita.
          </>
        }
        confirmLabel="Remover discovery"
        onConfirm={handleDelete}
        submitting={deleting}
      />
    </li>
  )
}
