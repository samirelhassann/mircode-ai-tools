import { useEffect, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { jobsApi, type CreateJobResponse } from '@/lib/jobs-api'
import { useConfig } from '@/hooks/use-config'
import { getAvailableClis, readStoredCli } from '@/hooks/use-agent-cli'
import { readStoredModel } from '@/hooks/use-agent-model'
import { readStoredEffort } from '@/hooks/use-agent-effort'
import { useJobsStore } from '@/lib/use-jobs-store'
import type { AgentCli, AgentEffort, AgentScopeKey } from '@/lib/types'
import { cn } from '@/lib/cn'
import { RunAgentModal } from './run-agent-modal'

type Props = {
  featureSlug: string | undefined
  taskSlug: string | undefined
}

export function RunAgentButton({ featureSlug, taskSlug }: Props) {
  const [open, setOpen] = useState(false)
  const { data: configData } = useConfig()
  const upsertJob = useJobsStore((s) => s.upsertJob)
  const openDialog = useJobsStore((s) => s.openDialog)

  const mutation = useMutation({
    mutationFn: ({
      scope,
      feature,
      task,
      cli,
      model,
      effort,
    }: {
      scope: AgentScopeKey
      feature: string
      task?: string
      cli: AgentCli
      model: string | undefined
      effort: AgentEffort | undefined
    }) =>
      jobsApi.create({
        kind: 'agent',
        mode: 'inline',
        cli,
        model,
        effort,
        scope,
        feature,
        task,
      }) as Promise<CreateJobResponse>,
    onSuccess: (res) => {
      if (res.mode === 'external') {
        toast.success('Agent iniciado em novo terminal.')
      } else {
        upsertJob(res.job)
        openDialog(res.jobId)
      }
    },
    onError: (err: unknown) => {
      const status = (err as Error & { status?: number }).status
      if (status === 501) {
        toast.error(
          'Execução via terminal externo desabilitada. Ajuste agent.openTerminal no .specs/config.json ou use modo inline.',
        )
      } else {
        toast.error('Não foi possível iniciar o agent. Veja o console do servidor specs.')
      }
    },
  })

  function runTaskDirect() {
    if (!featureSlug || !taskSlug) return
    const clis = getAvailableClis(configData?.config)
    const cli = readStoredCli(clis, configData?.config.agent.cli ?? 'claude')
    const model = readStoredModel(cli)
    const effort = readStoredEffort(cli)
    mutation.mutate({
      scope: 'task',
      feature: featureSlug,
      task: taskSlug,
      cli,
      model,
      effort,
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'r') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return
      }
      // Com um modal ou um select aberto a tecla é conteúdo, não atalho — sem
      // isto, digitar "grok" na busca de modelos dispararia uma execução.
      if (document.querySelector('[role="dialog"], [role="listbox"]')) return
      if (!featureSlug || !taskSlug) return
      e.preventDefault()
      runTaskDirect()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureSlug, taskSlug])

  if (!featureSlug) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (e.altKey && taskSlug) {
            e.preventDefault()
            runTaskDirect()
            return
          }
          setOpen(true)
        }}
        disabled={mutation.isPending}
        className={cn(
          'inline-flex items-center text-[13px] font-semibold rounded-lg transition-opacity',
          'text-[#0a0a0a]',
          mutation.isPending && 'opacity-60',
        )}
        style={{
          height: '32px',
          padding: '0 14px',
          gap: '6px',
          background: 'var(--status-completed)',
        }}
        title={taskSlug ? 'Atalho: R' : 'Rodar Tarefa'}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
        Rodar Tarefa
      </button>
      <RunAgentModal
        open={open}
        onOpenChange={setOpen}
        featureSlug={featureSlug}
        taskSlug={taskSlug}
        config={configData?.config}
        onRun={(scope, cli, model, effort) => {
          setOpen(false)
          mutation.mutate({
            scope,
            feature: featureSlug,
            task: taskSlug,
            cli,
            model,
            effort,
          })
        }}
      />
    </>
  )
}
