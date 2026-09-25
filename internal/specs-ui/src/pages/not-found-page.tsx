import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="h-full flex items-center justify-center p-10">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-card)] flex items-center justify-center">
          <BookOpen className="size-6 text-[var(--text-secondary)]" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Página não encontrada</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          A rota que você tentou acessar não existe.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
