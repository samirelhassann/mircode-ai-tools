import type { DiscoveryContentResponse } from '@/lib/types'
import { Markdown } from './markdown'
import { stripDuplicateTitle } from './strip-duplicate-title'
import { DiscoveryTypeBadge } from '../shell/discovery-type-badge'

type Props = { content: DiscoveryContentResponse }

export function DiscoveryBodyContent({ content }: Props) {
  const title = content.frontmatter.title
  const type = content.frontmatter.type
  const date = content.frontmatter.date

  return (
    <article className="markdown-body" style={{ padding: '40px 48px', maxWidth: '880px' }}>
      <div className="flex items-center gap-3 mb-3">
        <DiscoveryTypeBadge type={type} size="md" />
        {date ? <span className="text-xs text-[var(--text-muted)] font-mono">{date}</span> : null}
      </div>
      {title ? (
        <h1 className="text-[28px] font-bold text-[var(--text-primary)] mb-6">{title}</h1>
      ) : null}
      <Markdown body={stripDuplicateTitle(content.body, title)} />
    </article>
  )
}
