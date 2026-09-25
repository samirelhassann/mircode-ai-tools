import { spawn } from 'node:child_process'
import { openSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { type SpecsConfig, startServer } from '@mir-code/specs-server'
import { exists, log } from '@mir-code/toolkit-core'
import open from 'open'
import pc from 'picocolors'
import { cliEntry, runDir, uiDir } from '../paths.js'

export type StartOptions = {
  projectRoot: string
  port?: number
  openBrowser: boolean
  foreground: boolean
  /** Só a API — para desenvolver a UI com o Vite (`pnpm --filter @mir-code/specs-ui dev`). */
  apiOnly?: boolean
}

type RunState = { pid: number; url: string; startedAt: string }

const stateFile = (projectRoot: string) => path.join(runDir(projectRoot), 'specs.json')
export const logFile = (projectRoot: string) => path.join(runDir(projectRoot), 'specs.log')

export async function runStart(opts: StartOptions): Promise<void> {
  const config = await readConfig(opts.projectRoot)
  const port = opts.port ?? config.port ?? 4321
  const url = `http://localhost:${port}`

  if (opts.foreground) {
    await startForeground(opts, { ...config, port }, url)
    return
  }

  const running = await readRunningState(opts.projectRoot)
  if (running) {
    log.success(`specs já está rodando (pid ${running.pid})`)
    printUrls(running.url, opts.projectRoot)
    return
  }

  // Sem esta checagem, o waitForPort abaixo "acharia" o servidor de outro processo.
  if (await isPortInUse(port)) {
    throw new Error(
      `a porta ${port} já está em uso (outra instância? veja \`lsof -i :${port}\`). Use \`specs start -p <porta>\`.`,
    )
  }

  await mkdir(runDir(opts.projectRoot), { recursive: true })
  const out = openSync(logFile(opts.projectRoot), 'w')
  const args = [cliEntry, 'start', '--foreground', '--no-open', '--port', String(port)]
  if (opts.apiOnly) args.push('--api-only')
  const child = spawn(process.execPath, args, {
    cwd: opts.projectRoot,
    detached: true,
    stdio: ['ignore', out, out],
  })
  child.unref()
  if (!child.pid) throw new Error('não foi possível iniciar o processo em background.')

  const state: RunState = { pid: child.pid, url, startedAt: new Date().toISOString() }
  await writeFile(stateFile(opts.projectRoot), `${JSON.stringify(state, null, 2)}\n`, 'utf8')

  const ready = await waitForPort(port, 15_000, () => isAlive(state.pid))
  if (!ready) {
    await rm(stateFile(opts.projectRoot), { force: true })
    const tail = (await readFile(logFile(opts.projectRoot), 'utf8'))
      .split('\n')
      .slice(-30)
      .join('\n')
    throw new Error(`o servidor não subiu. Últimas linhas do log:\n${tail}`)
  }

  log.success(`specs iniciado em background (pid ${state.pid})`)
  printUrls(url, opts.projectRoot)
  if (opts.openBrowser && !opts.apiOnly) await open(url).catch(() => {})
}

export async function runStop(projectRoot: string): Promise<void> {
  const state = await readState(projectRoot)
  if (!state) {
    log.kept('specs não está rodando em background neste projeto.')
    return
  }
  if (isAlive(state.pid)) {
    process.kill(state.pid, 'SIGTERM')
    for (let i = 0; i < 50 && isAlive(state.pid); i++) await sleep(100)
    if (isAlive(state.pid)) process.kill(state.pid, 'SIGKILL')
  }
  await rm(stateFile(projectRoot), { force: true })
  log.success(`specs parado (pid ${state.pid})`)
}

export async function runStatus(projectRoot: string): Promise<void> {
  const running = await readRunningState(projectRoot)
  if (!running) {
    log.kept('specs não está rodando em background neste projeto.')
    return
  }
  log.success(`specs rodando (pid ${running.pid}, desde ${running.startedAt})`)
  printUrls(running.url, projectRoot)
}

async function startForeground(opts: StartOptions, config: SpecsConfig, url: string) {
  const server = await startServer(config, {
    projectRoot: opts.projectRoot,
    uiDir: opts.apiOnly ? undefined : uiDir,
  })
  log.title(`specs — ${opts.projectRoot}`)
  console.log(
    `${pc.green('✓')} ${opts.apiOnly ? 'API' : 'UI + API'}: ${pc.bold(pc.cyan(server.url))}`,
  )
  console.log(pc.dim('Pressione Ctrl+C para encerrar.'))
  if (opts.openBrowser && !opts.apiOnly) await open(url).catch(() => {})

  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    await server.close().catch(() => {})
    process.exit(0)
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => void shutdown())
  }
}

async function readConfig(projectRoot: string): Promise<SpecsConfig> {
  const configPath = path.join(projectRoot, '.specs', 'config.json')
  if (!(await exists(configPath))) {
    throw new Error(
      '.specs/config.json não encontrado. Rode `specs install` na raiz do projeto antes.',
    )
  }
  return JSON.parse(await readFile(configPath, 'utf8')) as SpecsConfig
}

async function readState(projectRoot: string): Promise<RunState | null> {
  try {
    return JSON.parse(await readFile(stateFile(projectRoot), 'utf8')) as RunState
  } catch {
    return null
  }
}

/** Estado do background só se o processo ainda existe; limpa o arquivo órfão. */
async function readRunningState(projectRoot: string): Promise<RunState | null> {
  const state = await readState(projectRoot)
  if (!state) return null
  if (isAlive(state.pid)) return state
  await rm(stateFile(projectRoot), { force: true })
  return null
}

function printUrls(url: string, projectRoot: string) {
  console.log(`  UI:   ${pc.cyan(url)}`)
  console.log(
    `  logs: ${path.relative(process.cwd(), logFile(projectRoot)) || logFile(projectRoot)}`,
  )
  console.log('  stop: specs stop')
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function tryConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const finish = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(1_000, () => finish(false))
  })
}

/** Espera a porta aceitar conexão (IPv4 ou IPv6); desiste cedo se o processo morrer. */
async function waitForPort(
  port: number,
  timeoutMs: number,
  alive: () => boolean,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs && alive()) {
    if (await isPortInUse(port)) return true
    await sleep(250)
  }
  return false
}

async function isPortInUse(port: number): Promise<boolean> {
  const [v4, v6] = await Promise.all([tryConnect('127.0.0.1', port), tryConnect('::1', port)])
  return v4 || v6
}
