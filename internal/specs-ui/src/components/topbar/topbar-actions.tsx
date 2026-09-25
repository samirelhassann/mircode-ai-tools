import { Link } from 'react-router-dom'
import { ArrowUp, GitCompare } from 'lucide-react'
import type { Status } from '@/lib/types'
import { cn } from '@/lib/cn'
import { useReviewSummary } from '@/hooks/use-review-summary'
import { StatusPill } from './status-pill'
import { AlterarStatusButton } from './alterar-status-button'
import { EditarTaskButton } from './editar-task-button'
import { RunAgentButton } from './run-agent-button'

type Props = {
  featureSlug: string | undefined
  taskSlug: string | undefined
  displayStatus: Status | undefined
}

function reviewTitle(files: number, commits: number): string {
  if (!files && !commits) return 'Nada para revisar no momento'
  const parts = []
  if (files)
    parts.push(`${files} arquivo${files > 1 ? 's' : ''} não commitado${files > 1 ? 's' : ''}`)
  if (commits) parts.push(`${commits} commit${commits > 1 ? 's' : ''} sem push`)
  return `Revisar: ${parts.join(' · ')}`
}

export function TopbarActions({ featureSlug, taskSlug, displayStatus }: Props) {
  const { files, commits, hasChanges } = useReviewSummary()

  return (
    <div className="flex items-center" style={{ gap: '8px' }}>
      {displayStatus ? <StatusPill status={displayStatus} /> : null}
      {featureSlug && taskSlug ? (
        <Link
          to={`/features/${featureSlug}/${taskSlug}/review`}
          title={reviewTitle(files, commits)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg no-underline text-[13px] font-medium',
            'transition-colors',
            // Com alterações pendentes o botão sai do estado neutro: é o sinal
            // de que existe trabalho não revisado esperando.
            hasChanges
              ? 'border border-[var(--accent)] bg-[var(--accent-subtle-weak)] text-[var(--text-primary)]'
              : 'border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          )}
          style={{ padding: '7px 12px' }}
        >
          <GitCompare className="size-4" aria-hidden="true" />
          Revisar
          {files > 0 ? (
            <span
              className="inline-flex items-center justify-center rounded-full text-[10px] font-bold text-[#0a0a0a]"
              style={{
                background: 'var(--status-in-progress)',
                minWidth: '18px',
                padding: '1px 5px',
              }}
            >
              {files}
            </span>
          ) : null}
          {commits > 0 ? (
            <span
              className="inline-flex items-center gap-0.5 rounded-full text-[10px] font-bold"
              style={{
                color: 'var(--accent)',
                background: 'var(--accent-subtle-weak)',
                padding: '1px 5px',
              }}
              title={`${commits} commit(s) local(is) ainda sem push`}
            >
              <ArrowUp className="size-2.5" aria-hidden="true" />
              {commits}
            </span>
          ) : null}
        </Link>
      ) : null}
      <EditarTaskButton featureSlug={featureSlug} taskSlug={taskSlug} />
      <AlterarStatusButton featureSlug={featureSlug} taskSlug={taskSlug} />
      <RunAgentButton featureSlug={featureSlug} taskSlug={taskSlug} />
    </div>
  )
}
