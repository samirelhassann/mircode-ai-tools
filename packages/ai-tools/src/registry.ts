import { specsPlatformTool } from '@mir-code/specs-platform'
import type { ToolDefinition } from '@mir-code/toolkit-core'

/**
 * Tools disponíveis no `mircode-ai`. Para adicionar um pacote novo:
 * crie `packages/<nome>` exportando um `defineTool(...)`, adicione-o às
 * dependencies deste pacote e registre aqui.
 */
export const tools: ToolDefinition[] = [specsPlatformTool]

export function findTool(id: string): ToolDefinition | undefined {
  return tools.find((t) => t.id === id || t.packageName === id)
}
