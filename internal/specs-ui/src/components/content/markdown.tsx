import { lazy, Suspense, useEffect, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeRaw from 'rehype-raw'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronRight, Clipboard, CircleCheck, Circle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/cn'

const MermaidBlock = lazy(() =>
  import('./mermaid-block').then((m) => ({ default: m.MermaidBlock })),
)

type Props = { body: string }

function isInternalMdLink(
  href: string,
  currentFeature?: string,
): { feature: string; task: string; hash: string } | null {
  const relSame = /^\.\/(feat-[a-z0-9][a-z0-9-]*)\.md(#.*)?$/.exec(href)
  if (relSame && currentFeature) {
    return { feature: currentFeature, task: relSame[1]!, hash: relSame[2] ?? '' }
  }
  const rel = /^\.\.\/([a-z0-9][a-z0-9-]*)\/(feat-[a-z0-9][a-z0-9-]*)\.md(#.*)?$/.exec(href)
  if (rel) return { feature: rel[1]!, task: rel[2]!, hash: rel[3] ?? '' }
  return null
}

export function Markdown({ body }: Props) {
  const { featureSlug } = useParams()
  const components: Components = {
    h1: ({ id, children }) => (
      <h1 id={id} className="text-[28px] font-bold mt-10 mb-4 text-[var(--text-primary)]">
        {children}
      </h1>
    ),
    h2: ({ id, children }) => (
      <h2
        id={id}
        className="text-xl font-semibold mt-10 mb-4 pt-5 border-t border-[var(--border)] text-[var(--accent)]"
      >
        {children}
      </h2>
    ),
    h3: ({ id, children }) => (
      <h3 id={id} className="text-base font-semibold mt-6 mb-3 text-[var(--text-primary)]">
        {children}
      </h3>
    ),
    h4: ({ id, children }) => (
      <h4 id={id} className="text-sm font-semibold mt-5 mb-2 text-[var(--text-primary)]">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="text-[15px] text-[var(--text-secondary)] leading-[1.7] my-4">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-4 pl-6 list-disc marker:text-[var(--text-muted)] space-y-1.5 text-[15px] text-[var(--text-secondary)]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-4 pl-6 list-decimal marker:text-[var(--text-muted)] space-y-1.5 text-[15px] text-[var(--text-secondary)]">
        {children}
      </ol>
    ),
    li: ({ children, className, ...rest }) => {
      // react-markdown adiciona className 'task-list-item' quando é GFM task list
      const isTask = typeof className === 'string' && className.includes('task-list-item')
      if (isTask && Array.isArray(children)) {
        // primeiro filho é o input checkbox
        const firstChild = children[0] as { props?: { checked?: boolean } } | null | undefined
        const checked = firstChild?.props?.checked === true
        const rest = children.slice(1)
        return (
          <li
            className="flex items-start gap-2 list-none -ml-6"
            aria-checked={checked}
            role="checkbox"
          >
            {checked ? (
              <CircleCheck
                className="size-4 shrink-0 mt-0.5 text-[var(--status-completed)]"
                aria-hidden="true"
              />
            ) : (
              <Circle
                className="size-4 shrink-0 mt-0.5 text-[var(--text-muted)]"
                aria-hidden="true"
              />
            )}
            <span className={checked ? 'text-[var(--text-muted)]' : undefined}>{rest}</span>
          </li>
        )
      }
      return (
        <li className={className} {...rest}>
          {children}
        </li>
      )
    },
    input: () => null, // checkbox original das task lists é tratado pelo li
    a: ({ href, children }) => {
      if (!href) return <a>{children}</a>
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline underline-offset-2 hover:no-underline inline-flex items-center gap-1"
          >
            {children}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )
      }
      const match = isInternalMdLink(href, featureSlug)
      if (match) {
        return (
          <Link
            to={`/features/${match.feature}/${match.task}${match.hash}`}
            className="text-[var(--accent)] underline underline-offset-2 hover:no-underline"
          >
            {children}
          </Link>
        )
      }
      return (
        <a
          href={href}
          className="text-[var(--accent)] underline underline-offset-2 hover:no-underline"
        >
          {children}
        </a>
      )
    },
    code: ({ className, children, ...rest }) => {
      // inline code (sem language)
      const isBlock = typeof className === 'string' && className.startsWith('language-')
      if (!isBlock) {
        return (
          <code
            className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.85em] font-mono text-[var(--text-primary)]"
            {...rest}
          >
            {children}
          </code>
        )
      }
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      )
    },
    pre: ({ children }) => {
      const child = children as unknown as {
        props?: { className?: string; children?: unknown }
      }
      const lang = typeof child?.props?.className === 'string' ? child.props.className : ''
      if (lang.includes('language-mermaid')) {
        const source = flattenToString(child?.props?.children).trim()
        return (
          <Suspense
            fallback={
              <div className="my-6 p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] text-sm">
                Carregando diagrama…
              </div>
            }
          >
            <MermaidBlock source={source} />
          </Suspense>
        )
      }
      const language = lang.startsWith('language-') ? lang.slice('language-'.length) : 'text'
      return (
        <CodeBlock language={language} rawText={flattenToString(child?.props?.children)}>
          {children}
        </CodeBlock>
      )
    },
    blockquote: ({ children }) => (
      <blockquote className="my-4 pl-4 border-l-4 border-[var(--accent)] text-[var(--text-secondary)] italic">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-[var(--bg-surface)]">{children}</thead>,
    th: ({ children }) => (
      <th className="text-left px-4 py-2 font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-[var(--text-secondary)] border-b border-[var(--border)] align-top">
        {children}
      </td>
    ),
    hr: () => <hr className="my-8 border-t border-[var(--border)]" />,
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt ?? ''}
        className="my-6 max-w-full rounded-md border border-[var(--border)]"
      />
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    details: ({ children, ...rest }) => (
      <details
        className={cn(
          'group my-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden',
          '[&>*:not(summary)]:px-4 [&>ul]:pl-10 [&>ol]:pl-10',
        )}
        {...rest}
      >
        {children}
      </details>
    ),
    summary: ({ children }) => (
      <summary
        className={cn(
          'flex items-center gap-2 cursor-pointer select-none list-none marker:content-none',
          '[&::-webkit-details-marker]:hidden',
          'text-sm font-semibold text-[var(--text-primary)]',
          'hover:bg-[var(--bg-surface)] transition-colors',
          'group-open:border-b group-open:border-[var(--border)]',
        )}
        style={{ padding: '12px 16px' }}
      >
        <ChevronRight
          className="size-4 shrink-0 text-[var(--accent)] transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        {children}
      </summary>
    ),
  }

  return (
    <>
      <DeepLinkScroll />
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }],
          rehypeHighlight,
        ]}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </>
  )
}

