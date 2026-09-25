import { useState } from 'react'
import { Pencil } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/cn'
import { EditarTaskDialog } from './editar-task-dialog'
import { EditChoiceDialog } from './edit-choice-dialog'
import { EditAIDialog } from './edit-ai-dialog'

type Props = {
  featureSlug: string | undefined
  taskSlug: string | undefined
}

type Mode = 'closed' | 'choice' | 'manual' | 'ai'

/**
 * Botão "Editar" na topbar — abre dialog de escolha (manual via CodeMirror ou
 * via IA disparando o agent `refinement`). Desabilitado se não há task
 * selecionada.
 */
export function EditarTaskButton({ featureSlug, taskSlug }: Props) {
  const [mode, setMode] = useState<Mode>('closed')
  const disabled = !featureSlug || !taskSlug
  const path = featureSlug && taskSlug ? `.specs/specs/${featureSlug}/${taskSlug}.md` : ''

  const button = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setMode('choice')}
      className={cn(
        'inline-flex items-center text-[13px] font-semibold rounded-lg transition-colors',
        'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)]',
        'hover:border-[var(--accent)]',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
      style={{ height: '32px', padding: '0 14px', gap: '6px' }}
    >
      <Pencil className="size-4" aria-hidden="true" />
      Editar
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
        <>
          <EditChoiceDialog
            open={mode === 'choice'}
            onOpenChange={(open) => setMode(open ? 'choice' : 'closed')}
            path={path}
            label="task"
            onPickManual={() => setMode('manual')}
            onPickAI={() => setMode('ai')}
          />
          <EditarTaskDialog
            open={mode === 'manual'}
            onOpenChange={(open) => setMode(open ? 'manual' : 'closed')}
            featureSlug={featureSlug}
            taskSlug={taskSlug}
          />
          <EditAIDialog
            open={mode === 'ai'}
            onOpenChange={(open) => setMode(open ? 'ai' : 'closed')}
            path={path}
            label="task"
          />
        </>
      ) : null}
    </>
  )
}
