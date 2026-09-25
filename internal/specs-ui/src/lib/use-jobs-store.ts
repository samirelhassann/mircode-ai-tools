import { create } from 'zustand'
import type { JobSummary } from './types'

type JobsState = {
  jobs: Record<string, JobSummary>
  // Fila de dialogs abertos (o último é o que está no topo). Minimizar remove, reabrir adiciona.
  openDialogs: string[]
  setJobs: (jobs: JobSummary[]) => void
  upsertJob: (job: JobSummary) => void
  removeJob: (id: string) => void
  openDialog: (id: string) => void
  closeDialog: (id: string) => void
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: {},
  openDialogs: [],
  setJobs: (list) => {
    set(() => {
      const map: Record<string, JobSummary> = {}
      for (const j of list) map[j.id] = j
      return { jobs: map }
    })
  },
  upsertJob: (job) => {
    set((state) => ({
      jobs: { ...state.jobs, [job.id]: job },
    }))
  },
  removeJob: (id) => {
    set((state) => {
      const next = { ...state.jobs }
      delete next[id]
      return {
        jobs: next,
        openDialogs: state.openDialogs.filter((d) => d !== id),
      }
    })
  },
  openDialog: (id) => {
    set((state) => {
      const filtered = state.openDialogs.filter((d) => d !== id)
      return { openDialogs: [...filtered, id] }
    })
  },
  closeDialog: (id) => {
    set((state) => ({
      openDialogs: state.openDialogs.filter((d) => d !== id),
    }))
  },
}))

export function sortedJobs(jobs: Record<string, JobSummary>): JobSummary[] {
  return Object.values(jobs).sort((a, b) => b.startedAt - a.startedAt)
}
