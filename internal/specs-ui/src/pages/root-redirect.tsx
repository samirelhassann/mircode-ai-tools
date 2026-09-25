import { Navigate } from 'react-router-dom'
import { useTree } from '@/hooks/use-tree'
import { TreeSkeleton } from '@/components/skeletons/tree-skeleton'
import { EmptyTree } from '@/components/empty-states/empty-tree'
import { ErrorCard } from '@/components/empty-states/error-card'

export function RootRedirect() {
  const { data, isLoading, isError, refetch } = useTree()
  if (isLoading) return <TreeSkeleton />
  if (isError) return <ErrorCard what="a árvore de specs" onRetry={() => void refetch()} />
  if (!data || data.features.length === 0) return <EmptyTree />
  const first = data.features[0]!
  return <Navigate to={`/features/${first.slug}`} replace />
}
