import type { DiscoveryType } from '@/lib/types'
import { cn } from '@/lib/cn'

const LABEL: Record<DiscoveryType, string> = {
  rfc: 'RFC',
  spike: 'Spike',
  adr: 'ADR',
  note: 'Note',
}

const CLASSES: Record<DiscoveryType, string> = {
  rfc: 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]',
  spike:
    'bg-[color-mix(in_srgb,var(--status-in-progress)_15%,transparent)] text-[var(--status-in-progress)] border-[var(--status-in-progress)]',
  adr: 'bg-[color-mix(in_srgb,var(--status-completed)_15%,transparent)] text-[var(--status-completed)] border-[var(--status-completed)]',
  note: 'bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] border-[var(--border)]',
}

type Props = {
  type: DiscoveryType
  size?: 'sm' | 'md'
}

export function DiscoveryTypeBadge({ type, size = 'sm' }: Props) {
  const isSm = size === 'sm'
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold uppercase tracking-wide rounded border',
        CLASSES[type],
        isSm ? 'text-[9px]' : 'text-[11px]',
      )}
      style={{
        height: isSm ? '14px' : '20px',
        padding: isSm ? '0 4px' : '0 8px',
        letterSpacing: '0.04em',
      }}
    >
      {LABEL[type]}
    </span>
  )
}
