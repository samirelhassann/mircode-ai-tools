import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronsLeft } from 'lucide-react'
import { useTree } from '@/hooks/use-tree'
import { SidebarFeatureList } from './sidebar-feature-list'
import { SidebarDiscoveryList } from './sidebar-discovery-list'
import { SidebarDrawingList } from './sidebar-drawing-list'
import { SidebarPrototypeItem } from './sidebar-prototype-item'
import { SidebarSkeleton } from '../skeletons/sidebar-skeleton'
import { NewSpecButton } from './new-spec-button'
import { SidebarFilterChip } from './sidebar-filter-chip'
import { SpecsLogo } from './specs-logo'
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@/components/ui/sidebar'

const HIDE_COMPLETED_KEY = 'specs-sidebar-hide-completed'
const PANEL_WIDTH = '300px'
const RAIL_WIDTH = '44px'

/**
 * Navegação lateral da plataforma, na borda **esquerda**. Recolhe com ⌘B ou
 * pelo botão do header e, recolhida, vira um rail de 44px com ícone, contador e
 * rótulo vertical — mesmo comportamento da sidebar de Execuções, na direita.
 * O estado vem do `SidebarProvider` (persistido no cookie `sidebar_state`).
 */
export function SpecsSidebar() {
  const { featureSlug, taskSlug, discoverySlug, drawingSlug } = useParams()
  const { data, isLoading, isError } = useTree()
  const { state, toggleSidebar } = useSidebar()
  const open = state === 'expanded'

  const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(HIDE_COMPLETED_KEY) === '1'
  })

  useEffect(() => {
    window.localStorage.setItem(HIDE_COMPLETED_KEY, hideCompleted ? '1' : '0')
  }, [hideCompleted])

  const allFeatures = data?.features ?? []
  const visibleFeatures = hideCompleted
    ? allFeatures.filter((f) => f.status !== 'completed')
    : allFeatures
  const hiddenCount = allFeatures.length - visibleFeatures.length
  const discoveries = data?.discoveries ?? []
  const drawings = data?.drawings ?? []

  const inProgressCount = allFeatures.filter((f) => f.status === 'in-progress').length
  const countBadge =
    allFeatures.length > 0 ? (
      <span
        className={
          inProgressCount > 0
            ? 'rounded-full bg-[var(--status-in-progress-bg)] px-1.5 py-px text-[10px] font-bold tabular-nums text-[var(--status-in-progress)]'
            : 'rounded-full bg-[var(--bg-card)] px-1.5 py-px text-[10px] font-bold tabular-nums text-[var(--text-muted)]'
        }
      >
        {inProgressCount > 0 ? `${inProgressCount}/${allFeatures.length}` : allFeatures.length}
      </span>
    ) : null

  return (
    <div
      className="shrink-0 overflow-hidden border-r border-[var(--border)] transition-[width] duration-200 ease-linear"
      style={{ width: open ? PANEL_WIDTH : RAIL_WIDTH }}
    >
      {open ? (
        <Sidebar
          collapsible="none"
          aria-label="Specs"
          className="h-full"
          style={{ '--sidebar-width': PANEL_WIDTH } as CSSProperties}
        >
          <SidebarHeader className="gap-0 p-0">
            <div
              className="flex items-center gap-1.5 border-b border-[var(--border)]"
              style={{ height: '64px', padding: '0 8px 0 16px' }}
            >
              <SpecsLogo size={22} className="shrink-0" />
              <h1 className="flex-1 truncate text-[15px] font-bold text-[var(--text-primary)]">
                Specs
              </h1>
              {countBadge}
              <NewSpecButton />
              <button
                type="button"
                onClick={toggleSidebar}
                title="Recolher Specs (⌘B)"
                aria-label="Recolher sidebar de Specs"
                aria-expanded={true}
                className="shrink-0 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                <ChevronsLeft className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="border-b border-[var(--border)]" style={{ padding: '10px 16px' }}>
              <SidebarFilterChip
                active={hideCompleted}
                onToggle={() => setHideCompleted((v) => !v)}
                hiddenCount={hiddenCount}
              />
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <div style={{ padding: '12px 10px' }}>
              {isLoading ? (
                <SidebarSkeleton />
              ) : isError ? (
                <p className="px-2 py-3 text-sm text-[var(--text-muted)]">
                  Não foi possível carregar a árvore.
                </p>
              ) : (
                <SidebarFeatureList
                  features={visibleFeatures}
                  activeFeature={featureSlug}
                  activeTask={taskSlug}
                />
              )}
            </div>

            {!isLoading && !isError ? (
              <>
                <SidebarDiscoveryList discoveries={discoveries} activeDiscovery={discoverySlug} />
                <SidebarDrawingList drawings={drawings} activeDrawing={drawingSlug} />
              </>
            ) : null}

            <SidebarPrototypeItem />
          </SidebarContent>
        </Sidebar>
      ) : (
        <div
          className="flex h-full flex-col items-center gap-2 bg-[var(--bg-surface)]"
          style={{ width: RAIL_WIDTH, padding: '12px 0' }}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            title={`Abrir Specs (${allFeatures.length}) — ⌘B`}
            aria-label={`Abrir sidebar de Specs (${allFeatures.length})`}
            aria-expanded={false}
            className="relative shrink-0 rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <SpecsLogo size={18} />
            {inProgressCount > 0 ? (
              <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[var(--status-in-progress)] ring-2 ring-[var(--bg-surface)] motion-safe:animate-pulse"
                aria-hidden="true"
              />
            ) : null}
          </button>
          {countBadge}
          <span
            className="mt-1 select-none text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
            style={{ writingMode: 'vertical-rl' }}
            aria-hidden="true"
          >
            Specs
          </span>
        </div>
      )}
    </div>
  )
}
