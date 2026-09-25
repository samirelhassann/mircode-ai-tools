import { Link } from 'react-router-dom'
import { useTree } from '@/hooks/use-tree'
import { TopbarActions } from '../topbar/topbar-actions'

type Props = {
  featureSlug: string | undefined
  taskSlug: string | undefined
}

export function Topbar({ featureSlug, taskSlug }: Props) {
  const { data } = useTree()
  const feature = data?.features.find((f) => f.slug === featureSlug)
  const task = taskSlug ? feature?.tasks.find((t) => t.slug === taskSlug) : undefined
  // Quando há task selecionada, o pill reflete o status da task (que é o que o botão
  // "Alterar Status" modifica). Sem task, cai para o status agregado da feature.
  const displayStatus = task?.status ?? feature?.status

  return (
    <header
      className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0"
      style={{ height: '64px', padding: '0 40px' }}
    >
      <nav aria-label="Breadcrumb" className="flex items-center gap-2">
        {feature ? (
          <Link
            to={`/features/${feature.slug}`}
            className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline transition-colors"
          >
            {feature.title}
          </Link>
        ) : (
          <span className="text-[13px] font-semibold text-[var(--text-muted)]">—</span>
        )}
      </nav>

      <TopbarActions featureSlug={featureSlug} taskSlug={taskSlug} displayStatus={displayStatus} />
    </header>
  )
}
