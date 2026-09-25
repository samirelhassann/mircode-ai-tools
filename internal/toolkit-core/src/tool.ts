import type { Command } from 'commander'

/** Uma entrada do menu interativo do `mircode-ai` para uma tool. */
export type ToolAction = {
  id: string
  label: string
  hint?: string
  run: (ctx: ToolActionContext) => Promise<void>
}

export type ToolActionContext = {
  /** Diretório onde o usuário rodou o CLI. */
  cwd: string
}

/**
 * Contrato que todo pacote instalável (@mir-code/*) exporta. O `mircode-ai`
 * monta o menu interativo com `actions` e os subcomandos com `register`;
 * o bin próprio do pacote (ex.: `specs`) usa o mesmo `register`.
 */
export type ToolDefinition = {
  /** Slug usado na linha de comando: `mircode-ai <id> ...`. */
  id: string
  packageName: string
  title: string
  description: string
  version: string
  /** Registra os subcomandos da tool no `Command` recebido. */
  register: (cmd: Command) => void
  actions: ToolAction[]
}

export function defineTool(tool: ToolDefinition): ToolDefinition {
  return tool
}
