import { useEffect, useRef } from 'react'
import { useConfig } from '@/hooks/use-config'
import { useJobsStore } from '@/lib/use-jobs-store'
import {
  initNotifier,
  notifyJobStateChange,
  refreshDocumentTitle,
  setNotifierSoundEnabled,
} from '@/lib/notifier'
import type { JobStatus, JobSummary } from '@/lib/types'

export function useJobNotifications() {
  const jobs = useJobsStore((s) => s.jobs)
  const { data: configData } = useConfig()
  const previousRef = useRef<Record<string, JobStatus>>({})
  const armedRef = useRef(false)

  useEffect(() => {
    initNotifier()
  }, [])

  useEffect(() => {
    const enabled = configData?.config.agent.sound ?? true
    setNotifierSoundEnabled(enabled)
  }, [configData])

  useEffect(() => {
    const prev = previousRef.current
    const list = Object.values(jobs)

    // Primeira execução: registra baseline sem notificar (evita spam ao carregar a página com jobs em andamento).
    if (!armedRef.current) {
      const baseline: Record<string, JobStatus> = {}
      for (const j of list) baseline[j.id] = j.status
      previousRef.current = baseline
      armedRef.current = true
      refreshDocumentTitle(list)
      return
    }

    const next: Record<string, JobStatus> = {}
    for (const job of list) {
      const prevStatus = prev[job.id] ?? null
      next[job.id] = job.status
      if (prevStatus !== job.status) {
        notifyJobStateChange({ job, prevStatus, allJobs: list })
      }
    }
    previousRef.current = next
    refreshDocumentTitle(list)

  }, [jobs])
}

export type { JobSummary }
