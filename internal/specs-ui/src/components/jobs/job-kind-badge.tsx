import type { JobKind } from '@/lib/types'
import { cn } from '@/lib/cn'

/**
 * Rótulo curto por origem da execução. Fala a linguagem das seções da UI, não a
 * dos agents: quem lê a sidebar quer saber "isso veio de qual lugar?", e o nome
 * do subagent (`drawing-agent`) não responde isso.
 */
const LABEL: Record<JobKind, string> = {
  agent: 'Spec',
  refinement: 'Refino',
  'refinement-runner': 'Refino+exec',
  'discovery-agent': 'Discovery',
  'drawing-agent': 'Desenho',
  design: 'Protótipo',
}

/**
 * Cada origem tem cor própria, e nenhuma delas é o âmbar de "aguardando input" —
 * o realce da linha precisa continuar sendo a única coisa âmbar da sidebar.
 */
const CLASSES: Record<JobKind, string> = {
  agent: 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]',
  refinement: 'bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] border-[var(--border)]',
  'refinement-runner': 'bg-[rgba(167,139,250,0.12)] text-[#a78bfa] border-[#a78bfa]',
  'discovery-agent':
    'bg-[color-mix(in_srgb,var(--status-completed)_15%,transparent)] text-[var(--status-completed)] border-[var(--status-completed)]',
  'drawing-agent': 'bg-[rgba(56,189,248,0.12)] text-[#38bdf8] border-[#38bdf8]',
  design: 'bg-[rgba(244,114,182,0.12)] text-[#f472b6] border-[#f472b6]',
}

export function JobKindBadge({ kind }: { kind: JobKind }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded border text-[9px] font-semibold uppercase tracking-wide',
        CLASSES[kind],
      )}
      style={{ height: '14px', padding: '0 4px', letterSpacing: '0.04em' }}
    >
      {LABEL[kind]}
    </span>
  )
}

export function jobKindLabel(kind: JobKind): string {
  return LABEL[kind]
}
