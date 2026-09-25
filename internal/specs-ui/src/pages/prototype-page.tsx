import { useState } from 'react'
import { ExternalLink, Frame, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { jobsApi } from '@/lib/jobs-api'
import { useConfig } from '@/hooks/use-config'
import { useJobsStore } from '@/lib/use-jobs-store'
import { usePrototype } from '@/hooks/use-prototype'
import { PrototypeRequestDialog } from '@/components/prototype/prototype-request-dialog'
import { BodySkeleton } from '@/components/skeletons/body-skeleton'
import { ErrorCard } from '@/components/empty-states/error-card'
import { cn } from '@/lib/cn'

const TOOL_LABEL: Record<string, string> = {
  'claude-design': 'Claude Design',
  pencil: 'Pencil',
}

const actionButton = cn(
  'inline-flex items-center gap-1.5 text-[13px] font-medium rounded-lg',
  'border border-[var(--border)] text-[var(--text-primary)]',
  'hover:bg-[rgba(255,255,255,0.03)] transition-colors',
  'disabled:opacity-50 disabled:cursor-not-allowed',
)

/**
 * Página do protótipo. O canvas remoto recusa embed (`frame-ancestors 'self'`),
 * então o que vai no iframe é o **snapshot local** servido pela própria
 * plataforma — mesma origem, sem sair da aba.
 */
export function PrototypePage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const { data: configData } = useConfig()
  const upsertJob = useJobsStore((s) => s.upsertJob)
  const openJobDialog = useJobsStore((s) => s.openDialog)
  const { data, isLoading, isError, refetch } = usePrototype()
  const prototype = data?.prototype

  if (isLoading) return <BodySkeleton />
  if (isError) {
    return (
      <div style={{ padding: '40px 48px' }}>
        <ErrorCard what="o protótipo do projeto" onRetry={() => void refetch()} />
      </div>
    )
  }

  if (!prototype) {
    return (
      <div style={{ padding: '40px 48px' }} className="max-w-[620px]">
        <h1 className="text-[22px] font-bold text-[var(--text-primary)] mb-3">Protótipo</h1>
        <p className="text-sm text-[var(--text-secondary)] leading-[1.6]">
          Nenhum protótipo declarado. Preencha o bloco{' '}
          <code className="text-[var(--accent)] font-mono text-[12px]">prototype</code> do{' '}
          <code className="font-mono text-[12px]">.specs/config.json</code> com{' '}
          <code className="font-mono text-[12px]">tool</code> (
          <code className="font-mono text-[12px]">claude-design</code> ou{' '}
          <code className="font-mono text-[12px]">pencil</code>) e a{' '}
          <code className="font-mono text-[12px]">url</code> /{' '}
          <code className="font-mono text-[12px]">file</code> correspondente.
        </p>
      </div>
    )
  }

  const isClaudeDesign = prototype.tool === 'claude-design'

  async function handleSyncSnapshot() {
    setSyncing(true)
    try {
      const res = await jobsApi.create({
        kind: 'design',
        mode: configData?.config.agent.defaultExecutionMode ?? 'inline',
        intent: 'snapshot',
        prompt: 'Sincronizar o snapshot local do protótipo.',
      })
      if (res.mode === 'external') {
        toast.success('Sincronização iniciada em novo terminal.')
      } else {
        upsertJob(res.job)
        openJobDialog(res.jobId)
      }
    } catch {
      toast.error('Não foi possível iniciar a sincronização.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleOpenLocal() {
    setOpening(true)
    try {
      await api.openPrototype()
      toast.success('Abrindo o protótipo no app local.')
    } catch {
      toast.error('Não foi possível abrir o protótipo. Confira `prototype.openCommand`.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between gap-4 border-b border-[var(--border)] shrink-0"
        style={{ height: '64px', padding: '0 24px' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Frame className="size-[18px] text-[var(--accent)] shrink-0" aria-hidden="true" />
          <h1 className="text-[15px] font-bold text-[var(--text-primary)] truncate">
            {prototype.title ?? 'Protótipo'}
          </h1>
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)] border border-[var(--accent)] rounded-full px-2 py-[2px]">
            {TOOL_LABEL[prototype.tool] ?? prototype.tool}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isClaudeDesign && prototype.url ? (
            <a
              href={prototype.url}
              target="_blank"
              rel="noreferrer"
              className={actionButton}
              style={{ height: '32px', padding: '0 14px' }}
            >
              <ExternalLink className="size-[13px]" aria-hidden="true" />
              Editar no canvas
            </a>
          ) : (
            <button
              type="button"
              onClick={handleOpenLocal}
              disabled={opening || prototype.fileExists === false}
              className={actionButton}
              style={{ height: '32px', padding: '0 14px' }}
            >
              <ExternalLink className="size-[13px]" aria-hidden="true" />
              {opening ? 'Abrindo…' : 'Abrir no Pencil'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSyncSnapshot}
            disabled={syncing}
            title="Regrava a cópia local que aparece aqui"
            className={actionButton}
            style={{ height: '32px', padding: '0 14px' }}
          >
            <RefreshCw className="size-[13px]" aria-hidden="true" />
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </button>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={cn(
              'inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-lg',
              'bg-[var(--accent)] text-[var(--bg-surface)] hover:opacity-90 transition-opacity',
            )}
            style={{ height: '32px', padding: '0 14px' }}
          >
            <Sparkles className="size-[13px]" aria-hidden="true" />
            Pedir alteração
          </button>
        </div>
      </div>

      {prototype.snapshotExists ? (
        <iframe
          key={prototype.snapshotPath}
          src="/api/prototype/frame"
          title={prototype.title ?? 'Protótipo'}
          className="flex-1 w-full border-0 bg-[var(--bg-primary)]"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      ) : (
        <div style={{ padding: '40px 48px' }} className="max-w-[680px] flex flex-col gap-4">
          <p className="text-sm text-[var(--text-secondary)] leading-[1.6]">
            Ainda não há snapshot local para embutir.{' '}
            {isClaudeDesign
              ? 'O canvas do Claude Design recusa embed por CSP (frame-ancestors self), então a plataforma renderiza uma cópia local do canvas.'
              : 'O Pencil não expõe o protótipo por HTTP, então a visualização embutida depende de um snapshot exportado.'}
          </p>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-[13px] text-[var(--text-secondary)] mb-2">
              Gere o snapshot em{' '}
              <code className="font-mono text-[12px] text-[var(--accent)]">
                {prototype.snapshotPath ?? 'design/<pasta>/canvas.html'}
              </code>{' '}
              e ele aparece aqui:
            </p>
            <ul className="text-[13px] text-[var(--text-muted)] list-disc pl-5 flex flex-col gap-1">
              <li>
                Claude Design: peça ao Claude Code para ler o canvas publicado e salvar o HTML nesse
                caminho — o botão{' '}
                <span className="text-[var(--text-secondary)]">Sincronizar snapshot</span> abaixo
                faz exatamente isso.
              </li>
              <li>Pencil: exporte a tela do app e aponte `prototype.snapshot` para o arquivo.</li>
            </ul>
            <button
              type="button"
              onClick={handleSyncSnapshot}
              disabled={syncing}
              className={cn(actionButton, 'mt-4')}
              style={{ height: '32px', padding: '0 14px' }}
            >
              <RefreshCw className="size-[13px]" aria-hidden="true" />
              {syncing ? 'Iniciando…' : 'Sincronizar snapshot'}
            </button>
          </div>
        </div>
      )}

      <PrototypeRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prototype={prototype}
      />
    </div>
  )
}
