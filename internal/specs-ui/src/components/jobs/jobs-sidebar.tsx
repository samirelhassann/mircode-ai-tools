import { useMemo, useState } from 'react'
import { ChevronsRight, Square, Terminal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { formatDuration, formatStartedAt } from '@/lib/job-time'
import { jobsApi } from '@/lib/jobs-api'
import { sortedJobs, useJobsStore } from '@/lib/use-jobs-store'
import type { JobStatus } from '@/lib/types'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { JobKindBadge } from './job-kind-badge'
import { StatusDot, statusLabel } from './status-dot'
import { UsageMeter } from './usage-meter'

const OPEN_KEY = 'specs-jobs-sidebar-open'
const PANEL_WIDTH = '288px'
const RAIL_WIDTH = '44px'

const TERMINAL_STATUSES: JobStatus[] = ['done', 'failed', 'cancelled']

function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/**
 * Sidebar de Execuções — painel lateral próprio na borda **direita** da tela
 * (a sidebar de Specs fica na esquerda). Colapsa de forma independente, virando
 * um rail de 44px, e lista os jobs em ordem decrescente de data de execução.
 */
export function JobsSidebar() {
  const jobs = useJobsStore((s) => s.jobs)
  const openDialogs = useJobsStore((s) => s.openDialogs)
  const openDialog = useJobsStore((s) => s.openDialog)
  const removeJob = useJobsStore((s) => s.removeJob)

  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(OPEN_KEY) !== '0'
  })

  function toggle() {
    setOpen((prev) => {
      const next = !prev
      window.localStorage.setItem(OPEN_KEY, next ? '1' : '0')
      return next
    })
  }

  const list = useMemo(() => sortedJobs(jobs), [jobs])
  const activeCount = list.filter((j) => !isTerminal(j.status)).length
  const finishedCount = list.length - activeCount
  // Esperar input é o único estado que pede ação do usuário agora — ele manda no
  // visual do header e do rail, acima de "tem job rodando".
  const awaitingCount = list.filter((j) => j.status === 'needs-input').length
  const runningCount = list.filter((j) => j.status === 'running').length

  async function handleStop(id: string) {
    try {
      await jobsApi.stop(id)
      toast.success('Execução interrompida')
    } catch {
      toast.error('Falha ao interromper execução')
    }
  }

  async function handleRemove(id: string) {
    try {
      await jobsApi.remove(id)
      removeJob(id)
    } catch {
      toast.error('Falha ao remover')
    }
  }

  async function handleClearFinished() {
    await Promise.all(
      list
        .filter((j) => isTerminal(j.status))
        .map(async (j) => {
          try {
            await jobsApi.remove(j.id)
            removeJob(j.id)
          } catch {}
        }),
    )
  }

  const countBadge =
    list.length > 0 ? (
      <span
        className={cn(
          'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
          awaitingCount > 0
            ? 'bg-[color-mix(in_srgb,var(--status-warning,#f59e0b)_20%,transparent)] text-[var(--status-warning,#f59e0b)]'
            : runningCount > 0
              ? 'bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress)]'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)]',
        )}
        title={
          awaitingCount > 0
            ? `${awaitingCount} execução(ões) aguardando input`
            : runningCount > 0
              ? `${runningCount} execução(ões) rodando`
              : 'Nenhuma execução em andamento'
        }
      >
        {activeCount > 0 ? `${activeCount}/${list.length}` : list.length}
      </span>
    ) : null

  return (
    <div
      className="shrink-0 overflow-hidden border-l border-[var(--border)] transition-[width] duration-200 ease-linear"
      style={{ width: open ? PANEL_WIDTH : RAIL_WIDTH }}
    >
      {open ? (
        <Sidebar
          side="right"
          collapsible="none"
          aria-label="Execuções"
          className="h-full"
          style={{ '--sidebar-width': PANEL_WIDTH } as React.CSSProperties}
        >
          <SidebarHeader className="gap-0 p-0">
            <div
              className="flex items-center gap-1.5 border-b border-[var(--border)]"
              style={{ height: '64px', padding: '0 12px 0 8px' }}
            >
              <button
                type="button"
                onClick={toggle}
                title="Recolher Execuções"
                aria-label="Recolher sidebar de Execuções"
                aria-expanded={true}
                className="shrink-0 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                <ChevronsRight className="size-4" aria-hidden="true" />
              </button>
              <Terminal
                className="size-4 shrink-0 text-[var(--text-secondary)]"
                aria-hidden="true"
              />
              <h2 className="flex-1 truncate text-[13px] font-bold text-[var(--text-primary)]">
                Execuções
              </h2>
              {countBadge}
              {finishedCount > 0 ? (
                <button
                  type="button"
                  onClick={handleClearFinished}
                  title={`Limpar ${finishedCount} finalizada(s)`}
                  aria-label={`Limpar ${finishedCount} execução(ões) finalizada(s)`}
                  className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-2">
            {list.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-relaxed text-[var(--text-muted)]">
                Nenhuma execução até agora. Rode uma tarefa para acompanhar o terminal por aqui.
              </p>
            ) : (
              <SidebarMenu>
                {list.map((job) => (
                  <SidebarMenuItem key={job.id}>
                    <SidebarMenuButton
                      onClick={() => openDialog(job.id)}
                      isActive={openDialogs.includes(job.id)}
                      title={`${job.label} — abrir terminal`}
                      className={cn(
                        'h-auto items-start py-1.5',
                        job.status === 'needs-input' &&
                          'border-l-2 border-[var(--status-warning,#f59e0b)] bg-[color-mix(in_srgb,var(--status-warning,#f59e0b)_10%,transparent)]',
                        isTerminal(job.status) && 'opacity-70',
                      )}
                    >
                      <StatusDot status={job.status} className="mt-1 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <JobKindBadge kind={job.kind} />
                          <span className="truncate text-[13px] text-[var(--text-primary)]">
                            {job.label}
                          </span>
                        </span>
                        <span className="block truncate text-[11px] text-[var(--text-muted)]">
                          {formatStartedAt(job.startedAt)} ·{' '}
                          <span
                            className={cn(
                              job.status === 'needs-input' &&
                                'font-semibold text-[var(--status-warning,#f59e0b)]',
                              job.status === 'done' && 'text-[var(--status-completed)]',
                              job.status === 'failed' && 'text-[var(--status-blocked,#ef4444)]',
                            )}
                          >
                            {statusLabel(job.status)}
                          </span>{' '}
                          · {formatDuration(job.startedAt, job.endedAt)}
                          {job.restored ? ' · sessão anterior' : ''}
                        </span>
                        {job.status === 'needs-input' && job.needsInputHint ? (
                          <span
                            className="mt-0.5 block truncate font-mono text-[11px] text-[var(--status-warning,#f59e0b)]"
                            title={job.needsInputHint}
                          >
                            {job.needsInputHint}
                          </span>
                        ) : null}
                      </span>
                    </SidebarMenuButton>
                    {isTerminal(job.status) ? (
                      <SidebarMenuAction
                        showOnHover
                        onClick={() => handleRemove(job.id)}
                        title="Remover do histórico"
                        aria-label={`Remover "${job.label}" do histórico`}
                      >
                        <Trash2 aria-hidden="true" />
                      </SidebarMenuAction>
                    ) : (
                      <SidebarMenuAction
                        showOnHover
                        onClick={() => handleStop(job.id)}
                        title="Parar execução"
                        aria-label={`Parar execução "${job.label}"`}
                        className="hover:text-[var(--status-blocked)]"
                      >
                        <Square aria-hidden="true" />
                      </SidebarMenuAction>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarContent>

          <SidebarFooter className="gap-0 p-0">
            <UsageMeter />
          </SidebarFooter>
        </Sidebar>
      ) : (
        <div
          className="flex h-full flex-col items-center gap-2 bg-[var(--bg-surface)]"
          style={{ width: RAIL_WIDTH, padding: '12px 0' }}
        >
          <button
            type="button"
            onClick={toggle}
            title={
              awaitingCount > 0
                ? `Abrir Execuções — ${awaitingCount} aguardando input`
                : `Abrir Execuções (${list.length})`
            }
            aria-label={
              awaitingCount > 0
                ? `Abrir sidebar de Execuções — ${awaitingCount} aguardando input`
                : `Abrir sidebar de Execuções (${list.length})`
            }
            aria-expanded={false}
            className="relative shrink-0 rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <Terminal className="size-4" aria-hidden="true" />
            {activeCount > 0 ? (
              <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-[var(--bg-surface)] motion-safe:animate-pulse"
                style={{
                  background:
                    awaitingCount > 0
                      ? 'var(--status-warning,#f59e0b)'
                      : 'var(--status-in-progress)',
                }}
                aria-hidden="true"
              />
            ) : null}
          </button>
          {countBadge}
          <span
            className="mt-1 select-none text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
            style={{ writingMode: 'vertical-rl' }}
            aria-hidden="true"
          >
            Execuções
          </span>
        </div>
      )}
    </div>
  )
}
