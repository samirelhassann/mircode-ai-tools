import { spawn } from 'node:child_process'
import { readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  copyIfAbsent,
  copyReplacing,
  ensureGitignore,
  ensureSymlink,
  exists,
  log,
} from '@mir-code/toolkit-core'
import { templateDir } from '../paths.js'

export type InstallOptions = {
  /** Raiz do projeto consumidor. */
  projectRoot: string
  /** Sobrescreve também os arquivos customizáveis (config, project.md, SPECS.md, scaffolds). */
  force?: boolean
  /** Remove o `.specs/app/` de instalações antigas (runtime copiado pelo install-here.sh). */
  cleanLegacy?: boolean
}

export type InstallResult = {
  fresh: boolean
  legacyAppDir: boolean
}

type TerminalKind = 'osascript' | 'gnome-terminal' | 'kitty' | 'wezterm' | 'none'

/**
 * Instala ou atualiza a Specs Platform num projeto. Idempotente:
 *
 * - `.agents/{agents,skills,scripts}`, `.agents/README.md` e `.agents/RUNTIME.md` são
 *   gerenciados pelo pacote e SEMPRE regravados (item a item — skills que o projeto
 *   adicionou por conta própria sobrevivem).
 * - `.agents/project.md`, `.specs/config.json`, os `meta.json`, `_templates/` e `SPECS.md`
 *   são do projeto: só criados se ausentes (ou com `force`).
 * - `.claude/` e `.cursor/` recebem symlinks para `.agents/`.
 */
