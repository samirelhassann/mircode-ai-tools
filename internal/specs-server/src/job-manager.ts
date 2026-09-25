import { EventEmitter } from 'node:events'
import * as pty from 'node-pty'
import { nanoid } from 'nanoid'
import type { JobKind, JobStatus, JobSummary, JobWithBuffer } from './types.js'
import { loadJobHistory, saveJobHistory, type StorableJob } from './job-store.js'

/**
 * Sequências de escape que um TUI escreve no PTY. Não basta o CSI (`ESC [ … letra`):
 * o Claude Code também emite **OSC** — título da janela (`ESC ] 0 ; texto BEL`) e
 * hyperlinks (`ESC ] 8 ; id=… ; url ST`). Sem removê-los, o `needsInputHint` sai
 * com `]0;` e `]8;id=…https://…` colados no texto e vaza isso para a UI.
 */
const OSC_REGEX = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\|$)/g
const CSI_REGEX = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g
/** `ESC` seguido de um único byte final: `ESC ( B`, `ESC =`, `ESC >`, `ESC M`… */
const SIMPLE_ESC_REGEX = /\x1b[()#][0-9A-Za-z]|\x1b[0-9A-Za-z=><]/g
/** Controles que sobram depois disso (BEL, backspace, VT, SO/SI…), menos \t \n \r. */
const CONTROL_REGEX = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g
/** Um hint é uma linha de terminal — mais que isso é buffer vazando para a UI. */
const HINT_MAX_CHARS = 160
const DEFAULT_COLS = 120
const DEFAULT_ROWS = 30
const INACTIVITY_MS = 2500
const DEBOUNCE_MS = 200
const STOP_SIGTERM_DELAY_MS = 2000
const STOP_SIGKILL_DELAY_MS = 2000
const INPUT_GRACE_MS = 3000
/** Janela de agrupamento das gravações do histórico em disco. */
const PERSIST_DEBOUNCE_MS = 800

/**
 * Remove todo escape de terminal de um texto do PTY. Exportada porque é a
 * fronteira entre o buffer cru e o que a UI mostra — e é onde os OSC vazavam.
 */
export function stripAnsi(s: string): string {
  // OSC primeiro: o corpo dele pode conter algo que o CSI casaria por engano.
  return s
    .replace(OSC_REGEX, '')
    .replace(CSI_REGEX, '')
    .replace(SIMPLE_ESC_REGEX, '')
    .replace(CONTROL_REGEX, '')
}

/** Encurta o hint para caber numa linha da sidebar, sem cortar no meio de uma palavra. */
export function trimHint(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= HINT_MAX_CHARS) return clean
  const cut = clean.slice(0, HINT_MAX_CHARS)
  const space = cut.lastIndexOf(' ')
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Última linha com conteúdo de um trecho de buffer, já sem escapes. */
export function lastNonEmptyLine(text: string, limitLines = 8): string {
  const plain = stripAnsi(text)
  const lines = plain.split(/\r?\n/).slice(-limitLines)
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.trim() ?? ''
    if (t.length > 0) return t
  }
  return ''
}

export type JobEvent =
  | { type: 'chunk'; payload: string }
  | { type: 'status'; payload: { status: JobStatus; exitCode?: number; needsInputHint?: string } }

type Job = {
  id: string
  kind: JobKind
  label: string
  feature?: string
  task?: string
  status: JobStatus
  pid: number
  startedAt: number
  endedAt?: number
  exitCode?: number
  buffer: string
  bufferBytes: number
  needsInputHint?: string
  /**
   * Ausente nos jobs restaurados do disco: o processo era filho do servidor
   * anterior e morreu com ele. Sem pty, o job é só histórico legível.
   */
  pty?: pty.IPty
  /** true quando o job veio do histórico, não desta sessão do servidor. */
  restored?: boolean
  emitter: EventEmitter
  inactivityTimer?: NodeJS.Timeout
  debounceTimer?: NodeJS.Timeout
  stopTimers?: NodeJS.Timeout[]
  lastChunkAt: number
  promptPatterns: RegExp[]
  bufferBytesCap: number
  // Timestamp até o qual o detector de needs-input fica suspenso após o usuário
  // enviar input (evita re-flagar a mesma pergunta enquanto o Claude Code processa).
  graceUntil?: number
}

