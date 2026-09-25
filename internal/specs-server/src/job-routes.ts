import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SLUG_REGEX } from './fs-utils.js'
import { compilePromptPatterns, type JobEvent, type JobManager } from './job-manager.js'
import {
  buildAgentInlineCommand,
  buildDesignInlineCommand,
  buildNamedAgentInlineCommand,
  listAgentModels,
  runAgent,
  runDesign,
  runDiscoveryAgent,
  runDrawingAgent,
  runRefinement,
  runRefinementRunner,
} from './run-agent.js'
import { buildDesignPrompt, resolvePrototype } from './prototype.js'
import { AGENT_EFFORTS, type SpecsConfig } from './types.js'

const slugSchema = z.string().regex(SLUG_REGEX)

const cliSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/)
  .optional()

const modelSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._\-/:]*$/)
  .optional()

const effortSchema = z.enum(AGENT_EFFORTS).optional()

const createJobBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('agent'),
    mode: z.enum(['inline', 'external']).default('inline'),
    cli: cliSchema,
    model: modelSchema,
    effort: effortSchema,
    scope: z.enum(['feature', 'featureNoPause', 'task']),
    feature: slugSchema,
    task: slugSchema.optional(),
    cols: z.number().int().min(20).max(400).optional(),
    rows: z.number().int().min(5).max(200).optional(),
  }),
  z.object({
    kind: z.literal('refinement'),
    mode: z.enum(['inline', 'external']).default('inline'),
    cli: cliSchema,
    model: modelSchema,
    effort: effortSchema,
    prompt: z.string().min(1).max(10_000),
    cols: z.number().int().min(20).max(400).optional(),
    rows: z.number().int().min(5).max(200).optional(),
  }),
  z.object({
    kind: z.literal('refinement-runner'),
    mode: z.enum(['inline', 'external']).default('inline'),
    cli: cliSchema,
    model: modelSchema,
    effort: effortSchema,
    prompt: z.string().min(1).max(10_000),
    cols: z.number().int().min(20).max(400).optional(),
    rows: z.number().int().min(5).max(200).optional(),
  }),
  z.object({
    kind: z.literal('design'),
    mode: z.enum(['inline', 'external']).default('inline'),
    cli: cliSchema,
    model: modelSchema,
    effort: effortSchema,
    /** Pedido de alteração escrito pelo usuário no painel de protótipo. */
    prompt: z.string().min(1).max(10_000),
    /** `snapshot` regrava a cópia local usada no iframe; `change` (default) altera o design. */
    intent: z.enum(['change', 'snapshot']).default('change'),
    feature: slugSchema.optional(),
    task: slugSchema.optional(),
    cols: z.number().int().min(20).max(400).optional(),
    rows: z.number().int().min(5).max(200).optional(),
  }),
  z.object({
    kind: z.literal('discovery-agent'),
    mode: z.enum(['inline', 'external']).default('inline'),
    cli: cliSchema,
    model: modelSchema,
    effort: effortSchema,
    prompt: z.string().min(1).max(10_000),
    cols: z.number().int().min(20).max(400).optional(),
    rows: z.number().int().min(5).max(200).optional(),
  }),
  z.object({
    kind: z.literal('drawing-agent'),
    mode: z.enum(['inline', 'external']).default('inline'),
    cli: cliSchema,
    model: modelSchema,
    effort: effortSchema,
    prompt: z.string().min(1).max(10_000),
    cols: z.number().int().min(20).max(400).optional(),
    rows: z.number().int().min(5).max(200).optional(),
  }),
])

const jobIdParamSchema = z.object({ id: z.string().min(1).max(64) })

const inputBodySchema = z.object({ data: z.string().max(10_000) })

const resizeBodySchema = z.object({
  cols: z.number().int().min(20).max(400),
  rows: z.number().int().min(5).max(200),
})

function sseEvent(ev: JobEvent): string {
  return `event: ${ev.type}\ndata: ${JSON.stringify(ev.payload)}\n\n`
}