export async function runInstall(opts: InstallOptions): Promise<InstallResult> {
  const { projectRoot, force = false } = opts
  const src = (...p: string[]) => path.join(templateDir, ...p)
  const dest = (...p: string[]) => path.join(projectRoot, ...p)
  const fresh = !(await exists(dest('.specs', 'specs', 'meta.json')))

  log.title(`specs install — ${projectRoot}`)
  log.kept(
    fresh
      ? 'modo: instalação'
      : force
        ? 'modo: força (sobrescreve customizações)'
        : 'modo: atualização',
  )
  log.blank()

  // --- 1) .agents/ gerenciado pelo pacote ---
  log.step('Agentes e skills (.agents/)')
  for (const kind of ['agents', 'skills', 'scripts']) {
    for (const entry of await readdir(src('.agents', kind))) {
      await copyReplacing(src('.agents', kind, entry), dest('.agents', kind, entry))
      log.added(`.agents/${kind}/${entry}`)
    }
  }
  for (const file of ['README.md', 'RUNTIME.md']) {
    await copyReplacing(src('.agents', file), dest('.agents', file))
    log.added(`.agents/${file}`)
  }
  await installCustomizable(
    src('.agents', 'project.md'),
    dest('.agents', 'project.md'),
    '.agents/project.md',
    force,
  )

  for (const legacy of [
    dest('.agents', 'agents', 'specs-runner.md'),
    dest('.claude', 'agents', 'specs-runner.md'),
  ]) {
    if (await exists(legacy)) {
      await rm(legacy)
      log.removed(`${path.relative(projectRoot, legacy)} (descontinuado)`)
    }
  }

  // --- 2) Symlinks para Claude Code e Cursor ---
  for (const consumer of ['.claude', '.cursor']) {
    for (const kind of ['agents', 'skills']) {
      const result = await ensureSymlink(`../.agents/${kind}`, dest(consumer, kind))
      const label = `${consumer}/${kind} → .agents/${kind}`
      if (result === 'backed-up') log.warn(`${label} (diretório real movido para ${kind}.bak-*)`)
      else if (result === 'created') log.added(label)
      else log.kept(label)
    }
  }

  // --- 3) Scaffold .specs/ (do projeto) ---
  log.blank()
  log.step('Scaffold (.specs/)')
  const configPath = dest('.specs', 'config.json')
  if (await copyIfAbsent(src('.specs', 'config.json'), configPath, force)) {
    const terminal = await detectDefaultTerminal()
    await setOpenTerminal(configPath, terminal)
    log.added(`.specs/config.json (openTerminal: ${terminal})`)
  } else {
    log.kept('.specs/config.json (preservado)')
  }

  for (const dir of ['specs', 'discoveries', 'drawings']) {
    await installCustomizable(
      src('.specs', dir, 'meta.json'),
      dest('.specs', dir, 'meta.json'),
      `.specs/${dir}/meta.json`,
      force,
    )
  }
  for (const tpl of await readdir(src('.specs', 'specs', '_templates'))) {
    await installCustomizable(
      src('.specs', 'specs', '_templates', tpl),
      dest('.specs', 'specs', '_templates', tpl),
      `.specs/specs/_templates/${tpl}`,
      force,
    )
  }
  // A feature exemplo só entra junto com o meta.json que a referencia.
  if (fresh || force) {
    await copyReplacing(src('.specs', 'specs', 'exemplo'), dest('.specs', 'specs', 'exemplo'))
    log.added('.specs/specs/exemplo/ (feature exemplo)')
  }

  await installCustomizable(src('SPECS.md'), dest('SPECS.md'), 'SPECS.md', force)
  if (!force && (await readFile(dest('SPECS.md'), 'utf8')).includes('install-here.sh')) {
    log.warn(
      'SPECS.md é da versão antiga (fala de .specs/app/ e specs:run). Apague-o e rode de novo para regenerar.',
    )
  }

  // --- 4) .gitignore ---
  log.blank()
  log.step('.gitignore')
  const added = await ensureGitignore(
    projectRoot,
    'Specs Platform — estado local da máquina, não do projeto',
    ['.specs/.jobs.json', '.specs/.run/'],
  )
  if (added.length > 0) log.added(`.gitignore (${added.join(', ')})`)
  else log.kept('.gitignore já cobre o estado local')

  // --- 5) Legado: .specs/app/ ---
  const legacyAppDir = await exists(dest('.specs', 'app'))
  if (legacyAppDir) {
    log.blank()
    if (opts.cleanLegacy) {
      await rm(dest('.specs', 'app'), { recursive: true, force: true })
      log.removed('.specs/app/ (runtime antigo — agora a plataforma roda do pacote npm)')
    } else {
      log.warn(
        '.specs/app/ é de uma instalação antiga e não é mais usado. Remova com `specs install --clean-legacy`.',
      )
    }
  }

  log.blank()
  log.success(`Specs Platform ${fresh ? 'instalada' : 'atualizada'} em ${projectRoot}`)
  console.log('  Próximo passo: preencha .agents/project.md e rode `specs start`.')
  return { fresh, legacyAppDir }
}

async function installCustomizable(src: string, dest: string, label: string, force: boolean) {
  if (await copyIfAbsent(src, dest, force)) log.added(label)
  else log.kept(`${label} (preservado)`)
}

async function setOpenTerminal(configPath: string, terminal: TerminalKind) {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as {
    agent?: Record<string, unknown>
  }
  if (config.agent && typeof config.agent === 'object') config.agent.openTerminal = terminal
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

async function detectDefaultTerminal(): Promise<TerminalKind> {
  if (process.platform === 'darwin') return 'osascript'
  if (process.platform !== 'linux') return 'none'
  const which = (bin: string) =>
    new Promise<boolean>((resolve) => {
      const child = spawn('which', [bin], { stdio: 'ignore' })
      child.on('exit', (code) => resolve(code === 0))
      child.on('error', () => resolve(false))
    })
  if (process.env.KITTY_WINDOW_ID || (await which('kitty'))) return 'kitty'
  if (process.env.WEZTERM_PANE || (await which('wezterm'))) return 'wezterm'
  if (await which('gnome-terminal')) return 'gnome-terminal'
  return 'none'
}
