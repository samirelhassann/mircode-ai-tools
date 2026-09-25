import { useCallback, useEffect, useState } from 'react'
import type { AgentEffort } from '@/lib/types'

const STORAGE_PREFIX = 'specs-last-agent-effort:'

const VALID: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max']

/** `undefined` = usar o esforço padrão da CLI (sem `--effort`). */
export function readStoredEffort(cli: string): AgentEffort | undefined {
  if (typeof window === 'undefined') return undefined
  const stored = window.localStorage.getItem(STORAGE_PREFIX + cli)
  return stored && VALID.includes(stored) ? (stored as AgentEffort) : undefined
}

function writeStoredEffort(cli: string, effort: AgentEffort | undefined) {
  if (typeof window === 'undefined') return
  const key = STORAGE_PREFIX + cli
  if (effort) window.localStorage.setItem(key, effort)
  else window.localStorage.removeItem(key)
}

/**
 * Estado do nível de esforço escolhido para a CLI atual, persistido por CLI —
 * mesmo contrato de `useAgentModel`.
 */
export function useAgentEffort(cli: string) {
  const [effort, setEffortState] = useState<AgentEffort | undefined>(() => readStoredEffort(cli))

  useEffect(() => {
    setEffortState(readStoredEffort(cli))
  }, [cli])

  const setEffort = useCallback(
    (value: AgentEffort | undefined) => {
      setEffortState(value)
      writeStoredEffort(cli, value)
    },
    [cli],
  )

  return { effort, setEffort }
}
