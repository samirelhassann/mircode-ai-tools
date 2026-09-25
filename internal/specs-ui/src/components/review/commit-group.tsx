import { useEffect, useState } from 'react'
import { ChevronRight, GitCommitHorizontal } from 'lucide-react'
import type { ChangedFile, LocalCommit } from '@/lib/types'
import { cn } from '@/lib/cn'
import type { BulkToggle } from './bulk-toggle'
import { ReviewFile } from './review-file'

type Props = {
  commit: LocalCommit
  isReviewed: (file: ChangedFile, commit: string) => boolean
  onToggleReviewed: (file: ChangedFile, commit: string, reviewed: boolean) => void
  bulk?: BulkToggle
}

/** Um commit local ainda não enviado — no modo feature, corresponde a uma task. */
export function CommitGroup({ commit, isReviewed, onToggleReviewed, bulk }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (bulk) setOpen(bulk.open)
  }, [bulk])

  const pending = commit.files.filter((f) => !isReviewed(f, commit.hash)).length

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 w-full text-left bg-transparent border-none cursor-pointer"
        style={{ padding: '10px 12px' }}
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-[var(--text-muted)] transition-transform',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        />
        <GitCommitHorizontal className="size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        <span className="grow min-w-0 truncate text-[13px] font-medium text-[var(--text-primary)]">
          {commit.subject}
        </span>
        <code className="shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
          {commit.shortHash}
        </code>
        <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
          {commit.files.length} arq
          {pending > 0 ? ` · ${pending} a revisar` : ' · revisado'}
        </span>
        <span className="shrink-0 font-mono text-[11px]">
          <span className="text-[var(--status-completed)]">+{commit.additions}</span>{' '}
          <span className="text-[var(--status-blocked)]">−{commit.deletions}</span>
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-2" style={{ padding: '0 12px 12px' }}>
          {commit.files.map((file) => (
            <ReviewFile
              key={`${commit.hash}:${file.path}`}
              file={file}
              commit={commit.hash}
              bulk={bulk}
              reviewed={isReviewed(file, commit.hash)}
              onToggleReviewed={(_, next) => onToggleReviewed(file, commit.hash, next)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
