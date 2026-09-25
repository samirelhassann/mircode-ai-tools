import { useParams } from 'react-router-dom'
import { useDrawingContent } from '@/hooks/use-drawing-content'
import { useTree } from '@/hooks/use-tree'
import { DrawingTopbar } from '@/components/shell/drawing-topbar'
import { DrawingBodyContent } from '@/components/content/drawing-body-content'
import { ErrorCard } from '@/components/empty-states/error-card'
import { NotFoundPage } from './not-found-page'

/**
 * A página de desenho não tem corpo de markdown nem índice: o desenho é o
 * conteúdo, e ele ocupa a área inteira com zoom e arrasto.
 */
export function DrawingPage() {
  const { drawingSlug } = useParams()
  const tree = useTree()
  const content = useDrawingContent(drawingSlug)

  const drawing = tree.data?.drawings.find((d) => d.slug === drawingSlug)

  if (tree.isLoading || content.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DrawingTopbar drawingSlug={drawingSlug} />
        <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-muted)]">
          Carregando desenho…
        </div>
      </div>
    )
  }

  if (content.isError) {
    const status = (content.error as Error & { status?: number })?.status
    if (status === 404) return <NotFoundPage />
    return (
      <div className="flex flex-col h-full">
        <DrawingTopbar drawingSlug={drawingSlug} />
        <main className="flex-1 overflow-y-auto p-10">
          <ErrorCard what="o conteúdo deste desenho" onRetry={() => void content.refetch()} />
        </main>
      </div>
    )
  }

  if (!drawing || !content.data) return <NotFoundPage />

  return (
    <div className="flex flex-col h-full">
      <DrawingTopbar drawingSlug={drawingSlug} />
      <main className="flex-1 min-h-0 overflow-hidden" data-testid="drawing-main">
        <DrawingBodyContent content={content.data} />
      </main>
    </div>
  )
}
