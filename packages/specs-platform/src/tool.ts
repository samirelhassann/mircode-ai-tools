import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as p from '@clack/prompts'
import { defineTool, exists } from '@mir-code/toolkit-core'
import type { Command } from 'commander'
import { runInstall } from './commands/install.js'
import { runStart, runStatus, runStop } from './commands/start.js'
import { packageRoot, statuslineScript } from './paths.js'

const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
  name: string
  version: string
  description: string
}

function register(cmd: Command): void {
  cmd
    .command('install')
    .alias('update')
    .description(
      'Instala ou atualiza a Specs Platform no projeto (.agents/, .specs/, symlinks, SPECS.md).',
    )
    .argument('[dir]', 'Raiz do projeto.', '.')
    .option('-f, --force', 'Sobrescreve também config, project.md, SPECS.md e scaffolds.', false)
    .option('--clean-legacy', 'Remove o .specs/app/ de instalações antigas.', false)
    .action(async (dir: string, opts: { force: boolean; cleanLegacy: boolean }) => {
      await runInstall({
        projectRoot: path.resolve(dir),
        force: opts.force,
        cleanLegacy: opts.cleanLegacy,
      })
    })

  cmd
    .command('start')
    .description('Sobe a UI + API (background por default) e abre o browser.')
    .option('-f, --foreground', 'Roda em foreground (Ctrl+C para parar).', false)
    .option('-p, --port <port>', 'Porta (default: `port` do .specs/config.json).')
    .option('--no-open', 'Não abre o browser.')
    .option('--api-only', 'Só a API, sem a UI (para desenvolver a UI com o Vite).', false)
    .action(
      async (opts: { foreground: boolean; port?: string; open: boolean; apiOnly: boolean }) => {
        await runStart({
          projectRoot: process.cwd(),
          foreground: opts.foreground,
          port: opts.port ? Number.parseInt(opts.port, 10) : undefined,
          openBrowser: opts.open,
          apiOnly: opts.apiOnly,
        })
      },
    )

  cmd
    .command('stop')
    .description('Para a instância em background deste projeto.')
    .action(() => runStop(process.cwd()))

  cmd
    .command('status')
    .description('Mostra se a instância em background deste projeto está rodando.')
    .action(() => runStatus(process.cwd()))

  cmd
    .command('statusline')
    .description('Mostra como plugar o medidor de uso do plano no statusLine do Claude Code.')
    .action(() => printStatusline())
}

function printStatusline() {
  console.log(
    'Adicione em ~/.claude/settings.json (troque o argumento pelo seu statusLine atual, ou remova):\n',
  )
  console.log(
    JSON.stringify(
      {
        statusLine: {
          type: 'command',
          command: `bash ${statuslineScript} ~/.claude/statusline-command.sh`,
        },
      },
      null,
      2,
    ),
  )
}

async function interactiveInstall(cwd: string) {
  const dir = await p.text({ message: 'Diretório do projeto', initialValue: cwd })
  if (p.isCancel(dir)) return
  const projectRoot = path.resolve(dir)

  let force = false
  if (await exists(path.join(projectRoot, '.specs', 'config.json'))) {
    const mode = await p.select({
      message: 'A Specs Platform já está instalada aqui. O que fazer?',
      options: [
        {
          value: 'update',
          label: 'Atualizar',
          hint: 'regrava agents/skills, preserva suas customizações',
        },
        {
          value: 'force',
          label: 'Reinstalar do zero',
          hint: 'sobrescreve config, project.md e SPECS.md',
        },
      ],
    })
    if (p.isCancel(mode)) return
    force = mode === 'force'
  }

  let cleanLegacy = false
  if (await exists(path.join(projectRoot, '.specs', 'app'))) {
    const answer = await p.confirm({
      message: 'Encontrei .specs/app/ de uma instalação antiga (não é mais usado). Remover?',
    })
    if (p.isCancel(answer)) return
    cleanLegacy = answer
  }

  await runInstall({ projectRoot, force, cleanLegacy })
}

export const specsPlatformTool = defineTool({
  id: 'specs-platform',
  packageName: pkg.name,
  title: 'Specs Platform',
  description: pkg.description,
  version: pkg.version,
  register,
  actions: [
    {
      id: 'install',
      label: 'Instalar / atualizar no projeto',
      run: ({ cwd }) => interactiveInstall(cwd),
    },
    {
      id: 'start',
      label: 'Subir a UI',
      hint: 'background',
      run: ({ cwd }) => runStart({ projectRoot: cwd, foreground: false, openBrowser: true }),
    },
    { id: 'stop', label: 'Parar a UI', run: ({ cwd }) => runStop(cwd) },
    {
      id: 'statusline',
      label: 'Configurar medidor de uso do Claude',
      run: async () => printStatusline(),
    },
  ],
})
