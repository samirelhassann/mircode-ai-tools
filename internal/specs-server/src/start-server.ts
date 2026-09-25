import path from 'node:path'
import { readFile, rm, unlink } from 'node:fs/promises'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { z } from 'zod'
import type { SpecsConfig, StartServerOptions, StartedServer, TaskNode } from './types.js'
import { applyDefaults } from './config-defaults.js'
import {
  cliCachePath,
  desktopHistoryPath,
  readClaudeUsage,
  statuslineSnapshotPath,
} from './claude-usage.js'
import { createSpecsWatcher } from './specs-watcher.js'
import {
  SLUG_REGEX,
  assertInsideProject,
  atomicWrite,
  dirExists,
  fileExists,
  isValidSlug,
  readText,
} from './fs-utils.js'
import { aggregateStatus, buildTree } from './tree-builder.js'
import {
  extractDiscoveryFrontmatterFields,
  extractDrawingFrontmatterFields,
  extractFrontmatterFields,
  parseFrontmatter,
  patchStatusInFrontmatter,
} from './frontmatter.js'
import { extractHeadings } from './headings.js'
import { runAgent, runDiscoveryAgent, runDrawingAgent, runRefinement } from './run-agent.js'
import { collectChanges, fileDiff, openInEditor } from './review.js'
import { openPrototype, resolvePrototype, snapshotAbsolutePath } from './prototype.js'
import { createJobManager } from './job-manager.js'
import { registerJobRoutes } from './job-routes.js'

const statusSchema = z.enum(['pending', 'in-progress', 'completed', 'blocked'])
const slugSchema = z.string().regex(SLUG_REGEX)

const contentQuerySchema = z.object({
  feature: slugSchema,
  task: slugSchema,
})

const reviewDiffQuerySchema = z.object({
  path: z.string().min(1).max(1024),
  commit: z
    .string()
    .regex(/^[0-9a-f]{7,40}$/i)
    .optional(),
})

const openEditorBodySchema = z.object({
  path: z.string().min(1).max(1024),
  line: z.number().int().positive().optional(),
})

const statusBodySchema = z.object({
  feature: slugSchema,
  task: slugSchema,
  status: statusSchema,
})

const reorderFeaturesBodySchema = z.object({
  pages: z.array(slugSchema),
})

const reorderTasksBodySchema = z.object({
  feature: slugSchema,
  pages: z.array(slugSchema),
})

const runAgentBodySchema = z.object({
  scope: z.enum(['feature', 'featureNoPause', 'task']),
  feature: slugSchema,
  task: slugSchema.optional(),
})

const deleteTaskQuerySchema = z.object({
  feature: slugSchema,
  task: slugSchema,
})

const deleteFeatureQuerySchema = z.object({
  feature: slugSchema,
})

const updateContentBodySchema = z.object({
  feature: slugSchema,
  task: slugSchema,
  body: z.string().max(1_000_000), // 1MB — bem mais que o necessário para um .md de task
})

const runRefinementBodySchema = z.object({
  prompt: z.string().min(1).max(10_000),
})

const discoveryContentQuerySchema = z.object({
  slug: slugSchema,
})

const updateDiscoveryContentBodySchema = z.object({
  slug: slugSchema,
  body: z.string().max(1_000_000),
})

const deleteDiscoveryQuerySchema = z.object({
  slug: slugSchema,
})

const reorderDiscoveriesBodySchema = z.object({
  pages: z.array(slugSchema),
})

const prototypeQuerySchema = z.object({
  feature: slugSchema.optional(),
})

const runDiscoveryAgentBodySchema = z.object({
  prompt: z.string().min(1).max(10_000),
})

const drawingContentQuerySchema = z.object({
  slug: slugSchema,
})

const updateDrawingContentBodySchema = z.object({
  slug: slugSchema,
  body: z.string().max(1_000_000),
})

const deleteDrawingQuerySchema = z.object({
  slug: slugSchema,
})

const reorderDrawingsBodySchema = z.object({
  pages: z.array(slugSchema),
})

const runDrawingAgentBodySchema = z.object({
  prompt: z.string().min(1).max(10_000),
})

function logLine(method: string, url: string, startMs: number, status: number) {
  const dur = Date.now() - startMs
  const stamp = new Date().toISOString()
  console.log(`[${stamp}] ${method} ${url} ${dur}ms -> ${status}`)
}

