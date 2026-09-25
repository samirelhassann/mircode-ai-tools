import { cn } from '@/lib/cn'
import type { JobStatus } from '@/lib/types'

const COLOR_BY_STATUS: Record<JobStatus, string> = {
  running: 'var(--status-in-progress)',
  'needs-input': 'var(--status-warning,#f59e0b)',
  done: 'var(--status-completed)',
  failed: 'var(--status-blocked,#ef4444)',
  cancelled: 'var(--text-muted)',
}

const LABEL_BY_STATUS: Record<JobStatus, string> = {
  running: 'Rodando',
  'needs-input': 'Aguardando input',
  done: 'Concluído',
  failed: 'Falhou',
  cancelled: 'Cancelado',
}

/** Estados em que ainda há um processo vivo do outro lado. */
const ACTIVE: JobStatus[] = ['running', 'needs-input']

type Props = {
  status: JobStatus
  pulse?: boolean
  withLabel?: boolean
  className?: string
}

/**
 * Indicador de estado de um job. A **forma** carrega a informação principal, não
 * só a cor: enquanto há processo vivo o ponto é **cheio** (e pulsa); quando a
 * execução acabou ele vira um **anel vazado e estático** — dá para ver de longe
 * que ali não roda mais nada, mesmo sem distinguir verde de laranja.
 */
export function StatusDot({ status, pulse = true, withLabel, className }: Props) {
  const isActive = ACTIVE.includes(status)
  const color = COLOR_BY_STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'inline-block size-2 shrink-0 rounded-full',
          pulse && isActive && 'motion-safe:animate-pulse',
        )}
        style={
          isActive
            ? { background: color }
            : { background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${color}` }
        }
        aria-hidden="true"
      />
      {withLabel ? (
        <span className="text-xs text-[var(--text-secondary)]">{LABEL_BY_STATUS[status]}</span>
      ) : null}
    </span>
  )
}

export function statusLabel(status: JobStatus): string {
  return LABEL_BY_STATUS[status]
}

export function isActiveStatus(status: JobStatus): boolean {
  return ACTIVE.includes(status)
}
