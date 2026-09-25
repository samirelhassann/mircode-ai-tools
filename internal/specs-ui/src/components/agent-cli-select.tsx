import * as RadioGroup from '@radix-ui/react-radio-group'
import { CLI_DESCRIPTIONS, cliLabel } from '@/hooks/use-agent-cli'
import type { AgentCli } from '@/lib/types'
import { cn } from '@/lib/cn'

type Props = {
  clis: string[]
  value: AgentCli
  onChange: (cli: AgentCli) => void
  /** Esconde o título "Ferramenta" (para layouts compactos). */
  hideLabel?: boolean
  className?: string
}

/**
 * Seletor da CLI de agente (Claude Code / Cursor / ...). As opções vêm das
 * chaves de `agent.commands` no `.specs/config.json`. Não renderiza nada quando
 * há uma única CLI disponível.
 */
export function AgentCliSelect({ clis, value, onChange, hideLabel, className }: Props) {
  if (clis.length <= 1) return null

  return (
    <div className={className}>
      {!hideLabel ? (
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">
          Ferramenta
        </p>
      ) : null}
      <RadioGroup.Root
        value={value}
        onValueChange={(v) => onChange(v as AgentCli)}
        className={cn('grid gap-2', clis.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}
      >
        {clis.map((cli) => (
          <RadioGroup.Item
            key={cli}
            value={cli}
            className={cn(
              'text-left rounded-lg border p-3 transition-colors',
              'border-[var(--border)] bg-transparent',
              'data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent-subtle-weak)]',
              'hover:border-[var(--text-secondary)]',
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'size-4 rounded-full border flex items-center justify-center',
                  value === cli ? 'border-[var(--accent)]' : 'border-[var(--text-muted)]',
                )}
              >
                {value === cli ? <span className="size-2 rounded-full bg-[var(--accent)]" /> : null}
              </div>
              <span className="text-sm font-medium">{cliLabel(cli)}</span>
            </div>
            {CLI_DESCRIPTIONS[cli] ? (
              <p className="text-xs text-[var(--text-secondary)] mt-1 pl-6">
                {CLI_DESCRIPTIONS[cli]}
              </p>
            ) : null}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </div>
  )
}
