import * as Dialog from '@radix-ui/react-dialog'
import { Pencil, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Caminho relativo do arquivo (para exibição no dialog). */
  path: string
  /** Rótulo humano ("task" | "discovery") usado na UI. */
  label: string
  onPickManual: () => void
  onPickAI: () => void
}

/**
 * Dialog de escolha antes de editar: manual (abre CodeMirror) ou via IA
 * (dispara o agent `refinement` passando o caminho do arquivo + instruções
 * do usuário). Usado tanto para tasks quanto para discoveries.
 */
export function EditChoiceDialog({
  open,
  onOpenChange,
  path,
  label,
  onPickManual,
  onPickAI,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl focus:outline-none w-[520px] max-w-[calc(100vw-32px)]">
          <div
            className="flex items-center justify-between border-b border-[var(--border)]"
            style={{ padding: '20px 24px' }}
          >
            <div className="flex items-center gap-2">
              <Pencil className="size-[18px] text-[var(--accent)]" aria-hidden="true" />
              <Dialog.Title className="text-[15px] font-bold text-[var(--text-primary)]">
                Editar {label}
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
          <div style={{ padding: '16px 24px' }}>
            <Dialog.Description className="text-sm text-[var(--text-secondary)] mb-4">
              Como você quer editar{' '}
              <code className="text-[var(--accent)] font-mono text-[12px]">{path}</code>?
            </Dialog.Description>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  onPickManual()
                }}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg text-left transition-colors',
                  'bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
                )}
                style={{ padding: '14px 16px' }}
              >
                <div className="flex items-center gap-1.5">
                  <Pencil className="size-[14px] text-[var(--accent)]" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    Manual
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-snug">
                  Abre o .md num editor markdown (CodeMirror) e você edita direto.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  onPickAI()
                }}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg text-left transition-colors',
                  'bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
                )}
                style={{ padding: '14px 16px' }}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-[14px] text-[var(--accent)]" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    Via IA
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-snug">
                  Abre um terminal com o agent{' '}
                  <code className="text-[var(--accent)]">refinement</code> pra ajustar o arquivo
                  segundo suas instruções.
                </p>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
