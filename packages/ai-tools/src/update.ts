import { execFile, spawn } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { findPackageRoot, log } from '@mir-code/toolkit-core'
import pc from 'picocolors'
import { tools } from './registry.js'

const execFileAsync = promisify(execFile)

const SELF = '@mir-code/ai-tools'

/** Como o `mircode-ai` em execução foi instalado. */
export type InstallMode = 'npm' | 'pnpm' | 'linked'

export type PackageStatus = {
  name: string
  installed: string
  latest: string | null
}

export type UpdateOptions = {
  /** Só mostra o que está desatualizado, sem instalar. */
  check: boolean
}

export async function runUpdate(opts: UpdateOptions): Promise<void> {
  const mode = detectInstallMode(findPackageRoot(import.meta.url))
  if (mode === 'linked') {
    log.warn(
      'Este mircode-ai está linkado ao repositório (pnpm link:global), não instalado do npm.',
    )
    console.log('  Para atualizar: git pull && pnpm build no mircode-ai-tools.')
    return
  }

  log.step(`Verificando versões (${mode} global)...`)
  const installed = await listGlobalPackages(mode)
  const names = [SELF, ...tools.map((t) => t.packageName)].filter((n) => installed.has(n))
  const statuses: PackageStatus[] = await Promise.all(
    names.map(async (name) => ({
      name,
      installed: installed.get(name) ?? '?',
      latest: await fetchLatest(name),
    })),
  )

  printStatuses(statuses)
  const outdated = statuses.filter(isOutdated)
  if (outdated.length === 0) {
    log.success('Tudo atualizado.')
    return
  }

  const command = installCommand(
    mode,
    outdated.map((s) => s.name),
  )
  if (opts.check) {
    console.log(`\nPara atualizar: ${pc.cyan('mircode-ai update')} (ou ${command.join(' ')})`)
    return
  }

  log.blank()
  log.step(command.join(' '))
  await run(command)
  log.blank()
  log.success(`Atualizado: ${outdated.map((s) => `${s.name}@${s.latest}`).join(', ')}`)
  console.log(
    `  Nos projetos, para levar skills/agents novos e reiniciar a UI: ${pc.cyan('specs install && specs stop && specs start')}`,
  )
}

/**
 * Fora de `node_modules` → pacote linkado ao repo (dev). Dentro do diretório
 * global do pnpm → pnpm. Qualquer outro caso → npm.
 */
export function detectInstallMode(packageRoot: string): InstallMode {
  const parts = packageRoot.split(path.sep)
  if (!parts.includes('node_modules')) return 'linked'
  if (parts.includes('.pnpm') || /[\\/]pnpm[\\/]global[\\/]/.test(packageRoot)) return 'pnpm'
  return 'npm'
}

/** Nome → versão dos pacotes globais de topo, a partir do `ls -g --json`. */
export function parseGlobalList(json: string): Map<string, string> {
  const parsed = JSON.parse(json) as unknown
  // npm devolve um objeto; pnpm, um array com um objeto por diretório global.
  const roots = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{
    dependencies?: Record<string, { version?: string }>
  }>
  const result = new Map<string, string>()
  for (const root of roots) {
    for (const [name, info] of Object.entries(root.dependencies ?? {})) {
      if (info.version) result.set(name, info.version)
    }
  }
  return result
}

export function isOutdated(status: PackageStatus): boolean {
  return status.latest !== null && status.latest !== status.installed
}

export function installCommand(mode: 'npm' | 'pnpm', names: string[]): string[] {
  const specs = names.map((n) => `${n}@latest`)
  return mode === 'pnpm' ? ['pnpm', 'add', '-g', ...specs] : ['npm', 'install', '-g', ...specs]
}

async function listGlobalPackages(mode: 'npm' | 'pnpm'): Promise<Map<string, string>> {
  // `npm ls` sai com código ≠ 0 quando há qualquer problema de árvore, mas o JSON vem no stdout.
  const { stdout } = await execFileAsync(mode, ['ls', '-g', '--depth=0', '--json'], {
    maxBuffer: 16 * 1024 * 1024,
  }).catch((err: { stdout?: string }) => ({ stdout: err.stdout ?? '{}' }))
  return parseGlobalList(stdout || '{}')
}

async function fetchLatest(name: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('npm', ['view', name, 'version', '--prefer-online'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

function printStatuses(statuses: PackageStatus[]) {
  for (const s of statuses) {
    const state =
      s.latest === null
        ? pc.yellow('não foi possível consultar o npm')
        : isOutdated(s)
          ? `${pc.yellow(s.installed)} → ${pc.green(s.latest)}`
          : pc.dim(`${s.installed} (atual)`)
    console.log(`  ${s.name.padEnd(28)} ${state}`)
  }
}

function run([cmd, ...args]: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd as string, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} saiu com código ${code}`)),
    )
  })
}
