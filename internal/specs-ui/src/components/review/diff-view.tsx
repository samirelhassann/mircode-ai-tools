import { useMemo } from 'react'
import { cn } from '@/lib/cn'

type Props = { diff: string }

type Line = { kind: 'add' | 'del' | 'hunk' | 'meta' | 'ctx'; text: string }

function classify(line: string): Line {
  if (line.startsWith('@@')) return { kind: 'hunk', text: line }
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) {
    return { kind: 'meta', text: line }
  }
  if (line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) {
    return { kind: 'meta', text: line }
  }
  if (line.startsWith('+')) return { kind: 'add', text: line }
  if (line.startsWith('-')) return { kind: 'del', text: line }
  return { kind: 'ctx', text: line }
}

const LINE_STYLE: Record<Line['kind'], string> = {
  add: 'bg-[rgba(34,197,94,0.10)] text-[#bbf7d0]',
  del: 'bg-[rgba(239,68,68,0.10)] text-[#fecaca]',
  hunk: 'bg-[var(--bg-surface)] text-[var(--accent)]',
  meta: 'text-[var(--text-muted)]',
  ctx: 'text-[var(--text-secondary)]',
}

/** Renderiza o diff unificado do git com numeração das linhas do arquivo novo. */
export function DiffView({ diff }: Props) {
  const lines = useMemo(() => {
    const parsed: Array<Line & { newLine?: number }> = []
    let cursor = 0
    for (const raw of diff.split('\n')) {
      const line = classify(raw)
      if (line.kind === 'hunk') {
        const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
        cursor = match ? Number(match[1]) : cursor
        parsed.push(line)
        continue
      }
      if (line.kind === 'meta') {
        parsed.push(line)
        continue
      }
      if (line.kind === 'del') {
        parsed.push(line)
        continue
      }
      parsed.push({ ...line, newLine: cursor })
      cursor += 1
    }
    return parsed
  }, [diff])

  return (
    <pre className="overflow-x-auto text-[12px] leading-[1.55] font-mono m-0">
      {lines.map((line, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas de diff não têm id estável
          key={index}
          className={cn('flex gap-3 whitespace-pre', LINE_STYLE[line.kind])}
        >
          <span
            className="shrink-0 select-none text-right text-[var(--text-muted)] opacity-60"
            style={{ width: '44px', paddingLeft: '10px' }}
          >
            {line.newLine ?? ''}
          </span>
          <span className="grow" style={{ paddingRight: '12px' }}>
            {line.text === '' ? ' ' : line.text}
          </span>
        </div>
      ))}
    </pre>
  )
}
