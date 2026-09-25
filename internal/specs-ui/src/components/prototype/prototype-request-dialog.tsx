import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { jobsApi } from '@/lib/jobs-api'
import { useConfig } from '@/hooks/use-config'
import { useAgentCli } from '@/hooks/use-agent-cli'
import { useAgentModel } from '@/hooks/use-agent-model'
import { useAgentEffort } from '@/hooks/use-agent-effort'
import { AgentCliSelect } from '@/components/agent-cli-select'
import { AgentModelSelect } from '@/components/agent-model-select'
import { AgentEffortSelect } from '@/components/agent-effort-select'
import { useJobsStore } from '@/lib/use-jobs-store'
import type { PrototypeResolved } from '@/lib/types'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prototype: PrototypeResolved
  feature?: string
  task?: string
}

/**
 * Pedido de alteração no protótipo. O servidor é quem monta o prompt final a
 * partir da ferramenta declarada — `/design` no Claude Design, instrução de
 * Pencil MCP no Pencil — então aqui só coletamos o texto e o contexto.
 */
export function PrototypeRequestDialog({ open, onOpenChange, prototype, feature, task }: Props) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { data: configData } = useConfig()
  const upsertJob = useJobsStore((s) => s.upsertJob)
  const openJobDialog = useJobsStore((s) => s.openDialog)
  const mode = configData?.config.agent.defaultExecutionMode ?? 'inline'
  const { cli, setCli, clis } = useAgentCli(configData?.config)
  const { model, setModel } = useAgentModel(cli)
  const { effort, setEffort } = useAgentEffort(cli)

  const isClaudeDesign = prototype.tool === 'claude-design'

  useEffect(() => {
    if (open) setMessage('')
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (trimmed.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const res = await jobsApi.create({
        kind: 'design',
        mode,
        cli,
        model,
        effort,
        prompt: trimmed,
        feature,
        task,
      })
      if (res.mode === 'external') {
        toast.success('Pedido de alteração iniciado em novo terminal.')
      } else {
        upsertJob(res.job)
        openJobDialog(res.jobId)
      }
      onOpenChange(false)
    } catch (err) {
      const detail = (err as Error & { detail?: { error?: string; hint?: string } }).detail
      if (detail?.error === 'no_prototype') {
        toast.error('Nenhum protótipo declarado em .specs/config.json.')
      } else {
        toast.error(
          detail?.hint
            ? `Não foi possível iniciar o pedido. ${detail.hint}`
            : 'Não foi possível iniciar o pedido. Veja o console do servidor.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl focus:outline-none w-[560px] max-w-[calc(100vw-32px)]">
          <div
            className="flex items-center justify-between border-b border-[var(--border)]"
            style={{ padding: '20px 24px' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-[18px] text-[var(--accent)]" aria-hidden="true" />
              <Dialog.Title className="text-[15px] font-bold text-[var(--text-primary)]">
                Pedir alteração no protótipo
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="size-[18px]" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '16px 24px' }}>
              <Dialog.Description className="text-sm text-[var(--text-secondary)] mb-3">
                {isClaudeDesign ? (
                  <>
                    O pedido vai para o Claude Code como{' '}
                    <code className="text-[var(--accent)]">/design</code>, sobre o canvas{' '}
                    <code className="text-[var(--accent)] font-mono text-[12px]">
                      {prototype.title ?? prototype.url}
                    </code>
                    .
                  </>
                ) : (
                  <>
                    O pedido vai para o Claude Code com instrução de editar{' '}
                    <code className="text-[var(--accent)] font-mono text-[12px]">
                      {prototype.file}
                    </code>{' '}
                    pelo Pencil MCP, devolvendo os node IDs afetados.
                  </>
                )}
              </Dialog.Description>
              <textarea
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  isClaudeDesign
                    ? 'Ex: trocar a fileira de KPIs por 3 cards e mover o alerta de conta vencida para o topo da coluna lateral...'
                    : 'Ex: aumentar o espaçamento entre os cards do dashboard e alinhar os rótulos à esquerda...'
                }
                rows={5}
                required
                disabled={submitting}
                className={cn(
                  'w-full rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]',
                  'px-3 py-2 text-sm text-[var(--text-primary)]',
                  'placeholder:text-[var(--text-muted)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
                  'resize-none',
                  submitting && 'opacity-60 cursor-not-allowed',
                )}
              />
              {task ? (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  A task <code className="text-[var(--text-secondary)]">{task}</code> vai junto como
                  contexto do pedido.
                </p>
              ) : null}
              <AgentCliSelect clis={clis} value={cli} onChange={setCli} className="mt-4" />
              <div className="grid grid-cols-[3fr_2fr] gap-3 mt-4">
                <AgentModelSelect cli={cli} value={model} onChange={setModel} />
                <AgentEffortSelect cli={cli} value={effort} onChange={setEffort} model={model} />
              </div>
            </div>
            <div
              className="flex items-center justify-end gap-2 border-t border-[var(--border)]"
              style={{ padding: '16px 24px' }}
            >
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={submitting}
                  className={cn(
                    'text-[13px] font-medium rounded-lg transition-colors',
                    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    'hover:bg-[rgba(255,255,255,0.03)]',
                    submitting && 'opacity-60 cursor-not-allowed',
                  )}
                  style={{ height: '32px', padding: '0 14px' }}
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting || message.trim().length === 0}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-lg',
                  'bg-[var(--accent)] text-[var(--bg-surface)]',
                  'hover:opacity-90 transition-opacity',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                style={{ height: '32px', padding: '0 14px' }}
              >
                <Sparkles className="size-[13px]" aria-hidden="true" />
                {submitting ? 'Iniciando…' : 'Enviar pedido'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
