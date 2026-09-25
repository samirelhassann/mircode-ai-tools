import * as p from '@clack/prompts'
import pc from 'picocolors'
import { tools } from './registry.js'
import { runUpdate } from './update.js'

const UPDATE = '__update'

export async function runInteractive(version: string): Promise<void> {
  p.intro(`${pc.bgCyan(pc.black(' mircode-ai '))} ${pc.dim(`v${version}`)}`)

  const toolId = await p.select({
    message: 'Qual ferramenta?',
    options: [
      ...tools.map((t) => ({ value: t.id, label: t.title, hint: t.packageName })),
      { value: UPDATE, label: 'Atualizar os CLIs', hint: 'mircode-ai update' },
    ],
  })
  if (p.isCancel(toolId)) return cancel()
  if (toolId === UPDATE) {
    console.log('')
    await runUpdate({ check: false })
    p.outro(pc.dim('Direto pela linha de comando: mircode-ai update'))
    return
  }
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
