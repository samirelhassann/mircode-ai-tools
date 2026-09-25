import { BookOpen } from 'lucide-react'

type Props = { featureSlug: string }

export function EmptyFeature({ featureSlug }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-card)] flex items-center justify-center">
          <BookOpen className="size-6 text-[var(--text-secondary)]" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold">Esta spec ainda não tem tasks</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Adicione arquivos{' '}
          <code className="text-[var(--accent)]">feat-{featureSlug}-&lt;task&gt;.md</code> em{' '}
          <code className="text-[var(--accent)]">.specs/specs/{featureSlug}/</code> e liste-os no{' '}
          <code className="text-[var(--accent)]">meta.json</code>.
        </p>
      </div>
    </div>
  )
}
