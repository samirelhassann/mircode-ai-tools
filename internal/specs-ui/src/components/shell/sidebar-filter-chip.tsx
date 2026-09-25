import { Check, ListFilter } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = {
  active: boolean
  onToggle: () => void
  hiddenCount: number
}

export function SidebarFilterChip({ active, onToggle, hiddenCount }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-pressed={active}
      aria-label={
        active ? `Mostrar todas as specs (${hiddenCount} ocultas)` : 'Ocultar specs concluídas'
      }
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full',
        'border transition-colors',
        active
          ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]'
          : 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]',
      )}
      style={{ height: '22px', padding: '0 10px' }}
    >
      {active ? (
        <Check className="size-3 shrink-0" aria-hidden="true" />
      ) : (
        <ListFilter className="size-3 shrink-0" aria-hidden="true" />
      )}
      <span>Ocultar concluídas</span>
      {active && hiddenCount > 0 ? (
        <span className="text-[var(--text-muted)]">· {hiddenCount}</span>
      ) : null}
    </button>
  )
}
