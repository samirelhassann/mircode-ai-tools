import type { JobStatus, JobSummary } from './types'

const ORIGINAL_TITLE = typeof document !== 'undefined' ? document.title : 'Specs'

let audioCtx: AudioContext | null = null
let soundEnabled = true

export function setNotifierSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

function ensureAudio(): AudioContext | null {
  if (!soundEnabled) return null
  if (typeof window === 'undefined') return null
  try {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if (!Ctor) return null
    if (!audioCtx) audioCtx = new Ctor()
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  } catch {
    return null
  }
}

function beep(variant: 'needs-input' | 'done' | 'failed' = 'needs-input'): void {
  const ctx = ensureAudio()
  if (!ctx) return
  const now = ctx.currentTime
  const tones =
    variant === 'needs-input' ? [880, 1320] : variant === 'done' ? [660, 880] : [220, 165]
  tones.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = now + idx * 0.12
    const end = start + 0.1
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.15, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, end)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(end + 0.05)
  })
}

function updateDocumentTitle(jobs: JobSummary[]): void {
  if (typeof document === 'undefined') return
  const awaiting = jobs.filter((j) => j.status === 'needs-input').length
  const running = jobs.filter((j) => j.status === 'running').length
  if (awaiting > 0) {
    document.title = `(!) ${ORIGINAL_TITLE} — ${awaiting} esperando`
    return
  }
  if (running > 0) {
    document.title = `(${running}) ${ORIGINAL_TITLE}`
    return
  }
  document.title = ORIGINAL_TITLE
}

/**
 * Mantido pelo contrato de quem chama; hoje não há nada para inicializar. O
 * aviso de mudança de estado é **som + título da aba + a sidebar de Execuções**
 * — sem toast e sem Notification do browser, que despejavam o buffer cru do
 * terminal numa caixa que o usuário não pediu.
 */
export function initNotifier(): void {}

type NotifyArgs = {
  job: JobSummary
  prevStatus: JobStatus | null
  allJobs: JobSummary[]
}

/**
 * Avisa que um job mudou de estado — por **som** e pelo **título da aba**. O
 * estado em si (quem espera input, quem terminou) é mostrado pela sidebar de
 * Execuções, que já está na tela; empilhar um toast por cima disso é ruído.
 */
export function notifyJobStateChange({ job, prevStatus, allJobs }: NotifyArgs): void {
  updateDocumentTitle(allJobs)

  if (prevStatus === job.status) return

  if (job.status === 'needs-input') beep('needs-input')
  else if (job.status === 'done') beep('done')
  else if (job.status === 'failed') beep('failed')
}

export function refreshDocumentTitle(jobs: JobSummary[]): void {
  updateDocumentTitle(jobs)
}
