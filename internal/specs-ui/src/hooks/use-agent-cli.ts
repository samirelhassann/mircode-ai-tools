import { useCallback, useEffect, useState } from 'react'
import type { AgentCli, SpecsConfig } from '@/lib/types'

const STORAGE_KEY = 'specs-last-agent-cli'

/** Rótulos amigáveis para as CLIs conhecidas. Chaves extras caem no próprio id. */
export const CLI_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
}

export const CLI_DESCRIPTIONS: Record<string, string> = {
  claude: 'Dispara o agent via Claude Code (claude --agent).',
  cursor: 'Dispara o agent via Cursor (cursor-agent) usando o mesmo subagent.',
}

export function cliLabel(cli: string): string {
  return CLI_LABELS[cli] ?? cli
}

/** Lista de CLIs disponíveis a partir das chaves de `agent.commands`. */
export function getAvailableClis(config: SpecsConfig | undefined): string[] {
  const keys = Object.keys(config?.agent.commands ?? {})
  return keys.length > 0 ? keys : ['claude']
}

export function readStoredCli(clis: string[], fallback: string): AgentCli {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored && clis.includes(stored)) return stored
  return clis.includes(fallback) ? fallback : (clis[0] ?? fallback)
}

/**
 * Estado da CLI escolhida para disparar agents. Inicializa do `localStorage`
 * (última escolha) caindo no default do `.specs/config.json` e persiste a cada
 * mudança. Mantém o valor válido se a lista de CLIs disponíveis mudar.
 */
export function useAgentCli(config: SpecsConfig | undefined) {
  const clis = getAvailableClis(config)
  const defaultCli = config?.agent.cli ?? 'claude'
  const [cli, setCliState] = useState<AgentCli>(() => readStoredCli(clis, defaultCli))

  const setCli = useCallback((value: AgentCli) => {
    setCliState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value)
    }
  }, [])

  useEffect(() => {
    if (clis.length > 0 && !clis.includes(cli)) {
      setCli(clis.includes(defaultCli) ? defaultCli : (clis[0] ?? defaultCli))
    }
  }, [clis, cli, defaultCli, setCli])

  return { cli, setCli, clis }
}
