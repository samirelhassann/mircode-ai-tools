import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Sparkles } from 'lucide-react'
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
import { cn } from '@/lib/cn'

/**
 * Botão "+" do header da seção Discoveries. Abre dialog com textarea. Ao submeter,
 * dispara o agent `discovery-agent` em terminal externo via
 * `POST /api/run-discovery-agent`.
 */
export function NewDiscoveryButton() {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { data: configData } = useConfig()
  const upsertJob = useJobsStore((s) => s.upsertJob)
  const openDialog = useJobsStore((s) => s.openDialog)
  const mode = configData?.config.agent.defaultExecutionMode ?? 'inline'
  const { cli, setCli, clis } = useAgentCli(configData?.config)
  const { model, setModel } = useAgentModel(cli)
  const { effort, setEffort } = useAgentEffort(cli)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = prompt.trim()
    if (trimmed.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const res = await jobsApi.create({
        kind: 'discovery-agent',
        mode,
        cli,
        model,
        effort,
        prompt: trimmed,
      })
      if (res.mode === 'external') {
        toast.success('Agent `discovery-agent` iniciado em novo terminal.')
      } else {
        upsertJob(res.job)
        openDialog(res.jobId)
      }
      setOpen(false)
      setPrompt('')
    } catch (err) {
      const detail = (err as Error & { detail?: { error?: string; hint?: string } }).detail
      const hint = detail?.hint
      toast.error(
        hint
          ? `Não foi possível iniciar o agent. ${hint}`
          : 'Não foi possível iniciar o agent. Veja o console do servidor.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Nova discovery (abrir dialog do discovery-agent)"
          title="Nova discovery"
          className={cn(
            'p-1 rounded transition-colors',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)]',
          )}
        >
          <Plus className="size-[18px]" aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl focus:outline-none w-[540px] max-w-[calc(100vw-32px)]">
          <div
            className="flex items-center justify-between border-b border-[var(--border)]"
            style={{ padding: '20px 24px' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-[18px] text-[var(--accent)]" aria-hidden="true" />
              <Dialog.Title className="text-[15px] font-bold text-[var(--text-primary)]">
                Nova discovery
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
                Descreva a análise, spike, RFC ou ADR que deseja produzir. O agent{' '}
                <code className="text-[var(--accent)]">discovery-agent</code> vai ser disparado em
                um novo terminal e pode perguntar detalhes para gerar o documento em{' '}
                <code className="text-[var(--accent)]">.specs/discoveries/</code>.
              </Dialog.Description>
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: avaliar alternativas de gateway de pagamento comparando Stripe, Pagar.me e Asaas para PIX + cartão..."
                rows={6}
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
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Dica: especifique tipo (RFC, spike, ADR, note), objetivo e restrições do problema.
              </p>
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
                disabled={submitting || prompt.trim().length === 0}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-lg',
                  'bg-[var(--accent)] text-[var(--bg-surface)]',
                  'hover:opacity-90 transition-opacity',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                style={{ height: '32px', padding: '0 14px' }}
              >
                <Sparkles className="size-[13px]" aria-hidden="true" />
                {submitting ? 'Iniciando…' : 'Disparar agent'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
