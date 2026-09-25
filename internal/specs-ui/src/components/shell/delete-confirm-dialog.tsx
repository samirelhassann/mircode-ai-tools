import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  confirmDestructive?: boolean
  onConfirm: () => void | Promise<void>
  submitting?: boolean
}

/**
 * Dialog reutilizável de confirmação de ação destrutiva. Foca no botão Cancelar
 * por default (prevenção contra Enter acidental).
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Remover',
  confirmDestructive = true,
  onConfirm,
  submitting = false,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl focus:outline-none w-[460px] max-w-[calc(100vw-32px)]">
          <div
            className="flex items-center justify-between border-b border-[var(--border)]"
            style={{ padding: '20px 24px' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn(
                  'size-[18px]',
                  confirmDestructive ? 'text-[var(--status-blocked)]' : 'text-[var(--accent)]',
                )}
                aria-hidden="true"
              />
              <Dialog.Title className="text-[15px] font-bold text-[var(--text-primary)]">
                {title}
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
            <Dialog.Description asChild>
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {description}
              </div>
            </Dialog.Description>
          </div>
          <div
            className="flex items-center justify-end gap-2 border-t border-[var(--border)]"
            style={{ padding: '16px 24px' }}
          >
            <Dialog.Close asChild>
              <button
                type="button"
                autoFocus
                disabled={submitting}
                className={cn(
                  'text-[13px] font-medium rounded-lg transition-colors',
                  'bg-transparent text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)]',
                  'border border-[var(--border)]',
                  submitting && 'opacity-60 cursor-not-allowed',
                )}
                style={{ height: '32px', padding: '0 14px' }}
              >
                Cancelar
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void onConfirm()}
              className={cn(
                'inline-flex items-center text-[13px] font-semibold rounded-lg transition-opacity',
                confirmDestructive
                  ? 'bg-[var(--status-blocked)] text-white hover:opacity-90'
                  : 'bg-[var(--accent)] text-[var(--bg-surface)] hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              style={{ height: '32px', padding: '0 14px' }}
            >
              {submitting ? 'Removendo…' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
