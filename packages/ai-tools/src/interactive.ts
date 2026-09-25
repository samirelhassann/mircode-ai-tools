import * as p from '@clack/prompts'
import pc from 'picocolors'
import { tools } from './registry.js'

export async function runInteractive(version: string): Promise<void> {
  p.intro(`${pc.bgCyan(pc.black(' mircode-ai '))} ${pc.dim(`v${version}`)}`)

  const toolId = await p.select({
    message: 'Qual ferramenta?',
    options: tools.map((t) => ({ value: t.id, label: t.title, hint: t.packageName })),
  })
  if (p.isCancel(toolId)) return cancel()
  const tool = tools.find((t) => t.id === toolId)
  if (!tool) return cancel()

  const actionId = await p.select({
    message: `${tool.title} — o que fazer?`,
    options: tool.actions.map((a) => ({ value: a.id, label: a.label, hint: a.hint })),
  })
  if (p.isCancel(actionId)) return cancel()
  const action = tool.actions.find((a) => a.id === actionId)
  if (!action) return cancel()

  console.log('')
  await action.run({ cwd: process.cwd() })
  p.outro(pc.dim(`Direto pela linha de comando: mircode-ai ${tool.id} ${action.id}`))
}

function cancel() {
  p.cancel('Cancelado.')
}
