import type { DrawingType } from '@/lib/types'
import { cn } from '@/lib/cn'

const LABEL: Record<DrawingType, string> = {
  architecture: 'Arch',
  flow: 'Flow',
  sequence: 'Seq',
  data: 'Data',
  state: 'State',
}

const CLASSES: Record<DrawingType, string> = {
  architecture: 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]',
  flow: 'bg-[color-mix(in_srgb,var(--status-in-progress)_15%,transparent)] text-[var(--status-in-progress)] border-[var(--status-in-progress)]',
  sequence:
    'bg-[color-mix(in_srgb,var(--status-completed)_15%,transparent)] text-[var(--status-completed)] border-[var(--status-completed)]',
  data: 'bg-[rgba(56,189,248,0.12)] text-[#38bdf8] border-[#38bdf8]',
  state: 'bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] border-[var(--border)]',
}

type Props = {
  type: DrawingType
  size?: 'sm' | 'md'
}

export function DrawingTypeBadge({ type, size = 'sm' }: Props) {
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
