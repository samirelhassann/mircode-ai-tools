import path from 'node:path'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { assertInsideProject, fileExists } from './fs-utils.js'
import { DEFAULT_PROTOTYPE_OPEN_COMMAND, normalizePrototype } from './config-defaults.js'
import type { PrototypeResolved, SpecsConfig } from './types.js'

/**
 * Resolve o protótipo válido para um contexto: o bloco `prototype` do
 * `.specs/config.json` vale como default do projeto, e o `meta.json` da feature
 * pode sobrescrevê-lo por completo (uma feature pode ter protótipo em outra
 * ferramenta que o resto do projeto).
 */
export async function resolvePrototype(
  projectRoot: string,
  config: SpecsConfig,
  feature?: string,
): Promise<PrototypeResolved | null> {
  let resolved: PrototypeResolved | null = config.prototype
    ? { ...config.prototype, source: 'config' }
    : null

  if (feature) {
    const metaPath = path.resolve(projectRoot, config.featuresDir, feature, 'meta.json')
    try {
      assertInsideProject(metaPath, projectRoot)
      if (await fileExists(metaPath)) {
        const meta = JSON.parse(await readFile(metaPath, 'utf8')) as { prototype?: unknown }
        const override = normalizePrototype(meta.prototype)
        if (override) resolved = { ...override, source: 'feature', feature }
      }
    } catch {
      // meta.json ausente ou inválido — fica com o default do projeto
    }
  }

  if (!resolved) return null

  resolved = await withSnapshot(projectRoot, resolved)

  if (resolved.tool === 'pencil' && resolved.file) {
    const filePath = path.resolve(projectRoot, resolved.file)
    try {
      assertInsideProject(filePath, projectRoot)
      return { ...resolved, filePath, fileExists: await fileExists(filePath) }
    } catch {
      return { ...resolved, fileExists: false }
    }
  }

  return resolved
}

/**
 * Resolve o snapshot local do protótipo — o HTML que a plataforma serve para
 * embutir o canvas em iframe. Usa `snapshot` quando declarado; senão tenta o
 * default `<designDir>/canvas.html`.
 */
async function withSnapshot(
  projectRoot: string,
  prototype: PrototypeResolved,
): Promise<PrototypeResolved> {
  const candidate =
    prototype.snapshot ??
    (prototype.designDir ? `${prototype.designDir.replace(/\/$/, '')}/canvas.html` : undefined)
  if (!candidate) return prototype
  try {
    const abs = path.resolve(projectRoot, candidate)
    assertInsideProject(abs, projectRoot)
    return { ...prototype, snapshotPath: candidate, snapshotExists: await fileExists(abs) }
  } catch {
    return { ...prototype, snapshotPath: candidate, snapshotExists: false }
  }
}

/** Caminho absoluto do snapshot, validado — `null` quando não há um utilizável. */
export function snapshotAbsolutePath(
  projectRoot: string,
  prototype: PrototypeResolved,
): string | null {
  if (!prototype.snapshotPath || !prototype.snapshotExists) return null
  try {
    const abs = path.resolve(projectRoot, prototype.snapshotPath)
    assertInsideProject(abs, projectRoot)
    return abs
  } catch {
    return null
  }
}

/**
 * Prompt do job que (re)gera o snapshot local — o HTML que a plataforma embute
 * no iframe, já que o canvas remoto recusa embed.
 */
export function buildSnapshotPrompt(prototype: PrototypeResolved): string {
  const target = prototype.snapshotPath ?? 'design/prototipo/canvas.html'
  if (prototype.tool === 'claude-design') {
    return `Atualize o snapshot local do protótipo: leia o canvas ${prototype.url} com a tool Artifact (action "read") e grave o HTML completo devolvido em ${target} (crie o diretório se não existir, e sobrescreva o arquivo se já houver um). Não altere o canvas nem outros arquivos do repositório; ao terminar, diga o tamanho do arquivo gravado.`
  }
  return `Atualize o snapshot local do protótipo Pencil ${prototype.file}: exporte a visão atual do arquivo e grave-a em ${target}. Se o Pencil MCP não permitir exportar, diga isso em vez de improvisar, e informe qual export manual o usuário precisa fazer.`
}

