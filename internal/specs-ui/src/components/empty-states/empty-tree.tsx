import { BookOpen } from 'lucide-react'

export function EmptyTree() {
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-card)] flex items-center justify-center">
          <BookOpen className="size-6 text-[var(--text-secondary)]" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold">Nenhuma spec ainda</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Crie arquivos em{' '}
          <code className="text-[var(--accent)]">.specs/specs/&lt;slug&gt;/meta.json</code> e
          liste-os em <code className="text-[var(--accent)]">.specs/specs/meta.json</code>.
        </p>
      </div>
    </div>
  )
}
