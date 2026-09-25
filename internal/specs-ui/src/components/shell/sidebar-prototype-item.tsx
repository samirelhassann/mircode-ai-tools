import { Frame } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { usePrototype } from '@/hooks/use-prototype'
import { cn } from '@/lib/cn'

const TOOL_LABEL: Record<string, string> = {
  'claude-design': 'Claude Design',
  pencil: 'Pencil',
}

/**
 * Acesso ao protótipo pela navegação lateral. Abre a página interna (iframe do
 * snapshot local), em vez de mandar o usuário para outra aba.
 */
export function SidebarPrototypeItem() {
  const { data } = usePrototype()
  const prototype = data?.prototype
  if (!prototype) return null

  return (
    <div className="border-t border-[var(--border)]" style={{ padding: '12px 10px' }}>
      <span
        className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] px-2 mb-2"
        style={{ letterSpacing: '1.2px' }}
      >
        Protótipo
      </span>
      <NavLink
        to="/prototype"
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 rounded-lg px-2 py-2 no-underline transition-colors',
            isActive
              ? 'bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]',
          )
        }
      >
        <Frame className="size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] truncate">{prototype.title ?? 'Protótipo'}</span>
          <span className="block text-[11px] text-[var(--text-muted)] truncate">
            {TOOL_LABEL[prototype.tool] ?? prototype.tool}
          </span>
        </span>
      </NavLink>
    </div>
  )
}
