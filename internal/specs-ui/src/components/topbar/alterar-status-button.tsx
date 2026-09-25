import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/cn'
import { AlterarStatusModal } from './alterar-status-modal'

type Props = {
  featureSlug: string | undefined
  taskSlug: string | undefined
}

export function AlterarStatusButton({ featureSlug, taskSlug }: Props) {
  const [open, setOpen] = useState(false)
  const disabled = !featureSlug || !taskSlug

  const button = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className={cn(
        'inline-flex items-center text-[13px] font-semibold rounded-lg transition-colors',
        'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)]',
        'hover:border-[var(--accent)]',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
      style={{ height: '32px', padding: '0 14px', gap: '6px' }}
    >
      <RefreshCw className="size-4" aria-hidden="true" />
      Alterar Status
    </button>
  )

  return (
    <>
      {disabled ? (
        <Tooltip.Provider delayDuration={300}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={6}
                className="rounded bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              >
                Requer task selecionada
                <Tooltip.Arrow fill="var(--border)" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ) : (
        button
      )}
      {featureSlug && taskSlug ? (
        <AlterarStatusModal
          open={open}
          onOpenChange={setOpen}
          featureSlug={featureSlug}
          taskSlug={taskSlug}
        />
      ) : null}
    </>
  )
}
