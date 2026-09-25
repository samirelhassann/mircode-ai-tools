import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatAge, formatCountdown } from '@/lib/job-time'
import { isExpired, isStale, sessionState } from '@/lib/usage-view'
import { useUsage } from '@/hooks/use-usage'
import type { UsageSource, UsageWindow } from '@/lib/types'

/**
 * O que fazer para o número voltar a andar. Depende de quem gravou a última
 * medida: o app desktop só escreve enquanto está aberto, e o snapshot do
 * statusLine só é reescrito enquanto há sessão do Claude Code rodando.
 */
function howToRefresh(source: UsageSource): string {
  if (source === 'statusline') {
    return 'A medida vem do statusLine do Claude Code. Rode uma sessão para atualizar.'
  }
  return 'A medida vem do app desktop do Claude, que só grava enquanto está aberto. Abra o app para atualizar.'
}

/**
 * Cor do preenchimento por faixa de consumo — mesma escala de status usada no
 * resto da plataforma, então "estou perto do limite" se lê sem contar número.
 */
function toneFor(percentage: number): string {
  if (percentage >= 90) return 'var(--status-blocked)'
  if (percentage >= 70) return 'var(--status-in-progress)'
  return 'var(--accent)'
}

type BarProps = {
  label: string
  window: UsageWindow
  now: number
  stale: boolean
  /** Janela de sessão: pode estar parada esperando a próxima mensagem. */
  isSession?: boolean
}

function UsageBar({ label, window: win, now, stale, isSession = false }: BarProps) {
  const used = Math.round(win.usedPercentage)
  const tone = stale ? 'var(--text-muted)' : toneFor(used)
  const state = isSession ? sessionState(win, stale) : 'running'

  // O que sobra da janela já está dito pela porcentagem e pela barra; a única
  // coisa que elas não contam é **quando isso zera**. Sem reset conhecido não há
  // rodapé — repetir "N% restante" seria dizer a mesma coisa três vezes.
  let footnote: string | null
  if (stale) {
    footnote = 'medida congelada — veja como atualizar no ícone de alerta'
  } else if (state === 'idle') {
    footnote = 'janela parada · começa na próxima mensagem'
  } else if (win.resetsAt !== null) {
    footnote = `reseta em ~${formatCountdown(win.resetsAt * 1000, now)}`
  } else {
    footnote = null
  }

  return (
    <div className={cn('flex flex-col gap-1', stale && 'opacity-60')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: tone }}>
          {used}%
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-card)]"
        role="progressbar"
        aria-label={`${label}: ${used}% usado${stale ? ' (medida desatualizada)' : ''}`}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${used > 0 ? Math.max(used, 2) : 0}%`, background: tone }}
        />
      </div>

      {footnote ? (
        <span className="text-[10px] text-[var(--text-muted)]">{footnote}</span>
      ) : null}
    </div>
  )
}

/**
 * Medidor de uso do plano no rodapé da sidebar de Execuções. A fonte é local: o
 * histórico que o app desktop do Claude grava a cada ~15–25 min (ou, como
 * fallback, o cache de rate limits do CLI). Sem nenhuma das duas, não aparece.
 *
 * Passando do intervalo normal de gravação (45 min) o bloco esmaece e se declara
 * congelado; passando de 12 horas ele **para de mostrar as porcentagens** — um
 * número velho aqui é pior que número nenhum, porque a janela de sessão virou
 * várias vezes desde então.
 */
export function UsageMeter({ className }: { className?: string }) {
  const { data } = useUsage()
  const usage = data?.usage

  // O countdown e o "há N min" precisam andar sozinhos: o dado em si só muda
  // quando uma amostra nova é gravada.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!usage || (!usage.fiveHour && !usage.sevenDay)) return null
  const stale = isStale(usage.measuredAt, now)

  // Passado o limite de expiração, a porcentagem não descreve mais nada: as
  // janelas já viraram. Some com as barras e diga o que aconteceu — número velho
  // com aparência de número atual é pior que número nenhum.
  if (isExpired(usage.measuredAt, now)) {
    return (
      <div
        className={cn('flex flex-col gap-1 border-t border-[var(--border)]', className)}
        style={{ padding: '12px 14px 14px' }}
      >
        <span
          className="text-[10px] font-bold uppercase text-[var(--text-muted)]"
          style={{ letterSpacing: '1.2px' }}
        >
          Uso do plano
        </span>
        <span className="inline-flex items-start gap-1.5 text-[11px] text-[var(--status-in-progress)]">
          <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span>sem medida há {formatAge(usage.measuredAt, now).replace(/^há /, '')}</span>
        </span>
        <span className="text-[10px] leading-relaxed text-[var(--text-muted)]">
          {howToRefresh(usage.source)}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn('flex flex-col gap-3 border-t border-[var(--border)]', className)}
      style={{ padding: '12px 14px 14px' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[10px] font-bold uppercase text-[var(--text-muted)]"
          style={{ letterSpacing: '1.2px' }}
        >
          Uso do plano
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] tabular-nums',
            stale ? 'text-[var(--status-in-progress)]' : 'text-[var(--text-muted)]',
          )}
          title={
            stale
              ? `Estes números estão congelados. ${howToRefresh(usage.source)}`
              : 'Quando esta medida foi gravada.'
          }
        >
          {stale ? <AlertTriangle className="size-3" aria-hidden="true" /> : null}
          {formatAge(usage.measuredAt, now)}
        </span>
      </div>
      {usage.fiveHour ? (
        <UsageBar label="Sessão" window={usage.fiveHour} now={now} stale={stale} isSession />
      ) : null}
      {usage.sevenDay ? (
        <UsageBar label="Semana" window={usage.sevenDay} now={now} stale={stale} />
      ) : null}
    </div>
  )
}
