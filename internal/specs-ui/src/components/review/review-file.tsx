import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, ChevronRight, ExternalLink } from 'lucide-react'
import type { ChangedFile } from '@/lib/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { BulkToggle } from './bulk-toggle'
import { DiffView } from './diff-view'

type Props = {
  file: ChangedFile
  reviewed: boolean
  onToggleReviewed: (path: string, reviewed: boolean) => void
  /** Expandir/recolher em massa disparado pelo cabeçalho da revisão. */
  bulk?: BulkToggle
  /** Quando presente, o diff vem de dentro deste commit local, não do working tree. */
  commit?: string
}

const STATUS_LABEL: Record<ChangedFile['status'], string> = {
  added: 'novo',
  modified: 'alterado',
  deleted: 'removido',
  renamed: 'renomeado',
  untracked: 'novo',
}

const STATUS_COLOR: Record<ChangedFile['status'], string> = {
  added: 'var(--status-completed)',
  modified: 'var(--status-in-progress)',
  deleted: 'var(--status-blocked)',
  renamed: 'var(--accent)',
  untracked: 'var(--status-completed)',
}

export function ReviewFile({ file, reviewed, onToggleReviewed, bulk, commit }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (bulk) setOpen(bulk.open)
  }, [bulk])

  const diff = useQuery({
    queryKey: ['review-diff', file.path, commit ?? 'worktree'],
    queryFn: () => api.reviewDiff(file.path, commit),
    enabled: open,
    staleTime: 30_000,
  })

  const openEditor = useMutation({
    mutationFn: () => api.openInEditor(file.path),
    onError: () =>
      toast.error(
        'Não consegui abrir no editor. Confira `review.openCommand` no .specs/config.json.',
      ),
  })

  return (
    <div
      className={cn(
        'rounded-xl border bg-[var(--bg-card)] overflow-hidden transition-colors',
        reviewed ? 'border-[var(--status-completed)] opacity-70' : 'border-[var(--border)]',
      )}
    >
      <div
        className={cn('flex items-center gap-2', open && 'border-b border-[var(--border)]')}
        style={{ padding: '8px 12px' }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Recolher diff' : 'Expandir diff'}
          className="flex items-center gap-2 grow min-w-0 text-left bg-transparent border-none cursor-pointer p-0"
        >
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-[var(--text-muted)] transition-transform',
              open && 'rotate-90',
            )}
            aria-hidden="true"
          />
          <span className="font-mono text-[13px] text-[var(--text-primary)] truncate">
            {file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}
          </span>
          <span
            className="shrink-0 text-[10px] uppercase font-semibold"
            style={{ color: STATUS_COLOR[file.status], letterSpacing: '0.6px' }}
          >
            {STATUS_LABEL[file.status]}
          </span>
        </button>

        <span className="shrink-0 font-mono text-[11px]">
          <span className="text-[var(--status-completed)]">+{file.additions}</span>{' '}
          <span className="text-[var(--status-blocked)]">−{file.deletions}</span>
        </span>

        <button
          type="button"
          onClick={() => openEditor.mutate()}
          title="Abrir no editor"
          aria-label={`Abrir ${file.path} no editor`}
          className="shrink-0 rounded-lg p-1.5 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onToggleReviewed(file.path, !reviewed)}
          aria-pressed={reviewed}
          title={reviewed ? 'Marcar como não revisado' : 'Marcar como revisado'}
          className={cn(
            'shrink-0 inline-flex items-center gap-1 rounded-lg border text-[11px] font-medium transition-colors',
            reviewed
              ? 'border-[var(--status-completed)] text-[var(--status-completed)]'
              : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]',
          )}
          style={{ padding: '4px 8px' }}
        >
          <Check className="size-3" aria-hidden="true" />
          {reviewed ? 'Revisado' : 'Revisar'}
        </button>
      </div>

      {open ? (
        <div>
          {diff.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]" style={{ padding: '12px' }}>
              Carregando diff…
            </p>
          ) : null}
          {diff.isError ? (
            <p className="text-sm text-[var(--status-blocked)]" style={{ padding: '12px' }}>
              Não foi possível carregar o diff deste arquivo.
            </p>
          ) : null}
          {diff.data?.binary ? (
            <p className="text-sm text-[var(--text-muted)]" style={{ padding: '12px' }}>
              Arquivo binário — sem diff textual.
            </p>
          ) : null}
          {diff.data && !diff.data.binary ? (
            <>
              <div style={{ padding: '8px 0' }}>
                <DiffView diff={diff.data.diff} />
              </div>
              {diff.data.truncated ? (
                <p
                  className="text-xs text-[var(--text-muted)] border-t border-[var(--border)]"
                  style={{ padding: '8px 12px' }}
                >
                  Diff truncado em 1500 linhas. Abra no editor para ver o restante.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
