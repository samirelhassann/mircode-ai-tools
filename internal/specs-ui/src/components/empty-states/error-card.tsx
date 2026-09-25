import { AlertCircle, RefreshCw } from 'lucide-react'

type Props = {
  what: string
  onRetry: () => void
}

export function ErrorCard({ what, onRetry }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-card)] flex items-center justify-center">
          <AlertCircle className="size-6 text-[var(--status-blocked)]" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold">Não foi possível carregar {what}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Verifique se o servidor <code className="text-[var(--accent)]">specs start</code> está
          rodando.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
