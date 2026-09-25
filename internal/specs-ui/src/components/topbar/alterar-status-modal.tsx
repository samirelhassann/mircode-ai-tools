import { useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Status, TreeResponse, ContentResponse } from '@/lib/types'
import { ALL_STATUSES, STATUS_COLOR_VAR, STATUS_ICON, STATUS_LABEL } from '@/lib/status'
import { cn } from '@/lib/cn'
import { useTree } from '@/hooks/use-tree'
import { useContent } from '@/hooks/use-content'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  featureSlug: string
  taskSlug: string
}

function recomputeFeatureStatus(statuses: Status[]): Status {
  if (statuses.length === 0) return 'pending'
  if (statuses.some((s) => s === 'blocked')) return 'blocked'
  if (statuses.every((s) => s === 'completed')) return 'completed'
  if (statuses.some((s) => s === 'in-progress' || s === 'completed')) return 'in-progress'
  return 'pending'
}

export function AlterarStatusModal({ open, onOpenChange, featureSlug, taskSlug }: Props) {
  const qc = useQueryClient()
  const { data: tree } = useTree()
  const { data: content } = useContent(featureSlug, taskSlug)

  const currentStatus: Status = useMemo(() => {
    const fromContent = content?.frontmatter.status
    if (fromContent) return fromContent
    const task = tree?.features
      .find((f) => f.slug === featureSlug)
      ?.tasks.find((t) => t.slug === taskSlug)
    return task?.status ?? 'pending'
  }, [content, tree, featureSlug, taskSlug])

  const mutation = useMutation({
    mutationFn: (status: Status) => api.setStatus(featureSlug, taskSlug, status),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ['tree'] })
      await qc.cancelQueries({ queryKey: ['content', featureSlug, taskSlug] })
      const prevTree = qc.getQueryData<TreeResponse>(['tree'])
      const prevContent = qc.getQueryData<ContentResponse>(['content', featureSlug, taskSlug])
      if (prevTree) {
        qc.setQueryData<TreeResponse>(['tree'], {
          ...prevTree,
          features: prevTree.features.map((f) => {
            if (f.slug !== featureSlug) return f
            const newTasks = f.tasks.map((t) => (t.slug === taskSlug ? { ...t, status } : t))
            return {
              ...f,
              tasks: newTasks,
              status: recomputeFeatureStatus(newTasks.map((t) => t.status)),
            }
          }),
        })
      }
      if (prevContent) {
        qc.setQueryData<ContentResponse>(['content', featureSlug, taskSlug], {
          ...prevContent,
          frontmatter: { ...prevContent.frontmatter, status },
        })
      }
      return { prevTree, prevContent }
    },
    onError: (_err, _status, ctx) => {
      if (ctx?.prevTree) qc.setQueryData(['tree'], ctx.prevTree)
      if (ctx?.prevContent) qc.setQueryData(['content', featureSlug, taskSlug], ctx.prevContent)
      toast.error('Não foi possível alterar o status. Tente novamente.')
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tree'] })
      void qc.invalidateQueries({ queryKey: ['content', featureSlug, taskSlug] })
    },
  })

  function handlePick(status: Status) {
    onOpenChange(false)
    if (status !== currentStatus) mutation.mutate(status)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl focus:outline-none"
          style={{ width: '380px' }}
        >
          <div
            className="flex items-center justify-between border-b border-[var(--border)]"
            style={{ padding: '20px 24px' }}
          >
            <Dialog.Title className="text-[15px] font-bold text-[var(--text-primary)]">
              Alterar Status
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="size-[18px]" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div style={{ padding: '8px 0' }} role="radiogroup" aria-label="Status da task">
            {ALL_STATUSES.map((status) => {
              const Icon = STATUS_ICON[status]
              const isSelected = status === currentStatus
              return (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Marcar como ${STATUS_LABEL[status]}`}
                  onClick={() => handlePick(status)}
                  className={cn(
                    'w-full flex items-center text-left transition-colors',
                    'hover:bg-[rgba(255,255,255,0.03)]',
                  )}
                  style={{
                    height: '44px',
                    padding: '0 16px',
                    gap: '12px',
                    background: isSelected
                      ? 'var(--status-in-progress-bg-modal, rgba(255,154,109,0.08))'
                      : undefined,
                  }}
                >
                  <Icon
                    className="size-4 shrink-0"
                    style={{ color: STATUS_COLOR_VAR[status] }}
                    aria-hidden="true"
                  />
                  <span
                    className={cn('flex-1 text-sm', isSelected ? 'font-medium' : 'font-normal')}
                    style={{ color: isSelected ? STATUS_COLOR_VAR[status] : 'var(--text-primary)' }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  {isSelected ? (
                    <Check
                      className="size-3.5 shrink-0"
                      style={{ color: STATUS_COLOR_VAR[status] }}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
