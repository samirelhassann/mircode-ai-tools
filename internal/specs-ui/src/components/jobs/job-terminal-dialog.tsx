import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Minus, Square, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { jobsApi } from '@/lib/jobs-api'
import { useJobsStore } from '@/lib/use-jobs-store'
import { cn } from '@/lib/cn'
import type { JobStatus } from '@/lib/types'
import { JobKindBadge } from './job-kind-badge'
import { StatusDot, statusLabel } from './status-dot'
import { XtermView } from './xterm-view'

type Props = {
  jobId: string
}

export function JobTerminalDialog({ jobId }: Props) {
  const job = useJobsStore((s) => s.jobs[jobId])
  const closeDialog = useJobsStore((s) => s.closeDialog)
  const removeJob = useJobsStore((s) => s.removeJob)
  const upsertJob = useJobsStore((s) => s.upsertJob)
  const [confirmingStop, setConfirmingStop] = useState(false)

  const { data: initial } = useQuery({
    queryKey: ['job-buffer', jobId],
    queryFn: () => jobsApi.get(jobId),
    staleTime: Infinity,
    refetchOnMount: 'always',
  })

  const isTerminal = useMemo(() => {
    if (!job) return false
    return job.status === 'done' || job.status === 'failed' || job.status === 'cancelled'
  }, [job])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmingStop) {
        // Minimizar com Esc — mantém o job rodando
        e.preventDefault()
        closeDialog(jobId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeDialog, confirmingStop, jobId])

  if (!job) return null

  const status: JobStatus = job.status

  const handleStop = async () => {
    if (isTerminal) return
    if (!confirmingStop) {
      setConfirmingStop(true)
      window.setTimeout(() => setConfirmingStop(false), 3000)
      return
    }
    try {
      await jobsApi.stop(jobId)
      toast.success('Execução interrompida')
      setConfirmingStop(false)
    } catch {
      toast.error('Falha ao interromper execução')
    }
  }

  const handleRemove = async () => {
    if (!isTerminal) return
    try {
      await jobsApi.remove(jobId)
      removeJob(jobId)
    } catch {
      toast.error('Falha ao remover job')
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(v) => {
        if (!v) closeDialog(jobId)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl focus:outline-none flex flex-col overflow-hidden"
          style={{ width: '90vw', maxWidth: '1280px', height: '85vh' }}
        >
          <header
            className="flex items-center justify-between border-b border-[var(--border)] shrink-0"
            style={{ padding: '12px 20px' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <StatusDot status={status} />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <JobKindBadge kind={job.kind} />
                  <Dialog.Title className="truncate text-sm font-semibold">{job.label}</Dialog.Title>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {statusLabel(status)} · PID {job.pid}
                  {typeof job.exitCode === 'number' ? ` · exit ${job.exitCode}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isTerminal ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md border border-[var(--border)]"
                  title="Remover job do histórico"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remover
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStop}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border',
                    confirmingStop
                      ? 'bg-[var(--status-blocked,#ef4444)] text-[#0a0a0a] border-transparent'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                  title={confirmingStop ? 'Confirmar: interromper execução' : 'Parar execução'}
                >
                  <Square className="size-3.5" aria-hidden="true" />
                  {confirmingStop ? 'Confirmar' : 'Parar'}
                </button>
              )}
              <button
                type="button"
                onClick={() => closeDialog(jobId)}
                className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md border border-[var(--border)]"
                title="Minimizar (continua rodando em background)"
              >
                <Minus className="size-3.5" aria-hidden="true" />
                Minimizar
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </header>
          <div className="flex-1 min-h-0 bg-[#0a0a0a]" style={{ padding: '8px' }}>
            {initial ? (
              <XtermView
                jobId={jobId}
                initialBuffer={initial.buffer}
                disabled={isTerminal}
                onStatusChange={(s, exitCode, hint) => {
                  upsertJob({
                    ...job,
                    status: s,
                    exitCode: exitCode ?? job.exitCode,
                    needsInputHint: hint ?? job.needsInputHint,
                  })
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-sm">
                Carregando buffer…
              </div>
            )}
          </div>
          {status === 'needs-input' && job.needsInputHint ? (
            <div
              className="border-t border-[var(--border)] text-xs text-[var(--text-secondary)] shrink-0"
              style={{ padding: '10px 20px' }}
            >
              <span className="text-[var(--status-warning,#f59e0b)] font-medium">
                Aguardando input:
              </span>{' '}
              <span className="font-mono">{job.needsInputHint}</span>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
