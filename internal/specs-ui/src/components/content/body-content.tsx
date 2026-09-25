import type { ContentResponse } from '@/lib/types'
import { Markdown } from './markdown'
import { stripDuplicateTitle, stripFeaturePrefix } from './strip-duplicate-title'

type Props = { content: ContentResponse; eyebrow?: string }

export function BodyContent({ content, eyebrow }: Props) {
  const title = content.frontmatter.title
  const description = content.frontmatter.description
  const body = stripDuplicateTitle(content.body, title)
  const heading = title ? stripFeaturePrefix(title, eyebrow) : title

  return (
    <article className="markdown-body" style={{ padding: '40px 48px' }}>
      {eyebrow ? (
        <span
          className="block text-[11px] font-semibold uppercase text-[var(--accent)] mb-2"
          style={{ letterSpacing: '1.2px' }}
        >
          {eyebrow}
        </span>
      ) : null}
      {heading ? (
        <h1 className="text-[28px] font-bold text-[var(--text-primary)] mb-3">{heading}</h1>
      ) : null}
      {description ? (
        <p className="text-[15px] text-[var(--text-secondary)] leading-[1.6] mb-8">{description}</p>
      ) : null}
      <Markdown body={body} />
    </article>
  )
}