export type StartJobInput = {
  kind: JobKind
  label: string
  file: string
  args: string[]
  cwd: string
  feature?: string
  task?: string
  cols?: number
  rows?: number
  env?: NodeJS.ProcessEnv
  promptPatterns: RegExp[]
  bufferBytesCap: number
}

const jobs = new Map<string, Job>()

export type JobManagerOptions = {
  /**
   * Raiz do projeto onde o histórico é gravado. Sem ela o manager funciona
   * igual, só não sobrevive a um restart — é o modo usado nos testes.
   */
  projectRoot?: string
}

export function createJobManager(options: JobManagerOptions = {}) {
  const { projectRoot } = options
  let persistTimer: NodeJS.Timeout | null = null

  function toStorable(job: Job): StorableJob {
    return { ...summarize(job), buffer: job.buffer, lastSeenAt: job.lastChunkAt }
  }

  /** Grava agora. Usado no shutdown, onde não dá para esperar o debounce. */
  function persistNow(): void {
    if (!projectRoot) return
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    saveJobHistory(projectRoot, Array.from(jobs.values()).map(toStorable))
  }

  /**
   * Agenda a gravação. O buffer muda a cada chunk do PTY; gravar em cada um
   * transformaria o histórico num gargalo de I/O.
   */
  function schedulePersist(): void {
    if (!projectRoot || persistTimer) return
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistNow()
    }, PERSIST_DEBOUNCE_MS)
    persistTimer.unref?.()
  }

  // Repõe o que a sessão anterior deixou. Os processos não voltam — os registros
  // sim, já marcados como interrompidos por `reviveJob`.
  if (projectRoot) {
    for (const persisted of loadJobHistory(projectRoot)) {
      if (jobs.has(persisted.id)) continue
      const emitter = new EventEmitter()
      emitter.setMaxListeners(32)
      jobs.set(persisted.id, {
        ...persisted,
        buffer: persisted.buffer,
        bufferBytes: persisted.buffer.length,
        emitter,
        lastChunkAt: persisted.endedAt ?? persisted.startedAt,
        promptPatterns: [],
        bufferBytesCap: Math.max(persisted.buffer.length, 1),
        restored: true,
      })
    }
  }

  function summarize(job: Job): JobSummary {
    return {
      id: job.id,
      kind: job.kind,
      label: job.label,
      feature: job.feature,
      task: job.task,
      status: job.status,
      pid: job.pid,
      startedAt: job.startedAt,
      endedAt: job.endedAt,
      exitCode: job.exitCode,
      bufferBytes: job.bufferBytes,
      needsInputHint: job.needsInputHint,
      restored: job.restored,
    }
  }

  function setStatus(job: Job, next: JobStatus, extra?: { exitCode?: number }) {
    if (job.status === next && extra?.exitCode === undefined) return
    job.status = next
    if (extra?.exitCode !== undefined) job.exitCode = extra.exitCode
    job.emitter.emit('event', {
      type: 'status',
      payload: {
        status: next,
        exitCode: job.exitCode,
        needsInputHint: job.needsInputHint,
      },
    } satisfies JobEvent)
    schedulePersist()
  }

  function matchPrompt(job: Job): string | null {
    const tail = job.buffer.slice(-8000)
    const last = lastNonEmptyLine(tail)
    if (!last) return null
    for (const re of job.promptPatterns) {
      if (re.test(last)) return last
    }
    return null
  }

  function evaluateNeedsInput(job: Job, trigger: 'chunk' | 'inactivity') {
    if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') return
    // Sticky: uma vez marcado como needs-input, só sai quando o usuário envia input
    // (ver writeInput) ou o processo termina. O TUI do Claude Code costuma redesenhar
    // spinners/indicadores sobre a linha do prompt, fazendo matchPrompt oscilar —
    // se tratássemos cada flap como transição, dispararíamos notificação repetida.
    if (job.status === 'needs-input') return
    // Grace period após writeInput: o Claude Code ainda pode estar ecoando a resposta
    // e/ou re-renderizando a pergunta antiga por alguns ms. Não re-flagar enquanto isso.
    if (job.graceUntil && Date.now() < job.graceUntil) return
    const match = matchPrompt(job)
    const quietLongEnough = Date.now() - job.lastChunkAt >= INACTIVITY_MS
    const shouldFlag = Boolean(match) || (trigger === 'inactivity' && quietLongEnough)
    if (shouldFlag) {
      job.needsInputHint = trimHint(match ?? lastNonEmptyLine(job.buffer.slice(-2000)))
      setStatus(job, 'needs-input')
    }
  }

  function scheduleInactivity(job: Job) {
    if (job.inactivityTimer) clearTimeout(job.inactivityTimer)
    job.inactivityTimer = setTimeout(() => {
      evaluateNeedsInput(job, 'inactivity')
    }, INACTIVITY_MS + 100)
  }

  function appendToBuffer(job: Job, chunk: string) {
    job.buffer += chunk
    if (job.buffer.length > job.bufferBytesCap) {
      job.buffer = job.buffer.slice(job.buffer.length - job.bufferBytesCap)
    }
    job.bufferBytes = job.buffer.length
    job.lastChunkAt = Date.now()
    schedulePersist()
  }

  function startJob(input: StartJobInput): JobSummary {
    const id = nanoid(10)
    const cols = input.cols ?? DEFAULT_COLS
    const rows = input.rows ?? DEFAULT_ROWS
    const env = {
      ...process.env,
      ...input.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
    }
    const ptyProc = pty.spawn(input.file, input.args, {
      name: 'xterm-256color',
      cwd: input.cwd,
      cols,
      rows,
      env,
    })

    const emitter = new EventEmitter()
    emitter.setMaxListeners(32)
    const job: Job = {
      id,
      kind: input.kind,
      label: input.label,
      feature: input.feature,
      task: input.task,
      status: 'running',
      pid: ptyProc.pid,
      startedAt: Date.now(),
      buffer: '',
      bufferBytes: 0,
      pty: ptyProc,
      emitter,
      lastChunkAt: Date.now(),
      promptPatterns: input.promptPatterns,
      bufferBytesCap: input.bufferBytesCap,
    }
    jobs.set(id, job)

    ptyProc.onData((chunk) => {
      appendToBuffer(job, chunk)
      emitter.emit('event', { type: 'chunk', payload: chunk } satisfies JobEvent)
      if (job.debounceTimer) clearTimeout(job.debounceTimer)
      job.debounceTimer = setTimeout(() => {
        evaluateNeedsInput(job, 'chunk')
      }, DEBOUNCE_MS)
      scheduleInactivity(job)
    })

    ptyProc.onExit(({ exitCode, signal }) => {
      if (job.inactivityTimer) clearTimeout(job.inactivityTimer)
      if (job.debounceTimer) clearTimeout(job.debounceTimer)
      job.endedAt = Date.now()
      if (signal !== undefined && signal !== 0 && job.status === 'cancelled') {
        setStatus(job, 'cancelled', { exitCode })
      } else if (exitCode === 0) {
        setStatus(job, 'done', { exitCode })
      } else {
        setStatus(job, 'failed', { exitCode })
      }
    })

    scheduleInactivity(job)
    schedulePersist()
    return summarize(job)
  }

  function writeInput(jobId: string, data: string): boolean {
    const job = jobs.get(jobId)
    if (!job || !job.pty) return false
    if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
      return false
    }
    job.pty.write(data)
    // O usuário respondeu: volta pra running e entra em grace period — o detector
    // fica suspenso por INPUT_GRACE_MS para não re-flagar a mesma pergunta enquanto
    // o Claude Code processa a resposta.
    job.graceUntil = Date.now() + INPUT_GRACE_MS
    if (job.status === 'needs-input') {
      job.needsInputHint = undefined
      setStatus(job, 'running')
    }
    return true
  }

  function resize(jobId: string, cols: number, rows: number): boolean {
    const job = jobs.get(jobId)
    if (!job || !job.pty) return false
    if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
      return false
    }
    try {
      job.pty.resize(Math.max(1, cols | 0), Math.max(1, rows | 0))
      return true
    } catch {
      return false
    }
  }

  function stopJob(jobId: string): boolean {
    const job = jobs.get(jobId)
    if (!job) return false
    if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
      return true
    }
    // Job restaurado nunca está ativo (reviveJob já o marcou como cancelado),
    // mas se estivesse não haveria processo para sinalizar.
    if (!job.pty) return true
    try {
      job.pty.kill('SIGINT')
    } catch {}
    // Marca otimisticamente como cancelled; o onExit confirmará.
    setStatus(job, 'cancelled')
    const pty1 = job.pty
    const t1 = setTimeout(() => {
      if (job.status === 'cancelled' && job.endedAt === undefined) {
        try {
          pty1.kill('SIGTERM')
        } catch {}
      }
    }, STOP_SIGTERM_DELAY_MS)
    const t2 = setTimeout(() => {
      if (job.status === 'cancelled' && job.endedAt === undefined) {
        try {
          pty1.kill('SIGKILL')
        } catch {}
      }
    }, STOP_SIGTERM_DELAY_MS + STOP_SIGKILL_DELAY_MS)
    job.stopTimers = [t1, t2]
    return true
  }

  function deleteJob(jobId: string): boolean {
    const job = jobs.get(jobId)
    if (!job) return false
    if (job.status === 'running' || job.status === 'needs-input') return false
    if (job.stopTimers) job.stopTimers.forEach(clearTimeout)
    if (job.inactivityTimer) clearTimeout(job.inactivityTimer)
    if (job.debounceTimer) clearTimeout(job.debounceTimer)
    job.emitter.removeAllListeners()
    jobs.delete(jobId)
    schedulePersist()
    return true
  }

  function listJobs(): JobSummary[] {
    return Array.from(jobs.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(summarize)
  }

  function getJob(jobId: string): JobWithBuffer | null {
    const job = jobs.get(jobId)
    if (!job) return null
    return { ...summarize(job), buffer: job.buffer }
  }

  function subscribe(jobId: string, handler: (event: JobEvent) => void): () => void {
    const job = jobs.get(jobId)
    if (!job) return () => {}
    job.emitter.on('event', handler)
    return () => {
      job.emitter.off('event', handler)
    }
  }

  async function shutdownAll(): Promise<void> {
    // Grava antes de matar: é este arquivo que a próxima sessão vai reler para
    // repor a lista de Execuções.
    persistNow()
    for (const job of jobs.values()) {
      if (job.inactivityTimer) clearTimeout(job.inactivityTimer)
      if (job.debounceTimer) clearTimeout(job.debounceTimer)
      if (job.stopTimers) job.stopTimers.forEach(clearTimeout)
      try {
        if (job.pty && (job.status === 'running' || job.status === 'needs-input')) {
          job.pty.kill('SIGKILL')
        }
      } catch {}
      job.emitter.removeAllListeners()
    }
    jobs.clear()
  }

  return {
    startJob,
    writeInput,
    resize,
    stopJob,
    deleteJob,
    listJobs,
    getJob,
    subscribe,
    shutdownAll,
  }
}

export type JobManager = ReturnType<typeof createJobManager>

export function compilePromptPatterns(patterns: string[]): RegExp[] {
  const compiled: RegExp[] = []
  for (const p of patterns) {
    try {
      compiled.push(new RegExp(p, 'i'))
    } catch (err) {
      console.error(`[job-manager] invalid prompt pattern "${p}": ${(err as Error).message}`)
    }
  }
  return compiled
}