async function readConfigFile(projectRoot: string): Promise<SpecsConfig> {
  const configPath = path.join(projectRoot, '.specs', 'config.json')
  if (!(await fileExists(configPath))) {
    return applyDefaults({})
  }
  try {
    const raw = await readFile(configPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<SpecsConfig>
    return applyDefaults(parsed)
  } catch (err) {
    throw new Error(`invalid_config: ${(err as Error).message}`)
  }
}

function setTaskPath(projectRoot: string, featuresDir: string, feature: string, task: string) {
  const taskPath = path.resolve(projectRoot, featuresDir, feature, `${task}.md`)
  assertInsideProject(taskPath, projectRoot)
  return taskPath
}

function setMetaPath(projectRoot: string, featuresDir: string, feature?: string) {
  const p = feature
    ? path.resolve(projectRoot, featuresDir, feature, 'meta.json')
    : path.resolve(projectRoot, featuresDir, 'meta.json')
  assertInsideProject(p, projectRoot)
  return p
}

function setDiscoveryPath(projectRoot: string, discoveriesDir: string, slug: string) {
  const p = path.resolve(projectRoot, discoveriesDir, `${slug}.md`)
  assertInsideProject(p, projectRoot)
  return p
}

function setDiscoveryMetaPath(projectRoot: string, discoveriesDir: string) {
  const p = path.resolve(projectRoot, discoveriesDir, 'meta.json')
  assertInsideProject(p, projectRoot)
  return p
}

function setDrawingPath(projectRoot: string, drawingsDir: string, slug: string) {
  const p = path.resolve(projectRoot, drawingsDir, `${slug}.md`)
  assertInsideProject(p, projectRoot)
  return p
}

function setDrawingMetaPath(projectRoot: string, drawingsDir: string) {
  const p = path.resolve(projectRoot, drawingsDir, 'meta.json')
  assertInsideProject(p, projectRoot)
  return p
}

export async function startServer(
  userConfig: SpecsConfig,
  opts: StartServerOptions,
): Promise<StartedServer> {
  const { projectRoot } = opts
  const config = applyDefaults(userConfig)
  const featuresDir = config.featuresDir
  const discoveriesDir = config.discoveriesDir
  const drawingsDir = config.drawingsDir

  const rootMetaPath = path.join(projectRoot, featuresDir, 'meta.json')
  if (!(await fileExists(rootMetaPath))) {
    throw new Error(
      `${featuresDir}/meta.json não encontrado em ${projectRoot}. Rode 'specs install' antes de 'specs start'.`,
    )
  }

  const fastify: FastifyInstance = Fastify({ logger: false })

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      try {
        const url = new URL(origin)
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          return cb(null, true)
        }
      } catch {}
      return cb(new Error('cors_blocked'), false)
    },
  })

  // Static files (built UI) — o `@mir-code/specs-platform` empacota o dist da UI e
  // passa o caminho em `uiDir`. Em dev (sem `uiDir`) o Vite serve o renderer em
  // outra porta e faz proxy de `/api` para cá.
  if (opts.uiDir && (await dirExists(opts.uiDir))) {
    await fastify.register(fastifyStatic, {
      root: opts.uiDir,
      prefix: '/',
    })
    // SPA fallback: rotas do react-router (ex.: /feature/x) devolvem o index.html.
    fastify.setNotFoundHandler((req, reply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'not_found' })
      }
      return reply.sendFile('index.html')
    })
  }

  // Timing + logging hook
  fastify.addHook('onRequest', async (req) => {
    ;(req as unknown as { _startMs: number })._startMs = Date.now()
  })
  fastify.addHook('onResponse', async (req, reply) => {
    const startMs = (req as unknown as { _startMs: number })._startMs ?? Date.now()
    logLine(req.method, req.url, startMs, reply.statusCode)
  })

  // Job manager — estado in-memory de execuções inline (PTY).
  const jobManager = createJobManager({ projectRoot })
  registerJobRoutes(
    fastify,
    jobManager,
    () => readConfigFile(projectRoot).catch(() => config),
    projectRoot,
  )

  // Watcher de `.specs/` — empurra invalidações para a UI em vez de deixá-la
  // pollando. Também observa os arquivos de uso do Claude, que mudam sozinhos.
  const watcher = createSpecsWatcher({
    projectRoot,
    featuresDir,
    discoveriesDir,
    drawingsDir,
    extraFiles: [
      { file: desktopHistoryPath(), event: { type: 'usage' } },
      { file: cliCachePath(), event: { type: 'usage' } },
      { file: statuslineSnapshotPath(), event: { type: 'usage' } },
    ],
  })

  // GET /api/tree
  fastify.get('/api/tree', async (_req, reply) => {
    try {
      const tree = await buildTree(projectRoot, featuresDir, discoveriesDir, drawingsDir)
      return tree
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'no_features_dir') {
        return reply.code(500).send({ error: 'no_features_dir' })
      }
      return reply.code(500).send({ error: 'internal', detail: msg })
    }
  })

  // GET /api/content
  fastify.get('/api/content', async (req, reply) => {
    const parsed = contentQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    const { feature, task } = parsed.data
    let taskPath: string
    try {
      taskPath = setTaskPath(projectRoot, featuresDir, feature, task)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (!(await fileExists(taskPath))) {
      return reply.code(404).send({ error: 'task_not_found' })
    }
    const raw = await readText(taskPath)
    const { data, body } = parseFrontmatter(raw)
    const frontmatter = {
      ...data,
      ...extractFrontmatterFields(data),
    }
    const headings = extractHeadings(body)
    return { frontmatter, body, headings, raw }
  })

  // GET /api/review/changes — working tree vs HEAD, com o diff de cada arquivo
  fastify.get('/api/review/changes', async (_req, reply) => {
    try {
      return await collectChanges(projectRoot)
    } catch (err) {
      return reply.code(500).send({ error: 'git_failed', detail: (err as Error).message })
    }
  })

  // GET /api/review/diff — diff de um arquivo, sob demanda
  fastify.get('/api/review/diff', async (req, reply) => {
    const parsed = reviewDiffQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    try {
      return await fileDiff(projectRoot, parsed.data.path, parsed.data.commit)
    } catch (err) {
      const message = (err as Error).message
      const status = message === 'invalid_path' ? 400 : 500
      return reply.code(status).send({ error: message })
    }
  })

  // POST /api/review/open — abre o arquivo no editor configurado
  fastify.post('/api/review/open', async (req, reply) => {
    const parsed = openEditorBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' })
    }
    const current = await readConfigFile(projectRoot).catch(() => config)
    const result = await openInEditor(
      projectRoot,
      current.review.openCommand,
      parsed.data.path,
      parsed.data.line,
    )
    if (!result.ok) {
      const status = result.error === 'invalid_path' ? 400 : 500
      return reply.code(status).send(result)
    }
    return result
  })

  // POST /api/status
  fastify.post('/api/status', async (req, reply) => {
    const parsed = statusBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', detail: parsed.error.message })
    }
    const { feature, task, status } = parsed.data
    let taskPath: string
    try {
      taskPath = setTaskPath(projectRoot, featuresDir, feature, task)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (!(await fileExists(taskPath))) {
      return reply.code(404).send({ error: 'task_not_found' })
    }
    const raw = await readText(taskPath)
    const next = patchStatusInFrontmatter(raw, status)
    if (next !== raw) {
      await atomicWrite(taskPath, next)
    }
    return { ok: true, status }
  })

  // POST /api/reorder-features
  fastify.post('/api/reorder-features', async (req, reply) => {
    const parsed = reorderFeaturesBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' })
    }
    const { pages } = parsed.data
    const metaPath = setMetaPath(projectRoot, featuresDir)
    const raw = await readText(metaPath)
    let meta: { pages?: unknown } & Record<string, unknown>
    try {
      meta = JSON.parse(raw) as { pages?: unknown } & Record<string, unknown>
    } catch {
      return reply.code(500).send({ error: 'invalid_meta' })
    }
    const currentSet = new Set(Array.isArray(meta.pages) ? (meta.pages as string[]) : [])
    const newSet = new Set(pages)
    if (currentSet.size !== newSet.size || [...currentSet].some((s) => !newSet.has(s))) {
      return reply.code(400).send({ error: 'invalid_pages' })
    }
    meta.pages = pages
    await atomicWrite(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
    return { ok: true }
  })

  // POST /api/reorder-tasks
  fastify.post('/api/reorder-tasks', async (req, reply) => {
    const parsed = reorderTasksBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' })
    }
    const { feature, pages } = parsed.data
    const metaPath = setMetaPath(projectRoot, featuresDir, feature)
    if (!(await fileExists(metaPath))) {
      return reply.code(404).send({ error: 'feature_not_found' })
    }
    const raw = await readText(metaPath)
    let meta: { pages?: unknown } & Record<string, unknown>
    try {
      meta = JSON.parse(raw) as { pages?: unknown } & Record<string, unknown>
    } catch {
      return reply.code(500).send({ error: 'invalid_meta' })
    }
    const currentSet = new Set(Array.isArray(meta.pages) ? (meta.pages as string[]) : [])
    const newSet = new Set(pages)
    if (currentSet.size !== newSet.size || [...currentSet].some((s) => !newSet.has(s))) {
      return reply.code(400).send({ error: 'invalid_pages' })
    }
    meta.pages = pages
    await atomicWrite(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
    return { ok: true }
  })

  // POST /api/run-agent
  fastify.post('/api/run-agent', async (req, reply) => {
    const parsed = runAgentBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' })
    }
    const fresh = await readConfigFile(projectRoot).catch(() => config)
    const result = await runAgent(parsed.data, fresh, projectRoot)
    if (result.ok) return { ok: true }
    return reply.code(result.status).send({
      error: result.error,
      ...('detail' in result ? { detail: result.detail } : {}),
      ...('hint' in result ? { hint: result.hint } : {}),
    })
  })

  // POST /api/run-refinement — dispara o agent `refinement` em terminal externo
  // com texto livre fornecido pelo usuário.
  fastify.post('/api/run-refinement', async (req, reply) => {
    const parsed = runRefinementBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', detail: parsed.error.message })
    }
    const fresh = await readConfigFile(projectRoot).catch(() => config)
    const result = runRefinement(parsed.data.prompt, fresh, projectRoot)
    if (result.ok) return { ok: true }
    return reply.code(result.status).send({
      error: result.error,
      ...('detail' in result ? { detail: result.detail } : {}),
      ...('hint' in result ? { hint: result.hint } : {}),
    })
  })

  // POST /api/run-discovery-agent — dispara o agent `discovery-agent` em terminal
  // externo com texto livre fornecido pelo usuário.
  fastify.post('/api/run-discovery-agent', async (req, reply) => {
    const parsed = runDiscoveryAgentBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', detail: parsed.error.message })
    }
    const fresh = await readConfigFile(projectRoot).catch(() => config)
    const result = runDiscoveryAgent(parsed.data.prompt, fresh, projectRoot)
    if (result.ok) return { ok: true }
    return reply.code(result.status).send({
      error: result.error,
      ...('detail' in result ? { detail: result.detail } : {}),
      ...('hint' in result ? { hint: result.hint } : {}),
    })
  })

  // POST /api/run-drawing-agent — dispara o agent `drawing-agent` em terminal
  // externo com texto livre fornecido pelo usuário.
  fastify.post('/api/run-drawing-agent', async (req, reply) => {
    const parsed = runDrawingAgentBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', detail: parsed.error.message })
    }
    const fresh = await readConfigFile(projectRoot).catch(() => config)
    const result = runDrawingAgent(parsed.data.prompt, fresh, projectRoot)
    if (result.ok) return { ok: true }
    return reply.code(result.status).send({
      error: result.error,
      ...('detail' in result ? { detail: result.detail } : {}),
      ...('hint' in result ? { hint: result.hint } : {}),
    })
  })

  // PUT /api/content — reescreve o arquivo .md de uma task (inclui frontmatter).
  fastify.put('/api/content', async (req, reply) => {
    const parsed = updateContentBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', detail: parsed.error.message })
    }
    const { feature, task, body } = parsed.data
    let taskPath: string
    try {
      taskPath = setTaskPath(projectRoot, featuresDir, feature, task)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (!(await fileExists(taskPath))) {
      return reply.code(404).send({ error: 'task_not_found' })
    }
    await atomicWrite(taskPath, body)
    return { ok: true }
  })

  // DELETE /api/task — remove .md + remove slug do pages no meta.json da feature.
  fastify.delete('/api/task', async (req, reply) => {
    const parsed = deleteTaskQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    const { feature, task } = parsed.data
    let taskPath: string
    let featureMetaPath: string
    try {
      taskPath = setTaskPath(projectRoot, featuresDir, feature, task)
      featureMetaPath = setMetaPath(projectRoot, featuresDir, feature)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    // Remove o arquivo .md (se existir — idempotente)
    if (await fileExists(taskPath)) {
      await unlink(taskPath)
    }
    // Remove o slug do pages no meta.json (se existir)
    if (await fileExists(featureMetaPath)) {
      const raw = await readText(featureMetaPath)
      try {
        const meta = JSON.parse(raw) as { pages?: unknown } & Record<string, unknown>
        if (Array.isArray(meta.pages)) {
          const filtered = (meta.pages as unknown[]).filter((p) => p !== task)
          if (filtered.length !== (meta.pages as unknown[]).length) {
            meta.pages = filtered
            await atomicWrite(featureMetaPath, `${JSON.stringify(meta, null, 2)}\n`)
          }
        }
      } catch {
        // meta.json inválido — ignora a parte do meta mas já deletamos o .md
      }
    }
    return { ok: true }
  })

  // DELETE /api/feature — remove a pasta inteira da feature + remove slug do
  // pages no meta.json raiz.
  fastify.delete('/api/feature', async (req, reply) => {
    const parsed = deleteFeatureQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    const { feature } = parsed.data
    const featureDir = path.resolve(projectRoot, featuresDir, feature)
    try {
      assertInsideProject(featureDir, projectRoot)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    // Remove o diretório da feature recursivamente (se existir)
    if (await dirExists(featureDir)) {
      await rm(featureDir, { recursive: true, force: true })
    }
    // Remove do pages no meta.json raiz
    const rootMetaPath = setMetaPath(projectRoot, featuresDir)
    if (await fileExists(rootMetaPath)) {
      const raw = await readText(rootMetaPath)
      try {
        const meta = JSON.parse(raw) as { pages?: unknown } & Record<string, unknown>
        if (Array.isArray(meta.pages)) {
          const filtered = (meta.pages as unknown[]).filter((p) => p !== feature)
          if (filtered.length !== (meta.pages as unknown[]).length) {
            meta.pages = filtered
            await atomicWrite(rootMetaPath, `${JSON.stringify(meta, null, 2)}\n`)
          }
        }
      } catch {
        // meta.json inválido — ignora mas já deletamos a pasta
      }
    }
    return { ok: true }
  })

  // GET /api/discovery/content?slug=X
  fastify.get('/api/discovery/content', async (req, reply) => {
    const parsed = discoveryContentQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    const { slug } = parsed.data
    let discoveryPath: string
    try {
      discoveryPath = setDiscoveryPath(projectRoot, discoveriesDir, slug)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (!(await fileExists(discoveryPath))) {
      return reply.code(404).send({ error: 'discovery_not_found' })
    }
    const raw = await readText(discoveryPath)
    const { data, body } = parseFrontmatter(raw)
    const frontmatter = {
      ...data,
      ...extractDiscoveryFrontmatterFields(data),
    }
    const headings = extractHeadings(body)
    return { frontmatter, body, headings, raw }
  })

  // PUT /api/discovery/content — reescreve o arquivo .md de uma discovery (inclui frontmatter).
  fastify.put('/api/discovery/content', async (req, reply) => {
    const parsed = updateDiscoveryContentBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', detail: parsed.error.message })
    }
    const { slug, body } = parsed.data
    let discoveryPath: string
    try {
      discoveryPath = setDiscoveryPath(projectRoot, discoveriesDir, slug)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (!(await fileExists(discoveryPath))) {
      return reply.code(404).send({ error: 'discovery_not_found' })
    }
    await atomicWrite(discoveryPath, body)
    return { ok: true }
  })

  // DELETE /api/discovery — remove .md + remove slug do pages no meta.json.
  fastify.delete('/api/discovery', async (req, reply) => {
    const parsed = deleteDiscoveryQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    const { slug } = parsed.data
    let discoveryPath: string
    let discoveryMetaPath: string
    try {
      discoveryPath = setDiscoveryPath(projectRoot, discoveriesDir, slug)
      discoveryMetaPath = setDiscoveryMetaPath(projectRoot, discoveriesDir)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (await fileExists(discoveryPath)) {
      await unlink(discoveryPath)
    }
    if (await fileExists(discoveryMetaPath)) {
      const raw = await readText(discoveryMetaPath)
      try {
        const meta = JSON.parse(raw) as { pages?: unknown } & Record<string, unknown>
        if (Array.isArray(meta.pages)) {
          const filtered = (meta.pages as unknown[]).filter((p) => p !== slug)
          if (filtered.length !== (meta.pages as unknown[]).length) {
            meta.pages = filtered
            await atomicWrite(discoveryMetaPath, `${JSON.stringify(meta, null, 2)}\n`)
          }
        }
      } catch {
        // meta inválido — ignora
      }
    }
    return { ok: true }
  })

  // POST /api/reorder-discoveries
  fastify.post('/api/reorder-discoveries', async (req, reply) => {
    const parsed = reorderDiscoveriesBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' })
    }
    const { pages } = parsed.data
    const metaPath = setDiscoveryMetaPath(projectRoot, discoveriesDir)
    if (!(await fileExists(metaPath))) {
      return reply.code(404).send({ error: 'discoveries_meta_not_found' })
    }
    const raw = await readText(metaPath)
    let meta: { pages?: unknown } & Record<string, unknown>
    try {
      meta = JSON.parse(raw) as { pages?: unknown } & Record<string, unknown>
    } catch {
      return reply.code(500).send({ error: 'invalid_meta' })
    }
    const currentSet = new Set(Array.isArray(meta.pages) ? (meta.pages as string[]) : [])
    const newSet = new Set(pages)
    if (currentSet.size !== newSet.size || [...currentSet].some((s) => !newSet.has(s))) {
      return reply.code(400).send({ error: 'invalid_pages' })
    }
    meta.pages = pages
    await atomicWrite(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
    return { ok: true }
  })

  // GET /api/drawing/content?slug=X
  fastify.get('/api/drawing/content', async (req, reply) => {
    const parsed = drawingContentQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    let drawingPath: string
    try {
      drawingPath = setDrawingPath(projectRoot, drawingsDir, parsed.data.slug)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (!(await fileExists(drawingPath))) {
      return reply.code(404).send({ error: 'drawing_not_found' })
    }
    const raw = await readText(drawingPath)
    const { data, body } = parseFrontmatter(raw)
    const frontmatter = {
      ...data,
      ...extractDrawingFrontmatterFields(data),
    }
    const headings = extractHeadings(body)
    return { frontmatter, body, headings, raw }
  })

  // PUT /api/drawing/content — reescreve o arquivo .md de um desenho (inclui frontmatter).
  fastify.put('/api/drawing/content', async (req, reply) => {
    const parsed = updateDrawingContentBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', detail: parsed.error.message })
    }
    const { slug, body } = parsed.data
    let drawingPath: string
    try {
      drawingPath = setDrawingPath(projectRoot, drawingsDir, slug)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (!(await fileExists(drawingPath))) {
      return reply.code(404).send({ error: 'drawing_not_found' })
    }
    await atomicWrite(drawingPath, body)
    return { ok: true }
  })

  // DELETE /api/drawing — remove .md + remove slug do pages no meta.json.
  fastify.delete('/api/drawing', async (req, reply) => {
    const parsed = deleteDrawingQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    const { slug } = parsed.data
    let drawingPath: string
    let drawingMetaPath: string
    try {
      drawingPath = setDrawingPath(projectRoot, drawingsDir, slug)
      drawingMetaPath = setDrawingMetaPath(projectRoot, drawingsDir)
    } catch {
      return reply.code(400).send({ error: 'invalid_path' })
    }
    if (await fileExists(drawingPath)) {
      await unlink(drawingPath)
    }
    if (await fileExists(drawingMetaPath)) {
      const raw = await readText(drawingMetaPath)
      try {
        const meta = JSON.parse(raw) as { pages?: unknown } & Record<string, unknown>
        if (Array.isArray(meta.pages)) {
          const filtered = (meta.pages as unknown[]).filter((p) => p !== slug)
          if (filtered.length !== (meta.pages as unknown[]).length) {
            meta.pages = filtered
            await atomicWrite(drawingMetaPath, `${JSON.stringify(meta, null, 2)}\n`)
          }
        }
      } catch {
        // meta inválido — ignora
      }
    }
    return { ok: true }
  })

  // POST /api/reorder-drawings
  fastify.post('/api/reorder-drawings', async (req, reply) => {
    const parsed = reorderDrawingsBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' })
    }
    const { pages } = parsed.data
    const metaPath = setDrawingMetaPath(projectRoot, drawingsDir)
    if (!(await fileExists(metaPath))) {
      return reply.code(404).send({ error: 'drawings_meta_not_found' })
    }
    const raw = await readText(metaPath)
    let meta: { pages?: unknown } & Record<string, unknown>
    try {
      meta = JSON.parse(raw) as { pages?: unknown } & Record<string, unknown>
    } catch {
      return reply.code(500).send({ error: 'invalid_meta' })
    }
    const currentSet = new Set(Array.isArray(meta.pages) ? (meta.pages as string[]) : [])
    const newSet = new Set(pages)
    if (currentSet.size !== newSet.size || [...currentSet].some((s) => !newSet.has(s))) {
      return reply.code(400).send({ error: 'invalid_pages' })
    }
    meta.pages = pages
    await atomicWrite(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
    return { ok: true }
  })

  // GET /api/prototype — protótipo em vigor (config do projeto + override da feature)
  fastify.get('/api/prototype', async (req, reply) => {
    const parsed = prototypeQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    const fresh = await readConfigFile(projectRoot).catch(() => config)
    const prototype = await resolvePrototype(projectRoot, fresh, parsed.data.feature)
    return { prototype }
  })

  // GET /api/prototype/frame — snapshot local do protótipo, servido na mesma
  // origem da UI para poder ir num iframe (o canvas remoto manda
  // `frame-ancestors 'self'` e recusa embed cross-origin).
  fastify.get('/api/prototype/frame', async (req, reply) => {
    const parsed = prototypeQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query' })
    }
    const fresh = await readConfigFile(projectRoot).catch(() => config)
    const prototype = await resolvePrototype(projectRoot, fresh, parsed.data.feature)
    if (!prototype) return reply.code(404).send({ error: 'no_prototype' })
    const abs = snapshotAbsolutePath(projectRoot, prototype)
    if (!abs) return reply.code(404).send({ error: 'no_snapshot' })
    const html = await readText(abs)
    return reply.type('text/html; charset=utf-8').header('cache-control', 'no-store').send(html)
  })

  // POST /api/prototype/open — abre o protótipo no app local (Pencil)
  fastify.post('/api/prototype/open', async (req, reply) => {
    const parsed = prototypeQuerySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' })
    }
    const fresh = await readConfigFile(projectRoot).catch(() => config)
    const prototype = await resolvePrototype(projectRoot, fresh, parsed.data.feature)
    if (!prototype) return reply.code(404).send({ error: 'no_prototype' })
    const result = openPrototype(projectRoot, prototype)
    if (result.ok) return result
    return reply.code(result.status).send(result)
  })

  // GET /api/config
  // Uso de tokens do Claude Code (mesmo dado do `/usage`). É informativo: quando
  // não há cache — outra CLI, ou Claude Code nunca rodou aqui — devolve null e a
  // UI simplesmente não mostra o medidor.
  // SSE de mudanças no disco. A UI abre uma conexão só e invalida as queries
  // conforme os eventos chegam. `watching: false` avisa que o SO não suporta
  // watch recursivo, e aí a UI volta a pollar.
  fastify.get('/api/events', async (req, reply) => {
    reply.raw.setHeader('content-type', 'text/event-stream')
    reply.raw.setHeader('cache-control', 'no-cache, no-transform')
    reply.raw.setHeader('connection', 'keep-alive')
    reply.raw.setHeader('x-accel-buffering', 'no')
    reply.raw.flushHeaders?.()

    reply.raw.write(`data: ${JSON.stringify({ type: 'hello', watching: watcher.watching })}\n\n`)

    const keepAlive = setInterval(() => {
      reply.raw.write(': ping\n\n')
    }, 15_000)

    const unsubscribe = watcher.subscribe((events) => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'change', events })}\n\n`)
    })

    req.raw.on('close', () => {
      clearInterval(keepAlive)
      unsubscribe()
    })

    return reply
  })

  fastify.get('/api/usage', async (_req, reply) => {
    return reply.send({ usage: await readClaudeUsage() })
  })

  fastify.get('/api/config', async (_req, reply) => {
    try {
      const fresh = await readConfigFile(projectRoot)
      return { config: fresh, projectRoot }
    } catch (err) {
      return reply.code(500).send({ error: 'invalid_config', detail: (err as Error).message })
    }
  })

  // Health
  fastify.get('/health', async () => ({ ok: true }))

  const host = '127.0.0.1'
  const port = config.port
  await fastify.listen({ host, port })

  return {
    url: `http://localhost:${port}`,
    port,
    close: async () => {
      watcher.close()
      await jobManager.shutdownAll()
      await fastify.close()
    },
  }
}

// helper reexports not used externally but available
export { aggregateStatus }
export type { TaskNode }