export type DesignPromptContext = {
  feature?: string
  task?: string
  featureTitle?: string
  specPath?: string
}

/**
 * Monta o prompt do job de design. No Claude Design a alteração é pedida pelo
 * slash command `/design` do próprio Claude Code; no Pencil, por instrução de
 * usar o Pencil MCP sobre o `.pen` (que é encriptado e só se lê por lá).
 */
export function buildDesignPrompt(
  prototype: PrototypeResolved,
  request: string,
  ctx: DesignPromptContext = {},
  intent: 'change' | 'snapshot' = 'change',
): string {
  if (intent === 'snapshot') return buildSnapshotPrompt(prototype)

  const context: string[] = []
  if (ctx.featureTitle || ctx.feature) {
    context.push(`Feature: ${ctx.featureTitle ?? ctx.feature}`)
  }
  if (ctx.task) context.push(`Task: ${ctx.task}`)
  if (ctx.specPath) context.push(`Spec: ${ctx.specPath}`)
  const suffix = context.length > 0 ? `\n\nContexto — ${context.join(' · ')}.` : ''

  if (prototype.tool === 'claude-design') {
    const target = [
      prototype.title ? `"${prototype.title}"` : null,
      prototype.url ? `(${prototype.url})` : null,
    ]
      .filter(Boolean)
      .join(' ')
    const dir = prototype.designDir
      ? ` As notas do protótipo estão em ${prototype.designDir}/README.md — atualize-as se a mudança alterar as decisões descritas lá.`
      : ''
    return `/design Atualize o protótipo ${target} do canvas existente: ${request}. Mantenha os artboards já publicados e o sistema de tokens atual; re-seed apenas o que a mudança exigir.${dir}${suffix}`
  }

  const file = prototype.file ?? '(arquivo .pen não declarado)'
  return `Altere o protótipo Pencil ${file}: ${request}. Use as tools do Pencil MCP (o .pen é encriptado — nunca leia com Read/Grep): confirme o estado do editor, localize os nós alvo, aplique a mudança e devolva os node IDs afetados com o antes/depois de cada um.${suffix}`
}

export type OpenPrototypeResult =
  | { ok: true; command: string }
  | { ok: false; status: 400 | 404 | 500; error: string; detail?: string }

/**
 * Abre o protótipo no app local. Só faz sentido para ferramentas de arquivo
 * (Pencil) — no Claude Design a UI abre a URL direto no browser, sem passar
 * pelo servidor.
 */
export function openPrototype(
  projectRoot: string,
  prototype: PrototypeResolved,
): OpenPrototypeResult {
  if (prototype.tool !== 'pencil' || !prototype.filePath) {
    return { ok: false, status: 400, error: 'not_openable' }
  }
  if (prototype.fileExists === false) {
    return { ok: false, status: 404, error: 'prototype_file_not_found', detail: prototype.file }
  }
  const template = prototype.openCommand ?? DEFAULT_PROTOTYPE_OPEN_COMMAND[prototype.tool] ?? ''
  const command = template
    .replaceAll('{file}', prototype.filePath)
    .replaceAll('{url}', prototype.url ?? '')
  const tokens = command.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  const cleaned = tokens.map((t) =>
    (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
      ? t.slice(1, -1)
      : t,
  )
  const [file, ...args] = cleaned
  if (!file) return { ok: false, status: 400, error: 'invalid_open_command' }
  try {
    const child = spawn(file, args, { cwd: projectRoot, detached: true, stdio: 'ignore' })
    child.on('error', (err) => {
      console.error(`[prototype] open error: ${err.message}`)
    })
    child.unref()
    return { ok: true, command }
  } catch (err) {
    return { ok: false, status: 500, error: 'spawn_failed', detail: (err as Error).message }
  }
}
