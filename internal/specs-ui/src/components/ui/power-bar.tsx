import { cn } from '@/lib/cn'

type Props = {
  /** 1 = mais leve/barato, 4 = mais potente/caro. */
  level: number
  total?: number
  className?: string
}

/**
 * Barra de potência do modelo: quanto mais segmentos acesos, mais capaz — e mais
 * caro. A cor acompanha a escala (verde leve → amarelo → vermelho pesado), então
 * o custo é legível de relance sem ler o preço.
 */
const TONE: Array<{ color: string; label: string }> = [
  { color: 'var(--status-completed)', label: 'leve' },
  { color: 'var(--status-completed)', label: 'equilibrado' },
  { color: 'var(--status-in-progress)', label: 'potente' },
  { color: 'var(--status-blocked)', label: 'máximo' },
]

export function PowerBar({ level, total = 4, className }: Props) {
  const clamped = Math.max(1, Math.min(level, total))
  const tone = TONE[clamped - 1] ?? TONE[TONE.length - 1]

  return (
    <span
      className={cn('inline-flex items-center gap-[3px]', className)}
      role="img"
      aria-label={`Potência ${clamped} de ${total} (${tone?.label})`}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: segmentos fixos de uma escala
          key={index}
          className="rounded-[1px]"
          style={{
            width: '5px',
            height: '11px',
            background: index < clamped ? tone?.color : 'var(--border)',
            opacity: index < clamped ? 1 : 0.7,
          }}
        />
      ))}
    </span>
  )
}
