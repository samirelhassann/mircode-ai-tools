import { Navigate, useParams } from 'react-router-dom'
import { useContent } from '@/hooks/use-content'
import { useTree } from '@/hooks/use-tree'
import { Topbar } from '@/components/shell/topbar'
import { Toc } from '@/components/shell/toc'
import { usePrototype } from '@/hooks/use-prototype'
import { BodyContent } from '@/components/content/body-content'
import { BodySkeleton } from '@/components/skeletons/body-skeleton'
import { TreeSkeleton } from '@/components/skeletons/tree-skeleton'
import { EmptyFeature } from '@/components/empty-states/empty-feature'
import { ErrorCard } from '@/components/empty-states/error-card'
import { FeatureTaskList } from '@/components/content/feature-task-list'
import { PROTOTYPE_SECTION_ID, PrototypePanel } from '@/components/prototype/prototype-panel'
import type { FeatureNode } from '@/lib/types'
import { NotFoundPage } from './not-found-page'

const OVERVIEW_SLUG = 'overview'

export function FeaturePage() {
  const { featureSlug } = useParams()
  const tree = useTree()
  const overview = useContent(featureSlug, OVERVIEW_SLUG)
  const prototype = usePrototype(featureSlug)
  const tocSections = prototype.data?.prototype
    ? [{ id: PROTOTYPE_SECTION_ID, label: 'Protótipo' }]
    : []

  if (tree.isLoading) return <TreeSkeleton />
  if (tree.isError) {
    return <ErrorCard what="a árvore de specs" onRetry={() => void tree.refetch()} />
  }
  const feature = tree.data?.features.find((f) => f.slug === featureSlug)
  if (!feature) return <NotFoundPage />

  if (overview.isLoading) {
    return (
      <FeatureShell feature={feature}>
        <BodySkeleton />
      </FeatureShell>
    )
  }

  const status = (overview.error as Error & { status?: number })?.status
  if (overview.isError && status !== 404) {
    return (
      <FeatureShell feature={feature}>
        <div style={{ padding: '40px 48px' }}>
          <ErrorCard what="o overview desta feature" onRetry={() => void overview.refetch()} />
        </div>
      </FeatureShell>
    )
  }

  if (!overview.data) {
    if (feature.tasks.length === 0) return <EmptyFeature featureSlug={feature.slug} />
    return <Navigate to={`/features/${feature.slug}/${feature.tasks[0]!.slug}`} replace />
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar featureSlug={featureSlug} taskSlug={undefined} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto" data-testid="feature-main">
          <BodyContent content={overview.data} />
          <PrototypePanel feature={featureSlug} />
          <FeatureTaskList feature={feature} />
        </main>
        <Toc headings={overview.data.headings} sections={tocSections} />
      </div>
    </div>
  )
}

function FeatureShell({
  feature,
  children,
}: {
  feature: FeatureNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-full">
      <Topbar featureSlug={feature.slug} taskSlug={undefined} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
