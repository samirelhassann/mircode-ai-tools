import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { jobsApi } from '@/lib/jobs-api'
import { useJobsStore } from '@/lib/use-jobs-store'

type Options = {
  enabled?: boolean
  /** Intervalo com alguma execução em andamento. */
  activeMs?: number
  /** Intervalo quando tudo já terminou — nada muda sozinho aqui. */
  idleMs?: number
}

/**
 * Lista de execuções. Diferente das specs, jobs vivem em memória no servidor, e
 * não no disco — então o watcher de arquivos não ajuda e o polling continua. O
 * que dá para economizar é a cadência: só faz sentido pollar rápido enquanto há
 * um job rodando ou esperando input; com tudo terminado, o estado só muda por
 * ação do próprio usuário (que já invalida a query na hora).
 */
export function useJobsPolling({ enabled = true, activeMs = 3000, idleMs = 20_000 }: Options = {}) {
  const setJobs = useJobsStore((s) => s.setJobs)
  const query = useQuery({
    queryKey: ['jobs-list'],
    queryFn: () => jobsApi.list(),
    enabled,
    refetchInterval: (q) => {
      if (!enabled) return false
      const jobs = q.state.data?.jobs ?? []
      const active = jobs.some((j) => j.status === 'running' || j.status === 'needs-input')
      return active ? activeMs : idleMs
    },
    staleTime: 1000,
  })

  useEffect(() => {
    if (query.data?.jobs) {
      setJobs(query.data.jobs)
    }
  }, [query.data, setJobs])

  return query
}
