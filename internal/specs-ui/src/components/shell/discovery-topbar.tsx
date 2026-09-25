import { Link } from 'react-router-dom'
import { useTree } from '@/hooks/use-tree'
import { EditarDiscoveryButton } from '../topbar/editar-discovery-button'

type Props = {
  discoverySlug: string | undefined
}

export function DiscoveryTopbar({ discoverySlug }: Props) {
  const { data } = useTree()
  const discovery = data?.discoveries.find((d) => d.slug === discoverySlug)

  return (
    <header
      className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0"
      style={{ height: '64px', padding: '0 40px' }}
    >
      <nav aria-label="Breadcrumb" className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-[var(--text-muted)]">Discoveries</span>
        <span className="text-[var(--text-muted)]">/</span>
        {discovery ? (
          <Link
            to={`/discoveries/${discovery.slug}`}
            className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline transition-colors"
          >
            {discovery.title}
          </Link>
        ) : (
          <span className="text-[13px] font-semibold text-[var(--text-muted)]">—</span>
        )}
      </nav>

      <div className="flex items-center" style={{ gap: '8px' }}>
        <EditarDiscoveryButton discoverySlug={discoverySlug} />
      </div>
    </header>
  )
}
