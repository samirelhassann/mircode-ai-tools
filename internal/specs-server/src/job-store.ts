import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { JobKind, JobStatus, JobSummary } from './types.js'

/**
 * Histórico de execuções gravado em disco.
 *
 * Os jobs vivem em memória porque são processos PTY filhos do servidor — quando
 * o servidor morre, eles morrem junto e não há como reconectar num pty destruído.
 * Mas perder a *lista* junto com os processos é gratuito: quem reinicia a
 * plataforma fica sem saber o que rodou, o que perguntou e o que ficou pela
 * metade. Este módulo persiste o registro (label, tempos, status e o fim do
 * buffer) para a sidebar de Execuções sobreviver ao restart.
 */

/** Quantos jobs o arquivo guarda, dos mais recentes para trás. */
export const MAX_PERSISTED_JOBS = 30

/**
 * Quanto do buffer de cada job vai para o disco. O buffer em memória chega a
 * 2 MB; guardar tudo de 30 jobs faria um arquivo de 60 MB para reler a cada
 * boot. O fim do terminal é o que interessa — é lá que está a última pergunta
 * ou o erro.
 */
export const MAX_PERSISTED_BUFFER = 64 * 1024

export type PersistedJob = JobSummary & {
  buffer: string
  /** true quando o registro veio de uma sessão anterior do servidor. */
  restored: true
}

type FileShape = { version: 1; jobs: unknown[] }

/** Onde o histórico mora. Fica ao lado da config, e é runtime — não versione. */
export function jobStorePath(projectRoot: string): string {
  return path.join(projectRoot, '.specs', '.jobs.json')
}

function isJobStatus(v: unknown): v is JobStatus {
  return (
    v === 'running' || v === 'needs-input' || v === 'done' || v === 'failed' || v === 'cancelled'
  )
}

function isJobKind(v: unknown): v is JobKind {
  return (
    v === 'agent' ||
    v === 'refinement' ||
    v === 'discovery-agent' ||
    v === 'drawing-agent' ||
    v === 'design'
  )
}

/**
 * Converte um registro cru do arquivo em job restaurado.
 *
 * Status ativo vira `cancelled`: o processo era filho do servidor anterior e
 * morreu com ele. Deixá-lo como `running` faria a sidebar mostrar um spinner
 * eterno para um pty que não existe mais.
 */
export function reviveJob(raw: unknown): PersistedJob | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id.length === 0) return null
  if (typeof r.label !== 'string') return null
  if (!isJobKind(r.kind)) return null
  if (typeof r.startedAt !== 'number' || !Number.isFinite(r.startedAt)) return null

  const status = isJobStatus(r.status) ? r.status : 'cancelled'
  const wasActive = status === 'running' || status === 'needs-input'
  const buffer = typeof r.buffer === 'string' ? r.buffer.slice(-MAX_PERSISTED_BUFFER) : ''

  return {
    id: r.id,
    kind: r.kind,
    label: r.label,
    feature: typeof r.feature === 'string' ? r.feature : undefined,
    task: typeof r.task === 'string' ? r.task : undefined,
    status: wasActive ? 'cancelled' : status,
    pid: typeof r.pid === 'number' ? r.pid : 0,
    startedAt: r.startedAt,
    // Um job que estava vivo não tem fim registrado — o servidor caiu antes.
    // Sem `endedAt`, a duração exibida cresceria para sempre.
    endedAt:
      typeof r.endedAt === 'number'
        ? r.endedAt
        : wasActive
          ? (typeof r.lastSeenAt === 'number' ? r.lastSeenAt : r.startedAt)
          : undefined,
    exitCode: typeof r.exitCode === 'number' ? r.exitCode : undefined,
    bufferBytes: buffer.length,
    needsInputHint: typeof r.needsInputHint === 'string' ? r.needsInputHint : undefined,
    buffer,
    restored: true,
  }
}

/**
 * Lê o histórico. Nunca lança: um arquivo corrompido ou de uma versão futura
 * custa o histórico, não o boot do servidor.
 */
export function loadJobHistory(projectRoot: string): PersistedJob[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(jobStorePath(projectRoot), 'utf8'))
  } catch {
    return []
  }
  if (typeof parsed !== 'object' || parsed === null) return []
  const file = parsed as Partial<FileShape>
  if (file.version !== 1 || !Array.isArray(file.jobs)) return []

  const out: PersistedJob[] = []
  for (const raw of file.jobs) {
    const job = reviveJob(raw)
    if (job) out.push(job)
  }
  return out.sort((a, b) => b.startedAt - a.startedAt).slice(0, MAX_PERSISTED_JOBS)
}

export type StorableJob = JobSummary & { buffer: string; lastSeenAt: number }

/**
 * Grava o histórico. Síncrono e atômico de propósito: o momento mais importante
 * para gravar é o shutdown, onde não há para quem esperar uma Promise.
 */
export function saveJobHistory(projectRoot: string, jobs: StorableJob[]): void {
  const trimmed = jobs
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_PERSISTED_JOBS)
    .map((job) => ({ ...job, buffer: job.buffer.slice(-MAX_PERSISTED_BUFFER) }))

  const finalPath = jobStorePath(projectRoot)
  const tmpPath = `${finalPath}.tmp`
  const payload: FileShape = { version: 1, jobs: trimmed }
  try {
    mkdirSync(path.dirname(finalPath), { recursive: true })
    writeFileSync(tmpPath, `${JSON.stringify(payload)}\n`, 'utf8')
    renameSync(tmpPath, finalPath)
  } catch (err) {
    console.error(`[job-store] falha ao gravar histórico: ${(err as Error).message}`)
  }
}