export function registerJobRoutes(
  fastify: FastifyInstance,
  jobs: JobManager,
  getConfig: () => Promise<SpecsConfig>,
  projectRoot: string,
): void {
  fastify.post('/api/jobs', async (req, reply) => {
    const parsed = createJobBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', detail: parsed.error.message })
    }
    const config = await getConfig()
    const body = parsed.data

    // Jobs de design dependem do protótipo declarado (config do projeto ou
    // override da feature) — é ele que decide a ferramenta e o formato do prompt.
    let designPrompt: string | null = null
    let designLabel = ''
    if (body.kind === 'design') {
      const prototype = await resolvePrototype(projectRoot, config, body.feature)
      if (!prototype) {
        return reply.code(400).send({
          error: 'no_prototype',
          detail: 'Nenhum protótipo declarado em .specs/config.json nem no meta.json da feature.',
        })
      }
      designPrompt = buildDesignPrompt(
        prototype,
        body.prompt,
        {
          feature: body.feature,
          task: body.task,
          specPath:
            body.feature && body.task
              ? `${config.featuresDir}/${body.feature}/${body.task}.md`
              : body.feature
                ? `${config.featuresDir}/${body.feature}/`
                : undefined,
        },
        body.intent,
      )
      designLabel =
        body.intent === 'snapshot'
          ? 'Design: sincronizar snapshot'
          : `Design: ${body.prompt.slice(0, 60)}${body.prompt.length > 60 ? '…' : ''}`
    }

    if (body.mode === 'external') {
      if (body.kind === 'agent') {
        const result = await runAgent(
          {
            scope: body.scope,
            feature: body.feature,
            task: body.task,
            cli: body.cli,
            model: body.model,
            effort: body.effort,
          },
          config,
          projectRoot,
        )
        if (result.ok) return { ok: true, mode: 'external' as const }
        return reply.code(result.status).send({
          error: result.error,
          ...('detail' in result ? { detail: result.detail } : {}),
          ...('hint' in result ? { hint: result.hint } : {}),
        })
      }
      if (body.kind === 'refinement') {
        const result = runRefinement(
          body.prompt,
          config,
          projectRoot,
          body.cli,
          body.model,
          body.effort,
        )
        if (result.ok) return { ok: true, mode: 'external' as const }
        return reply.code(result.status).send({
          error: result.error,
          ...('detail' in result ? { detail: result.detail } : {}),
          ...('hint' in result ? { hint: result.hint } : {}),
        })
      }
      if (body.kind === 'refinement-runner') {
        const result = runRefinementRunner(
          body.prompt,
          config,
          projectRoot,
          body.cli,
          body.model,
          body.effort,
        )
        if (result.ok) return { ok: true, mode: 'external' as const }
        return reply.code(result.status).send({
          error: result.error,
          ...('detail' in result ? { detail: result.detail } : {}),
          ...('hint' in result ? { hint: result.hint } : {}),
        })
      }
      if (body.kind === 'design') {
        const result = runDesign(
          designPrompt as string,
          config,
          projectRoot,
          body.cli,
          body.model,
          body.effort,
        )
        if (result.ok) return { ok: true, mode: 'external' as const }
        return reply.code(result.status).send({
          error: result.error,
          ...('detail' in result ? { detail: result.detail } : {}),
          ...('hint' in result ? { hint: result.hint } : {}),
        })
      }
      if (body.kind === 'drawing-agent') {
        const result = runDrawingAgent(
          body.prompt,
          config,
          projectRoot,
          body.cli,
          body.model,
          body.effort,
        )
        if (result.ok) return { ok: true, mode: 'external' as const }
        return reply.code(result.status).send({
          error: result.error,
          ...('detail' in result ? { detail: result.detail } : {}),
          ...('hint' in result ? { hint: result.hint } : {}),
        })
      }
      // discovery-agent
      const result = runDiscoveryAgent(
        body.prompt,
        config,
        projectRoot,
        body.cli,
        body.model,
        body.effort,
      )
      if (result.ok) return { ok: true, mode: 'external' as const }
      return reply.code(result.status).send({
        error: result.error,
        ...('detail' in result ? { detail: result.detail } : {}),
        ...('hint' in result ? { hint: result.hint } : {}),
      })
    }

    // mode === 'inline'
    const patterns = compilePromptPatterns(config.agent.inputPromptPatterns)
    const cwd = path.resolve(projectRoot, config.agent.cwd ?? '.')

    let inline: { file: string; args: string[]; cwd: string; label: string } | null = null

    if (body.kind === 'agent') {
      inline = await buildAgentInlineCommand(
        {
          scope: body.scope,
          feature: body.feature,
          task: body.task,
          cli: body.cli,
          model: body.model,
          effort: body.effort,
        },
        config,
        projectRoot,
      )
    } else if (body.kind === 'refinement') {
      inline = buildNamedAgentInlineCommand(
        'refinement',
        body.prompt,
        config,
        projectRoot,
        `Refinement: ${body.prompt.slice(0, 60)}${body.prompt.length > 60 ? '…' : ''}`,
        body.cli,
        body.model,
        body.effort,
      )
    } else if (body.kind === 'refinement-runner') {
      inline = buildNamedAgentInlineCommand(
        'refinement-runner',
        body.prompt,
        config,
        projectRoot,
        `Refinar + executar: ${body.prompt.slice(0, 60)}${body.prompt.length > 60 ? '…' : ''}`,
        body.cli,
        body.model,
        body.effort,
      )
    } else if (body.kind === 'design') {
      inline = buildDesignInlineCommand(
        designPrompt as string,
        config,
        projectRoot,
        designLabel,
        body.cli,
        body.model,
        body.effort,
      )
    } else if (body.kind === 'drawing-agent') {
      inline = buildNamedAgentInlineCommand(
        'drawing-agent',
        body.prompt,
        config,
        projectRoot,
        `Desenho: ${body.prompt.slice(0, 60)}${body.prompt.length > 60 ? '…' : ''}`,
        body.cli,
        body.model,
        body.effort,
      )
    } else {
      inline = buildNamedAgentInlineCommand(
        'discovery-agent',
        body.prompt,
        config,
        projectRoot,
        `Discovery: ${body.prompt.slice(0, 60)}${body.prompt.length > 60 ? '…' : ''}`,
        body.cli,
        body.model,
        body.effort,
      )
    }

    if (!inline) {
      return reply.code(500).send({
        error: 'inline_build_failed',
        detail: 'Não foi possível montar o comando para execução inline.',
      })
    }

    try {
      const summary = jobs.startJob({
        kind: body.kind,
        label: inline.label,
        file: inline.file,
        args: inline.args,
        cwd: inline.cwd ?? cwd,
        feature: body.kind === 'agent' || body.kind === 'design' ? body.feature : undefined,
        task: body.kind === 'agent' || body.kind === 'design' ? body.task : undefined,
        cols: body.cols,
        rows: body.rows,
        promptPatterns: patterns,
        bufferBytesCap: config.agent.bufferBytesCap,
      })
      return { ok: true, mode: 'inline' as const, jobId: summary.id, job: summary }
    } catch (err) {
      return reply.code(500).send({
        error: 'spawn_failed',
        detail: (err as Error).message,
      })
    }
  })

  fastify.get('/api/jobs', async () => ({ jobs: jobs.listJobs() }))

  const modelsQuerySchema = z.object({
    cli: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9-]+$/),
  })

  fastify.get('/api/agent-models', async (req, reply) => {
    const parsed = modelsQuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' })
    const config = await getConfig()
    const result = await listAgentModels(config, projectRoot, parsed.data.cli)
    return result
  })

  fastify.get('/api/jobs/:id', async (req, reply) => {
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_id' })
    const job = jobs.getJob(parsed.data.id)
    if (!job) return reply.code(404).send({ error: 'job_not_found' })
    return job
  })

  fastify.post('/api/jobs/:id/input', async (req, reply) => {
    const idParsed = jobIdParamSchema.safeParse(req.params)
    if (!idParsed.success) return reply.code(400).send({ error: 'invalid_id' })
    const bodyParsed = inputBodySchema.safeParse(req.body)
    if (!bodyParsed.success) return reply.code(400).send({ error: 'invalid_body' })
    const ok = jobs.writeInput(idParsed.data.id, bodyParsed.data.data)
    if (!ok) return reply.code(404).send({ error: 'job_not_found_or_terminated' })
    return { ok: true }
  })

  fastify.post('/api/jobs/:id/resize', async (req, reply) => {
    const idParsed = jobIdParamSchema.safeParse(req.params)
    if (!idParsed.success) return reply.code(400).send({ error: 'invalid_id' })
    const bodyParsed = resizeBodySchema.safeParse(req.body)
    if (!bodyParsed.success) return reply.code(400).send({ error: 'invalid_body' })
    const ok = jobs.resize(idParsed.data.id, bodyParsed.data.cols, bodyParsed.data.rows)
    if (!ok) return reply.code(404).send({ error: 'job_not_found_or_terminated' })
    return { ok: true }
  })

  fastify.post('/api/jobs/:id/stop', async (req, reply) => {
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_id' })
    const ok = jobs.stopJob(parsed.data.id)
    if (!ok) return reply.code(404).send({ error: 'job_not_found' })
    return { ok: true }
  })

  fastify.delete('/api/jobs/:id', async (req, reply) => {
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_id' })
    const ok = jobs.deleteJob(parsed.data.id)
    if (!ok) return reply.code(409).send({ error: 'job_still_running_or_not_found' })
    return { ok: true }
  })

  fastify.get('/api/jobs/:id/stream', async (req, reply) => {
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_id' })
    const jobId = parsed.data.id
    const snapshot = jobs.getJob(jobId)
    if (!snapshot) return reply.code(404).send({ error: 'job_not_found' })

    reply.raw.setHeader('content-type', 'text/event-stream')
    reply.raw.setHeader('cache-control', 'no-cache, no-transform')
    reply.raw.setHeader('connection', 'keep-alive')
    reply.raw.setHeader('x-accel-buffering', 'no')
    reply.raw.flushHeaders?.()

    // Envia snapshot inicial (buffer atual + status)
    if (snapshot.buffer.length > 0) {
      reply.raw.write(sseEvent({ type: 'chunk', payload: snapshot.buffer }))
    }
    reply.raw.write(
      sseEvent({
        type: 'status',
        payload: {
          status: snapshot.status,
          exitCode: snapshot.exitCode,
          needsInputHint: snapshot.needsInputHint,
        },
      }),
    )

    const keepAlive = setInterval(() => {
      reply.raw.write(': ping\n\n')
    }, 15_000)

    const unsubscribe = jobs.subscribe(jobId, (event) => {
      reply.raw.write(sseEvent(event))
    })

    req.raw.on('close', () => {
      clearInterval(keepAlive)
      unsubscribe()
    })

    // Mantém o handler aberto — Fastify não encerra enquanto reply.raw não terminar.
    return reply
  })
}