function DeepLinkScroll() {
  useEffect(() => {
    if (!window.location.hash) return
    const id = decodeURIComponent(window.location.hash.slice(1))
    // timeout curto para garantir que o DOM renderizou headings
    const t = setTimeout(() => {
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    }, 80)
    return () => clearTimeout(t)
  }, [])
  return null
}

function flattenToString(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenToString).join('')
  if (node && typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    const withProps = node as { props?: { children?: unknown } }
    return flattenToString(withProps.props?.children)
  }
  return ''
}

function CodeBlock({
  children,
  language,
  rawText,
}: {
  children: React.ReactNode
  language: string
  rawText: string
}) {
  const [copied, setCopied] = useState(false)
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(rawText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div className="relative my-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div
        className={cn(
          'flex items-center justify-between text-xs',
          'border-b border-[var(--border)] text-[var(--text-muted)]',
        )}
        style={{ padding: '8px 14px' }}
      >
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copiar código"
          className="inline-flex items-center gap-1 text-xs hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? (
            <>
              <Check className="size-3" aria-hidden="true" />
              Copiado!
            </>
          ) : (
            <>
              <Clipboard className="size-3" aria-hidden="true" />
              Copiar
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto text-[13px] leading-relaxed" style={{ padding: '14px' }}>
        {children}
      </pre>
    </div>
  )
}
