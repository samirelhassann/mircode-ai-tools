import { useParams } from 'react-router-dom'
import { useDiscoveryContent } from '@/hooks/use-discovery-content'
import { useTree } from '@/hooks/use-tree'
import { DiscoveryTopbar } from '@/components/shell/discovery-topbar'
import { Toc } from '@/components/shell/toc'
import { DiscoveryBodyContent } from '@/components/content/discovery-body-content'
import { BodySkeleton } from '@/components/skeletons/body-skeleton'
import { ErrorCard } from '@/components/empty-states/error-card'
import { NotFoundPage } from './not-found-page'

export function DiscoveryPage() {
  const { discoverySlug } = useParams()
  const tree = useTree()
  const content = useDiscoveryContent(discoverySlug)

  const discovery = tree.data?.discoveries.find((d) => d.slug === discoverySlug)

  if (tree.isLoading || content.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DiscoveryTopbar discoverySlug={discoverySlug} />
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
        <DiscoveryTopbar discoverySlug={discoverySlug} />
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto p-10">
            <ErrorCard what="o conteúdo desta discovery" onRetry={() => void content.refetch()} />
          </main>
        </div>
      </div>
    )
  }

  if (!discovery || !content.data) return <NotFoundPage />

  return (
    <div className="flex flex-col h-full">
      <DiscoveryTopbar discoverySlug={discoverySlug} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto" data-testid="discovery-main">
          <DiscoveryBodyContent content={content.data} />
        </main>
        <Toc headings={content.data.headings} />
      </div>
    </div>
  )
}
