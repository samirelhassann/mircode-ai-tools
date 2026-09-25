import { useEffect, useState } from 'react'
import { PanZoom, useMermaidSvg } from './mermaid-pan-zoom'
import { cn } from '@/lib/cn'

type Props = {
  /** Blocos ```mermaid do arquivo, na ordem em que aparecem. */
  sources: string[]
}

/**
 * A página de desenho **é** o diagrama: o canvas ocupa toda a área de conteúdo,
 * com arrasto e zoom direto, sem precisar abrir um dialog. Quando o arquivo tem
 * mais de um bloco Mermaid, uma faixa de abas escolhe qual está no canvas.
 */
export function DrawingCanvas({ sources }: Props) {
  const [index, setIndex] = useState(0)
  const active = Math.min(index, Math.max(sources.length - 1, 0))

  useEffect(() => {
    setIndex(0)
  }, [sources])

  if (sources.length === 0) {
    return (
      <div className="flex h-full items-center justify-center" style={{ padding: '40px' }}>
        <p className="max-w-[420px] text-center text-sm text-[var(--text-muted)] leading-relaxed">
          Este arquivo não tem nenhum bloco{' '}
          <code className="text-[var(--accent)]">```mermaid</code>. Use{' '}
          <span className="font-semibold text-[var(--text-secondary)]">Editar</span> para escrever o
          diagrama.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {sources.length > 1 ? (
        <div
          className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] overflow-x-auto"
          style={{ padding: '8px 16px' }}
          role="tablist"
          aria-label="Diagramas deste desenho"
        >
          {sources.map((_, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: a posição no arquivo é a identidade da aba
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setIndex(i)}
              className={cn(
                'shrink-0 rounded-lg text-[12px] font-semibold transition-colors',
                i === active
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]',
              )}
              style={{ height: '26px', padding: '0 12px' }}
            >
              Diagrama {i + 1}
            </button>
          ))}
        </div>
      ) : null}
      {/*
        `PanZoom` devolve toolbar + viewport soltos, e o viewport se limita à
        altura disponível por `flex-1`. Sem `flex flex-col` aqui, `flex-1` não
        vale nada num pai block: o viewport cresce até a altura natural do
        diagrama, o `overflow-hidden` não corta nada e o enquadramento inicial
        sai fora da tela.
      */}
      <div className="flex min-h-0 flex-1 flex-col">
        <DiagramSurface key={active} source={sources[active] as string} />
      </div>
    </div>
  )
}

function DiagramSurface({ source }: { source: string }) {
  const { svg, err } = useMermaidSvg(source)

  if (err) {
    return (
      <div className="flex h-full items-center justify-center" style={{ padding: '40px' }}>
        <div
          className="mermaid-error max-w-[560px] rounded-lg border border-[var(--status-blocked)] bg-[rgba(239,68,68,0.05)] text-sm text-[var(--status-blocked)]"
          style={{ padding: '16px' }}
        >
          Erro no diagrama Mermaid: {err}
        </div>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        Carregando diagrama…
      </div>
    )
  }

  return <PanZoom svg={svg} />
}
