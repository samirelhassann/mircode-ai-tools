import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Maximize2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PanZoom, useMermaidSvg } from './mermaid-pan-zoom'

type Props = { source: string }

export function MermaidBlock({ source }: Props) {
  const { svg, err } = useMermaidSvg(source)
  const [expanded, setExpanded] = useState(false)

  if (err) {
    return (
      <div className="mermaid-error my-6 p-4 rounded-lg border border-[var(--status-blocked)] bg-[rgba(239,68,68,0.05)] text-sm text-[var(--status-blocked)]">
        Erro no diagrama Mermaid: {err}
      </div>
    )
  }

  return (
    <div className="relative my-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Expandir diagrama"
        title="Expandir diagrama"
        className={cn(
          'absolute top-2 right-2 z-10 rounded-lg p-2',
          'border border-[var(--border)] bg-[var(--bg-surface)]',
          'text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors',
        )}
      >
        <Maximize2 className="size-4" aria-hidden="true" />
      </button>
      {svg ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Expandir diagrama"
          onClick={() => setExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpanded(true)
            }
          }}
          className="overflow-auto max-h-[560px] cursor-zoom-in"
          style={{ padding: '24px' }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG gerado pelo mermaid a partir do markdown local
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="text-sm text-[var(--text-muted)]" style={{ padding: '24px' }}>
          Carregando diagrama…
        </div>
      )}
      {expanded && svg ? <ExpandedDiagram svg={svg} onClose={() => setExpanded(false)} /> : null}
    </div>
  )
}

function ExpandedDiagram({ svg, onClose }: { svg: string; onClose: () => void }) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-primary)] focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Diagrama expandido</Dialog.Title>
          <PanZoom svg={svg} onClose={onClose} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

