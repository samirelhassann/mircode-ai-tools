import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as RadioGroup from '@radix-ui/react-radio-group'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AgentCliSelect } from '@/components/agent-cli-select'
import { AgentModelSelect } from '@/components/agent-model-select'
import { AgentEffortSelect } from '@/components/agent-effort-select'
import { useAgentCli } from '@/hooks/use-agent-cli'
import { useAgentModel } from '@/hooks/use-agent-model'
import { useAgentEffort } from '@/hooks/use-agent-effort'
import type { AgentCli, AgentEffort, AgentScopeKey, SpecsConfig } from '@/lib/types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  featureSlug: string
  taskSlug: string | undefined
  config: SpecsConfig | undefined
  onRun: (
    scope: AgentScopeKey,
    cli: AgentCli,
    model: string | undefined,
    effort: AgentEffort | undefined,
  ) => void
}

const SCOPE_OPTIONS: Array<{ value: AgentScopeKey; label: string; description: string }> = [
  {
    value: 'feature',
    label: 'Feature inteira',
    description: 'Executa a próxima task pendente; pausa entre tasks para code review.',
  },
  {
    value: 'task',
    label: 'Task atual',
    description: 'Executa apenas a task selecionada. Atalho: R.',
  },
  {
    value: 'featureNoPause',
    label: 'Feature sem pausar',
    description: 'Executa todas as tasks em sequência. E2E e review apenas ao final.',
  },
]

export function RunAgentModal({ open, onOpenChange, taskSlug, config, onRun }: Props) {
  const defaultScope: AgentScopeKey = taskSlug ? 'task' : 'feature'
  const [scope, setScope] = useState<AgentScopeKey>(defaultScope)
  const { cli, setCli, clis } = useAgentCli(config)
  const { model, setModel } = useAgentModel(cli)
  const { effort, setEffort } = useAgentEffort(cli)

  useEffect(() => {
    if (open) setScope(taskSlug ? 'task' : 'feature')
  }, [open, taskSlug])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl focus:outline-none"
          style={{ width: '640px' }}
        >
          <div
            className="flex items-center justify-between border-b border-[var(--border)]"
            style={{ padding: '20px 24px' }}
          >
            <Dialog.Title className="text-[15px] font-bold">Rodar Tarefa</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="size-[18px]" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div style={{ padding: '16px 24px 4px' }}>
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">
              Escopo
            </p>
            <RadioGroup.Root
              value={scope}
              onValueChange={(v) => setScope(v as AgentScopeKey)}
              className="flex flex-col gap-2"
            >
              {SCOPE_OPTIONS.map((opt) => {
                const disabled = opt.value === 'task' && !taskSlug
                return (
                  <RadioGroup.Item
                    key={opt.value}
                    value={opt.value}
                    disabled={disabled}
                    className={cn(
                      'text-left rounded-lg border p-3 transition-colors',
                      'border-[var(--border)] bg-transparent',
                      'data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent-subtle-weak)]',
                      !disabled && 'hover:border-[var(--text-secondary)]',
                      disabled && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'size-4 rounded-full border flex items-center justify-center',
                          scope === opt.value
                            ? 'border-[var(--accent)]'
                            : 'border-[var(--text-muted)]',
                        )}
                      >
                        {scope === opt.value ? (
                          <span className="size-2 rounded-full bg-[var(--accent)]" />
                        ) : null}
                      </div>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 pl-6">
                      {opt.description}
                    </p>
                  </RadioGroup.Item>
                )
              })}
            </RadioGroup.Root>
          </div>
          <AgentCliSelect clis={clis} value={cli} onChange={setCli} className="px-6 pb-4" />
          <div className="grid grid-cols-[3fr_2fr] gap-3" style={{ padding: '0 24px 16px' }}>
            <AgentModelSelect cli={cli} value={model} onChange={setModel} />
            <AgentEffortSelect cli={cli} value={effort} onChange={setEffort} model={model} />
          </div>
          <div
            className="flex justify-end gap-2 border-t border-[var(--border)]"
            style={{ padding: '16px 24px' }}
          >
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-transparent border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[var(--accent)]"
              >
                Cancelar
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => onRun(scope, cli, model, effort)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--status-completed)', color: '#0a0a0a' }}
            >
              Executar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
