import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral'

type Props = {
  children: ReactNode
  tone?: Tone
  className?: string
  title?: string
}

const TONE_COLOR: Record<Tone, { fg: string; bg: string }> = {
  success: { fg: 'var(--status-completed)', bg: 'rgba(142, 255, 109, 0.12)' },
  warning: { fg: 'var(--status-in-progress)', bg: 'var(--status-in-progress-bg)' },
  danger: { fg: 'var(--status-blocked)', bg: 'rgba(239, 68, 68, 0.12)' },
  accent: { fg: 'var(--accent)', bg: 'var(--accent-subtle-weak)' },
  neutral: { fg: 'var(--text-muted)', bg: 'var(--bg-surface)' },
}

/** Selo curto — status, promoção, categoria. */
export function Badge({ children, tone = 'neutral', className, title }: Props) {
  const color = TONE_COLOR[tone]
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full text-[9px] font-bold uppercase',
        className,
      )}
      style={{
        color: color.fg,
        background: color.bg,
        letterSpacing: '0.6px',
        padding: '2px 6px',
        lineHeight: 1.3,
      }}
    >
      {children}
    </span>
  )
}
