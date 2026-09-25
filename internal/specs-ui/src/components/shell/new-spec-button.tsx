import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Sparkles, FileText, Rocket, ChevronLeft } from 'lucide-react'
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
 * As duas saídas do botão "+". `refinement` documenta a spec e para; a execução
 * fica para o `feature-runner`, depois. `refinement-runner` refina em memória,
 * tira todas as dúvidas antes de codar e já implementa — sem criar documento em
 * `.specs/specs/`.
 */
type SpecMode = 'refinement' | 'refinement-runner'

const MODES: {
  kind: SpecMode
  icon: typeof FileText
  title: string
  tagline: string
  detail: string
  submitLabel: string
  placeholder: string
  hint: string
}[] = [
  {
    kind: 'refinement',
    icon: FileText,
    title: 'Refinamento',
    tagline: 'Documenta a spec e para',
    detail:
      'O agent `refinement` analisa o projeto e escreve a task em `.specs/specs/`, pronta para o `feature-runner` executar depois.',
    submitLabel: 'Refinar',
    placeholder:
      'Ex: uma tela de listagem de usuários com filtros por role e paginação server-side...',
    hint: 'Dica: seja específico sobre o quê, onde e por quê. O agent vai validar contra as specs existentes.',
  },
  {
    kind: 'refinement-runner',
    icon: Rocket,
    title: 'Refinamento + execução',
    tagline: 'Refina, tira as dúvidas e já implementa',
    detail:
      'O agent `refinement-runner` esgota as perguntas antes de tocar no código, implementa e para no code review. Não cria documento de spec.',
    submitLabel: 'Refinar e executar',
    placeholder: 'Ex: o filtro de role da tela de usuários está ignorando o valor "admin"...',
    hint: 'Dica: use para o que não compensa documentar. O agent vai perguntar tudo que ficar ambíguo antes de codar.',
  },
]

/**
 * Botão "+" na topbar da sidebar. Abre um dialog em dois passos: primeiro a
 * escolha entre refinar e refinar+executar, depois o textarea. Ao submeter,
 * dispara o agent correspondente via `POST /api/jobs`.
 */
export function NewSpecButton() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<SpecMode | null>(null)
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { data: configData } = useConfig()
  const upsertJob = useJobsStore((s) => s.upsertJob)
  const openDialog = useJobsStore((s) => s.openDialog)
  const executionMode = configData?.config.agent.defaultExecutionMode ?? 'inline'
  const { cli, setCli, clis } = useAgentCli(configData?.config)
  const { model, setModel } = useAgentModel(cli)
  const { effort, setEffort } = useAgentEffort(cli)

  const selected = MODES.find((m) => m.kind === mode) ?? null

  function reset() {
    setMode(null)
    setPrompt('')
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = prompt.trim()
    if (trimmed.length === 0 || submitting || !selected) return
    setSubmitting(true)
    try {
      const res = await jobsApi.create({
        kind: selected.kind,
        mode: executionMode,
        cli,
        model,
        effort,
        prompt: trimmed,
      })
      if (res.mode === 'external') {
        toast.success(`Agent \`${selected.kind}\` iniciado em novo terminal.`)
      } else {
        upsertJob(res.job)
        openDialog(res.jobId)
      }
      setOpen(false)
      reset()
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
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Nova spec (abrir dialog de refinamento)"
          title="Nova spec"
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
              {selected ? (
                <button
                  type="button"
                  onClick={reset}
                  disabled={submitting}
                  aria-label="Voltar para a escolha do modo"
                  className={cn(
                    '-ml-1 p-0.5 rounded transition-colors',
                    'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)]',
                    submitting && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <ChevronLeft className="size-[18px]" aria-hidden="true" />
                </button>
              ) : (
                <Sparkles className="size-[18px] text-[var(--accent)]" aria-hidden="true" />
              )}
              <Dialog.Title className="text-[15px] font-bold text-[var(--text-primary)]">
                {selected ? `Nova spec — ${selected.title.toLowerCase()}` : 'Nova spec'}
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

          {selected === null ? (
            <div style={{ padding: '16px 24px 24px' }}>
              <Dialog.Description className="text-sm text-[var(--text-secondary)] mb-4">
                O que você quer fazer com essa atividade?
              </Dialog.Description>
              <div className="grid grid-cols-2 gap-3">
                {MODES.map((m) => {
                  const Icon = m.icon
                  return (
                    <button
                      key={m.kind}
                      type="button"
                      onClick={() => setMode(m.kind)}
                      className={cn(
                        'flex flex-col items-start gap-1.5 text-left rounded-lg',
                        'bg-[var(--bg-surface)] border border-[var(--border)]',
                        'hover:border-[var(--accent)] hover:bg-[rgba(255,255,255,0.03)]',
                        'focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
                        'transition-colors',
                      )}
                      style={{ padding: '14px 16px' }}
                    >
                      <Icon
                        className="size-[18px] text-[var(--accent)] shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                        {m.title}
                      </span>
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {m.tagline}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] leading-snug">
                        {m.detail}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ padding: '16px 24px' }}>
                <Dialog.Description className="text-sm text-[var(--text-secondary)] mb-3">
                  {selected.detail}
                </Dialog.Description>
                <textarea
                  autoFocus
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={selected.placeholder}
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
                <p className="text-xs text-[var(--text-muted)] mt-2">{selected.hint}</p>
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
                <button
                  type="button"
                  onClick={reset}
                  disabled={submitting}
                  className={cn(
                    'text-[13px] font-medium rounded-lg transition-colors',
                    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    'hover:bg-[rgba(255,255,255,0.03)]',
                    submitting && 'opacity-60 cursor-not-allowed',
                  )}
                  style={{ height: '32px', padding: '0 14px' }}
                >
                  Voltar
                </button>
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
                  {submitting ? 'Iniciando…' : selected.submitLabel}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
