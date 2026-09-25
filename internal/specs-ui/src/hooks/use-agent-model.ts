import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { jobsApi } from '@/lib/jobs-api'

const STORAGE_PREFIX = 'specs-last-agent-model:'

/** `undefined` (ou '') = usar o modelo padrão da CLI (sem `--model`). */
export function readStoredModel(cli: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  const stored = window.localStorage.getItem(STORAGE_PREFIX + cli)
  return stored && stored.length > 0 ? stored : undefined
}

function writeStoredModel(cli: string, model: string | undefined) {
  if (typeof window === 'undefined') return
  const key = STORAGE_PREFIX + cli
  if (model && model.length > 0) window.localStorage.setItem(key, model)
  else window.localStorage.removeItem(key)
}

/** Busca a lista de modelos da CLI (dinâmica via `--list-models` ou estática). */
export function useAgentModels(cli: string | undefined) {
  return useQuery({
    queryKey: ['agent-models', cli],
    queryFn: () => jobsApi.models(cli as string),
    enabled: Boolean(cli),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Estado do modelo escolhido para a CLI atual. Persiste por CLI no `localStorage`
 * e reseta a seleção ao trocar de CLI (relendo o último modelo daquela CLI).
 */
export function useAgentModel(cli: string) {
  const [model, setModelState] = useState<string | undefined>(() => readStoredModel(cli))

  useEffect(() => {
    setModelState(readStoredModel(cli))
  }, [cli])

  const setModel = useCallback(
    (value: string | undefined) => {
      setModelState(value)
      writeStoredModel(cli, value)
    },
    [cli],
  )

  return { model, setModel }
}
