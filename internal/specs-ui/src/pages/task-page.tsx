import { useParams } from 'react-router-dom'
import { useContent } from '@/hooks/use-content'
import { useTree } from '@/hooks/use-tree'
import { Topbar } from '@/components/shell/topbar'
import { Toc } from '@/components/shell/toc'
import { usePrototype } from '@/hooks/use-prototype'
import { BodyContent } from '@/components/content/body-content'
import { PROTOTYPE_SECTION_ID, PrototypePanel } from '@/components/prototype/prototype-panel'
import { BodySkeleton } from '@/components/skeletons/body-skeleton'
import { ErrorCard } from '@/components/empty-states/error-card'
import { NotFoundPage } from './not-found-page'

export function TaskPage() {
  const { featureSlug, taskSlug } = useParams()
  const tree = useTree()
  const content = useContent(featureSlug, taskSlug)
  const prototype = usePrototype(featureSlug)
  const tocSections = prototype.data?.prototype
    ? [{ id: PROTOTYPE_SECTION_ID, label: 'Protótipo' }]
    : []

  const feature = tree.data?.features.find((f) => f.slug === featureSlug)
  const task = feature?.tasks.find((t) => t.slug === taskSlug)

  if (tree.isLoading || content.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar featureSlug={featureSlug} taskSlug={taskSlug} />
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <BodySkeleton />
          </main>
        </div>
      </div>
    )
  }

  if (content.isError) {
    const status = (content.error as Error & { status?: number })?.status
    if (status === 404) return <NotFoundPage />
    return (
      <div className="flex flex-col h-full">
        <Topbar featureSlug={featureSlug} taskSlug={taskSlug} />
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto p-10">
            <ErrorCard what="o conteúdo desta task" onRetry={() => void content.refetch()} />
          </main>
        </div>
      </div>
    )
  }

  if (!feature || !task || !content.data) return <NotFoundPage />

  return (
    <div className="flex flex-col h-full">
      <Topbar featureSlug={featureSlug} taskSlug={taskSlug} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto" data-testid="task-main">
          <BodyContent content={content.data} eyebrow={feature.title} />
          <PrototypePanel feature={featureSlug} task={taskSlug} />
        </main>
        <Toc headings={content.data.headings} sections={tocSections} />
      </div>
    </div>
  )
}
