import { useState } from 'react'
import { ExternalLink, Frame, Maximize2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { usePrototype } from '@/hooks/use-prototype'
import { cn } from '@/lib/cn'
import { PrototypeRequestDialog } from './prototype-request-dialog'

type Props = {
  feature?: string
  task?: string
}

/** Âncora usada pelo item fixo do índice lateral. */
export const PROTOTYPE_SECTION_ID = 'prototipo'

const TOOL_LABEL: Record<string, string> = {
  'claude-design': 'Claude Design',
  pencil: 'Pencil',
}

/**
 * Painel do protótipo da feature/task. O Claude Design manda
 * `frame-ancestors 'self'`, então o canvas não embute em iframe — o painel
 * mostra o que existe no protótipo e leva para ele em outra aba. No Pencil o
 * arquivo é local: quem abre é o app, via servidor.
 */
export function PrototypePanel({ feature, task }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const { data } = usePrototype(feature)
  const prototype = data?.prototype
  if (!prototype) return null

  const isClaudeDesign = prototype.tool === 'claude-design'
  const missingFile = prototype.tool === 'pencil' && prototype.fileExists === false

  async function handleOpenLocal() {
    setOpening(true)
    try {
      await api.openPrototype(feature)
      toast.success('Abrindo o protótipo no app local.')
    } catch {
      toast.error('Não foi possível abrir o protótipo. Confira `prototype.openCommand`.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <section
      id={PROTOTYPE_SECTION_ID}
      className="border-t border-[var(--border)]"
      style={{ padding: '32px 48px 40px' }}
      data-testid="prototype-panel"
    >
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div
          className="flex items-center justify-between gap-4 border-b border-[var(--border)]"
          style={{ padding: '16px 20px' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Frame className="size-[18px] text-[var(--accent)] shrink-0" aria-hidden="true" />
            <h2 className="text-[15px] font-bold text-[var(--text-primary)] truncate">
              {prototype.title ?? 'Protótipo'}
            </h2>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)] border border-[var(--accent)] rounded-full px-2 py-[2px]">
              {TOOL_LABEL[prototype.tool] ?? prototype.tool}
            </span>
            {prototype.source === 'feature' ? (
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                declarado nesta feature
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {prototype.snapshotExists ? (
              <Link
                to="/prototype"
                className={cn(
                  'inline-flex items-center gap-1.5 text-[13px] font-medium rounded-lg no-underline',
                  'border border-[var(--border)] text-[var(--text-primary)]',
                  'hover:bg-[rgba(255,255,255,0.03)] transition-colors',
                )}
                style={{ height: '32px', padding: '0 14px' }}
              >
                <Maximize2 className="size-[13px]" aria-hidden="true" />
                Ver aqui
              </Link>
            ) : null}
            {isClaudeDesign && prototype.url ? (
              <a
                href={prototype.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'inline-flex items-center gap-1.5 text-[13px] font-medium rounded-lg',
                  'border border-[var(--border)] text-[var(--text-primary)]',
                  'hover:bg-[rgba(255,255,255,0.03)] transition-colors',
                )}
                style={{ height: '32px', padding: '0 14px' }}
              >
                <ExternalLink className="size-[13px]" aria-hidden="true" />
                {prototype.snapshotExists ? 'Editar no canvas' : 'Abrir protótipo'}
              </a>
            ) : (
              <button
                type="button"
                onClick={handleOpenLocal}
                disabled={opening || missingFile}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[13px] font-medium rounded-lg',
                  'border border-[var(--border)] text-[var(--text-primary)]',
                  'hover:bg-[rgba(255,255,255,0.03)] transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                style={{ height: '32px', padding: '0 14px' }}
              >
                <ExternalLink className="size-[13px]" aria-hidden="true" />
                {opening ? 'Abrindo…' : 'Abrir no Pencil'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={cn(
                'inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-lg',
                'bg-[var(--accent)] text-[var(--bg-surface)]',
                'hover:opacity-90 transition-opacity',
              )}
              style={{ height: '32px', padding: '0 14px' }}
            >
              <Sparkles className="size-[13px]" aria-hidden="true" />
              Pedir alteração
            </button>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }} className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-[var(--text-muted)]">Fonte da verdade</dt>
            <dd className="text-[var(--text-secondary)] font-mono text-[12px] break-all">
              {isClaudeDesign ? prototype.url : prototype.file}
            </dd>
            {prototype.designDir ? (
              <>
                <dt className="text-[var(--text-muted)]">Notas</dt>
                <dd className="text-[var(--text-secondary)] font-mono text-[12px] break-all">
                  {prototype.designDir}/README.md
                </dd>
              </>
            ) : null}
            {prototype.nodeIds && prototype.nodeIds.length > 0 ? (
              <>
                <dt className="text-[var(--text-muted)]">Node IDs</dt>
                <dd className="text-[var(--text-secondary)] font-mono text-[12px] break-all">
                  {prototype.nodeIds.join(' · ')}
                </dd>
              </>
            ) : null}
          </dl>

          {prototype.artboards && prototype.artboards.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {prototype.artboards.map((artboard) => (
                <span
                  key={artboard}
                  className="text-[12px] text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-[3px]"
                >
                  {artboard}
                </span>
              ))}
            </div>
          ) : null}

          {missingFile ? (
            <p className="text-[13px] text-[var(--text-muted)]">
              O arquivo <code className="font-mono text-[12px]">{prototype.file}</code> não existe
              no disco — ajuste <code className="font-mono text-[12px]">prototype.file</code> na
              config.
            </p>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">
              {isClaudeDesign
                ? prototype.snapshotExists
                  ? 'O canvas é a fonte da verdade; "Ver aqui" abre a cópia local dele dentro da plataforma. O pedido de alteração abre o Claude Code com /design.'
                  : 'O canvas é a fonte da verdade: os artboards vivem lá, não no repositório. O pedido de alteração abre o Claude Code com /design.'
                : 'O `.pen` é encriptado: leitura e edição só pelo Pencil MCP. O pedido de alteração já vai com essa instrução.'}
            </p>
          )}
        </div>
      </div>

      <PrototypeRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prototype={prototype}
        feature={feature}
        task={task}
      />
    </section>
  )
}
