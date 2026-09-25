import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/types'
import { cn } from '@/lib/cn'

/** Seção que não vem do markdown (ex.: o painel de protótipo), fixada no fim do índice. */
export type TocSection = { id: string; label: string }

type Props = { headings: Heading[]; sections?: TocSection[] }

export function Toc({ headings, sections = [] }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  // As seções fixas vêm de um literal recriado a cada render da página; a chave
  // estável evita reobservar o DOM inteiro a cada renderização.
  const sectionIds = sections.map((s) => s.id).join(',')

  useEffect(() => {
    if (headings.length < 2 && sectionIds.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      {
        rootMargin: '-20% 0% -60% 0%',
      },
    )
    // Observe todos os headings presentes no DOM, mais as seções fixas
    for (const id of [...headings.map((h) => h.id), ...sectionIds.split(',').filter(Boolean)]) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
    // biome-ignore lint/correctness/useExhaustiveDependencies: sectionIds é a forma estável de `sections`
  }, [headings, sectionIds])

  // Filtra nível >= 2 para o TOC (H1 é o título, já está no topbar conceitualmente)
  const items = headings.length >= 2 ? headings.filter((h) => h.level >= 2 && h.level <= 4) : []
  if (items.length === 0 && sections.length === 0) return null

  return (
    <aside
      aria-label="Nesta página"
      className="h-full overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-primary)] shrink-0 hidden xl:flex xl:flex-col"
      style={{ width: '180px', padding: '40px 0' }}
    >
      <span
        className="text-[10px] font-semibold uppercase text-[var(--accent)] px-4"
        style={{ letterSpacing: '1.2px' }}
      >
        NESTA PÁGINA
      </span>
      <ul className="mt-3 flex flex-col">
        {items.map((h) => (
          <li key={h.id} data-toc-item={h.id} data-toc-active={activeId === h.id || undefined}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(h.id)
                if (el) {
                  el.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'auto'
                      : 'smooth',
                    block: 'start',
                  })
                }
              }}
              className={cn(
                'block no-underline text-xs leading-snug transition-colors',
                activeId === h.id
                  ? 'text-[var(--accent)] font-medium'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
              style={{
                minHeight: h.level === 2 ? '28px' : '24px',
                paddingTop: '4px',
                paddingBottom: '4px',
                paddingRight: '8px',
                paddingLeft:
                  h.level === 2
                    ? activeId === h.id
                      ? '10px'
                      : '12px'
                    : activeId === h.id
                      ? '20px'
                      : '22px',
                borderLeft:
                  activeId === h.id && h.level === 2
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
        {sections.map((section) => (
          <li
            key={section.id}
            data-toc-item={section.id}
            data-toc-active={activeId === section.id || undefined}
            className={items.length > 0 ? 'mt-2 pt-2 border-t border-[var(--border)]' : undefined}
          >
            <a
              href={`#${section.id}`}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(section.id)
                if (el) {
                  el.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'auto'
                      : 'smooth',
                    block: 'start',
                  })
                }
              }}
              className={cn(
                'block no-underline text-xs leading-snug transition-colors',
                activeId === section.id
                  ? 'text-[var(--accent)] font-medium'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
              style={{
                minHeight: '28px',
                paddingTop: '4px',
                paddingBottom: '4px',
                paddingRight: '8px',
                paddingLeft: activeId === section.id ? '10px' : '12px',
                borderLeft:
                  activeId === section.id ? '2px solid var(--accent)' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
