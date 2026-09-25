import { readFileSync } from 'node:fs'
import path from 'node:path'
import { findPackageRoot, log } from '@mir-code/toolkit-core'
import { Command } from 'commander'
import pc from 'picocolors'
import { runInteractive } from './interactive.js'
import { findTool, tools } from './registry.js'

const { version } = JSON.parse(
  readFileSync(path.join(findPackageRoot(import.meta.url), 'package.json'), 'utf8'),
) as { version: string }

const program = new Command()
  .name('mircode-ai')
  .description('Ferramentas de IA da mircode. Sem argumentos, abre o menu interativo.')
  .version(version, '-v, --version', 'Imprime a versão.')
  .usage('[options] [command]')
  .argument('[command]')
  .action(async (command: string | undefined) => {
    if (command) program.error(`comando desconhecido: ${command}. Veja \`mircode-ai --help\`.`)
    // Sem terminal interativo (CI, pipe) o menu não funciona — mostra o help.
    if (!process.stdin.isTTY) program.help()
    await runInteractive(version)
  })

// `mircode-ai <tool> <comando>` — cada tool registra os próprios subcomandos.
for (const tool of tools) {
  const sub = program.command(tool.id).description(`${tool.title} (${tool.packageName})`)
  tool.register(sub)
}

// Atalho: `mircode-ai install <tool> [dir]` ≡ `mircode-ai <tool> install [dir]`.
program
  .command('install')
  .description('Instala/atualiza uma tool no projeto. Ex.: mircode-ai install specs-platform')
  .argument('<tool>', `Uma de: ${tools.map((t) => t.id).join(', ')}`)
  .allowUnknownOption()
  .helpOption(false)
  .argument('[args...]')
  .action(async (toolId: string, args: string[]) => {
    const tool = findTool(toolId)
    if (!tool) throw new Error(`tool desconhecida: ${toolId}. Rode \`mircode-ai list\`.`)
    await program.parseAsync([tool.id, 'install', ...args], { from: 'user' })
  })

program
  .command('list')
  .description('Lista as tools disponíveis.')
  .action(() => {
    for (const t of tools) {
      console.log(`${pc.bold(t.id.padEnd(18))} ${pc.dim(`${t.packageName}@${t.version}`)}`)
      console.log(`${' '.repeat(19)}${t.description}`)
    }
  })

program.parseAsync(process.argv).catch((err: Error) => {
  log.error(err.message)
  process.exit(1)
})
