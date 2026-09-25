import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import type { ChangedFile } from '@/lib/types'
import { useTree } from '@/hooks/use-tree'
import { BodySkeleton } from '@/components/skeletons/body-skeleton'
import { ErrorCard } from '@/components/empty-states/error-card'
import { ReviewFile } from '@/components/review/review-file'
import { CommitGroup } from '@/components/review/commit-group'
import type { BulkToggle } from '@/components/review/bulk-toggle'
import { stripFeaturePrefix } from '@/components/content/strip-duplicate-title'
import { cn } from '@/lib/cn'

const STORAGE_KEY = 'specs:reviewed-files'

function readReviewed(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

/** "Revisado" só vale enquanto o arquivo não muda de novo. */
function signature(file: ChangedFile): string {
  return `${file.status}:${file.additions}:${file.deletions}`
}

/** Arquivo dentro de um commit é identificado por hash + path (o commit é imutável). */
function keyFor(file: ChangedFile, commit?: string): string {
  return commit ? `${commit}:${file.path}` : file.path
}

export function ReviewPage() {
  const { featureSlug, taskSlug } = useParams()
  const tree = useTree()
  const changes = useQuery({
    queryKey: ['review-changes'],
    queryFn: () => api.reviewChanges(),
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
  const [reviewed, setReviewed] = useState<Record<string, string>>({})
  // A revisão abre com tudo recolhido: a lista inteira de uma vez é ilegível e
  // cada diff aberto é uma requisição. Expandir é uma escolha explícita.
  const [bulk, setBulk] = useState<BulkToggle | undefined>()
  // Quem represa commits locais para revisar depois abre a tela com dezenas
  // deles; a seção inteira nasce recolhida e só abre por escolha.
  const [commitsOpen, setCommitsOpen] = useState(false)

  useEffect(() => {
    if (bulk) setCommitsOpen(bulk.open)
  }, [bulk])

  useEffect(() => {
    setReviewed(readReviewed())
  }, [])

  const toggleReviewed = useCallback((path: string, next: boolean, sig: string) => {
    setReviewed((prev) => {
      const updated = { ...prev }
      if (next) updated[path] = sig
      else delete updated[path]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const feature = tree.data?.features.find((f) => f.slug === featureSlug)
  const task = feature?.tasks.find((t) => t.slug === taskSlug)

  const groups = useMemo(() => {
    const files = changes.data?.files ?? []
    return [
      {
        title: 'Código',
        files: files.filter((f) => !f.generated && !f.path.startsWith('.specs/')),
      },
      {
        title: 'Specs e documentação',
        files: files.filter((f) => !f.generated && f.path.startsWith('.specs/')),
      },
      { title: 'Gerados e mecânicos', files: files.filter((f) => f.generated) },
    ]
  }, [changes.data])

  const isReviewed = useCallback(
    (file: ChangedFile, commit?: string) => reviewed[keyFor(file, commit)] === signature(file),
    [reviewed],
  )

  const counts = useMemo(() => {
    const worktree = changes.data?.files ?? []
    const commitFiles = (changes.data?.commits ?? []).flatMap((c) =>
      c.files.map((f) => ({ file: f, commit: c.hash })),
    )
    const total = worktree.length + commitFiles.length
    const done =
      worktree.filter((f) => isReviewed(f)).length +
      commitFiles.filter(({ file, commit }) => isReviewed(file, commit)).length
    // `totals` do servidor cobre só o working tree; sem somar os commits, uma
    // revisão de feature inteira mostraria "+0 −0" ao lado de 400 arquivos.
    const additions =
      (changes.data?.totals.additions ?? 0) +
      (changes.data?.commits ?? []).reduce((acc, c) => acc + c.additions, 0)
    const deletions =
      (changes.data?.totals.deletions ?? 0) +
      (changes.data?.commits ?? []).reduce((acc, c) => acc + c.deletions, 0)
    return { total, done, additions, deletions }
  }, [changes.data, isReviewed])

  const backTo = featureSlug && taskSlug ? `/features/${featureSlug}/${taskSlug}` : '/'

  return (
    <div className="flex flex-col h-full">
      <header
        className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0"
        style={{ height: '64px', padding: '0 40px' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {task && feature ? stripFeaturePrefix(task.title, feature.title) : 'Voltar'}
          </Link>
          <span className="text-[13px] text-[var(--text-muted)] truncate">
            Code review · branch{' '}
            <code className="font-mono text-[var(--accent)]">{changes.data?.branch ?? '—'}</code>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {changes.data ? (
            <span className="text-xs text-[var(--text-muted)]">
              {counts.done}/{counts.total} revisados ·{' '}
              <span className="text-[var(--status-completed)]">+{counts.additions}</span>{' '}
              <span className="text-[var(--status-blocked)]">−{counts.deletions}</span>
            </span>
          ) : null}
          <button
            type="button"
            onClick={() =>
              setBulk((prev) => ({ open: !prev?.open, nonce: (prev?.nonce ?? 0) + 1 }))
            }
            aria-pressed={bulk?.open ?? false}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ padding: '6px 10px' }}
          >
            {bulk?.open ? (
              <ChevronsDownUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronsUpDown className="size-3.5" aria-hidden="true" />
            )}
            {bulk?.open ? 'Recolher tudo' : 'Expandir tudo'}
          </button>
          <button
            type="button"
            onClick={() => void changes.refetch()}
            aria-label="Recarregar alterações"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ padding: '6px 10px' }}
          >
            <RefreshCw
              className={cn('size-3.5', changes.isFetching && 'animate-spin')}
              aria-hidden="true"
            />
            Atualizar
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ padding: '24px 40px 48px' }}>
        {changes.isLoading ? <BodySkeleton /> : null}

        {changes.isError ? (
          <ErrorCard what="as alterações do repositório" onRetry={() => void changes.refetch()} />
        ) : null}

        {changes.data && counts.total === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Nada para revisar: sem commits locais pendentes e sem alterações no working tree.
          </p>
        ) : null}

        {changes.data && counts.total > 0 ? (
          <div className="flex flex-col gap-6" style={{ maxWidth: '1100px' }}>
            {changes.data.commits.length > 0 ? (
              <section className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setCommitsOpen((v) => !v)}
                  aria-expanded={commitsOpen}
                  className="flex items-center gap-1.5 self-start bg-transparent border-none cursor-pointer p-0 text-[11px] font-semibold uppercase text-[var(--accent)]"
                  style={{ letterSpacing: '1.2px' }}
                >
                  <ChevronRight
                    className={cn('size-3.5 transition-transform', commitsOpen && 'rotate-90')}
                    aria-hidden="true"
                  />
                  Commits não enviados · {changes.data.commits.length}
                  <span className="text-[var(--text-muted)] normal-case font-normal">
                    {changes.data.upstream ? `(contra ${changes.data.upstream})` : null}
                    {commitsOpen ? null : ' — clique para abrir'}
                  </span>
                </button>
                {commitsOpen &&
                  changes.data.commits.map((commit) => (
                    <CommitGroup
                      key={commit.hash}
                      commit={commit}
                      bulk={bulk}
                      isReviewed={(file, hash) => isReviewed(file, hash)}
                      onToggleReviewed={(file, hash, next) =>
                        toggleReviewed(keyFor(file, hash), next, signature(file))
                      }
                    />
                  ))}
              </section>
            ) : null}

            {changes.data.files.length > 0 ? (
              <h2
                className="text-[11px] font-semibold uppercase text-[var(--text-muted)]"
                style={{ letterSpacing: '1.2px' }}
              >
                Não commitado (working tree)
              </h2>
            ) : null}
            {groups.map((group) =>
              group.files.length === 0 ? null : (
                <section key={group.title} className="flex flex-col gap-2">
                  <h2
                    className="text-[11px] font-semibold uppercase text-[var(--accent)]"
                    style={{ letterSpacing: '1.2px' }}
                  >
                    {group.title} · {group.files.length}
                  </h2>
                  {group.files.map((file) => (
                    <ReviewFile
                      key={file.path}
                      file={file}
                      bulk={bulk}
                      reviewed={isReviewed(file)}
                      onToggleReviewed={(path, next) => toggleReviewed(path, next, signature(file))}
                    />
                  ))}
                </section>
              ),
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
