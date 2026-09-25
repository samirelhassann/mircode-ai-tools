import { useJobsStore } from '@/lib/use-jobs-store'
import { JobTerminalDialog } from './job-terminal-dialog'

export function JobsDialogContainer() {
  const openDialogs = useJobsStore((s) => s.openDialogs)
  // Renderiza apenas o último dialog aberto (topo da pilha) — UX de "uma janela por vez".
  const top = openDialogs[openDialogs.length - 1]
  if (!top) return null
  return <JobTerminalDialog key={top} jobId={top} />
}
