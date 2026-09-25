import { describe, expect, it } from 'vitest'
import {
  compilePromptPatterns,
  createJobManager,
  lastNonEmptyLine,
  stripAnsi,
  trimHint,
  type JobEvent,
} from './job-manager.js'

const basePatterns = compilePromptPatterns(['\\?\\s*$', '\\((?:y\\/n|Y\\/n|y\\/N|Y\\/N)\\)'])

function waitForStatus(
  mgr: ReturnType<typeof createJobManager>,
  jobId: string,
  target: string,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      unsubscribe()
      reject(new Error(`timeout waiting for status ${target}`))
    }, timeoutMs)
    const unsubscribe = mgr.subscribe(jobId, (ev: JobEvent) => {
      if (ev.type === 'status' && ev.payload.status === target) {
        clearTimeout(t)
        unsubscribe()
        resolve()
      }
    })
    // Pode já estar no estado alvo
    const snap = mgr.getJob(jobId)
    if (snap?.status === target) {
      clearTimeout(t)
      unsubscribe()
      resolve()
    }
  })
}

describe('stripAnsi', () => {
  it('remove CSI (cores, movimento de cursor)', () => {
    expect(stripAnsi('\x1b[38;2;153;153;153m✻\x1b[3G ok\x1b[39m')).toBe('✻ ok')
  })

  it('remove OSC de título de janela — o `]0;` que vazava para o hint', () => {
    expect(stripAnsi('\x1b]0;✳ drawing-agent\x07pronto')).toBe('pronto')
  })

  it('remove OSC 8 (hyperlink) com terminador ST, sem deixar a URL', () => {
    const raw = '\x1b]8;id=1nj0z8;https://claude.ai/code/session_01\x1b\\texto\x1b]8;;\x1b\\'
    expect(stripAnsi(raw)).toBe('texto')
  })

  it('remove BEL e demais controles, preservando tab e quebra de linha', () => {
    expect(stripAnsi('a\x07b\tc\nd')).toBe('ab\tc\nd')
  })

  it('deixa texto limpo intacto', () => {
    expect(stripAnsi('Do you want to proceed? (y/n)')).toBe('Do you want to proceed? (y/n)')
  })
})

describe('trimHint', () => {
  it('colapsa espaços e não mexe em texto curto', () => {
    expect(trimHint('  aguardando   input \n')).toBe('aguardando input')
  })

  it('corta no limite sem partir palavra e marca com reticências', () => {
    const out = trimHint('palavra '.repeat(40))
    expect(out.length).toBeLessThanOrEqual(161)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toContain('palavr…')
  })
})

describe('lastNonEmptyLine', () => {
  it('devolve a última linha com conteúdo, já sem escapes', () => {
    const raw = 'linha antiga\n\x1b]0;titulo\x07\x1b[2K\rDo you want to proceed?\n\n'
    expect(lastNonEmptyLine(raw)).toBe('Do you want to proceed?')
  })
})

describe('job-manager', () => {
  it('roda um comando simples e marca done com exitCode=0', async () => {
    const mgr = createJobManager()
    const job = mgr.startJob({
      kind: 'agent',
      label: 'echo test',
      file: 'node',
      args: ['-e', 'process.stdout.write("hello world"); process.exit(0)'],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    expect(job.status).toBe('running')
    await waitForStatus(mgr, job.id, 'done')
    const finished = mgr.getJob(job.id)
    expect(finished?.status).toBe('done')
    expect(finished?.exitCode).toBe(0)
    expect(finished?.buffer).toContain('hello world')
    await mgr.shutdownAll()
  })

  it('marca failed quando exitCode != 0', async () => {
    const mgr = createJobManager()
    const job = mgr.startJob({
      kind: 'agent',
      label: 'fail',
      file: 'node',
      args: ['-e', 'process.exit(7)'],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    await waitForStatus(mgr, job.id, 'failed')
    const j = mgr.getJob(job.id)
    expect(j?.status).toBe('failed')
    expect(j?.exitCode).toBe(7)
    await mgr.shutdownAll()
  })

  it('detecta needs-input por padrão (?)', async () => {
    const mgr = createJobManager()
    const job = mgr.startJob({
      kind: 'agent',
      label: 'needs-input',
      file: 'node',
      args: [
        '-e',
        `process.stdout.write('Do you want to continue?\\n'); setTimeout(() => process.exit(0), 10000)`,
      ],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    await waitForStatus(mgr, job.id, 'needs-input', 7000)
    mgr.stopJob(job.id)
    await mgr.shutdownAll()
  }, 10_000)

  it('needs-input é sticky: não dispara múltiplas transições quando o prompt é redesenhado', async () => {
    const mgr = createJobManager()
    // Simula um TUI que imprime a pergunta, depois um spinner, depois a pergunta de novo, em loop.
    // Com o fix sticky, deve haver apenas UMA transição para needs-input.
    const script = `
      process.stdout.write('Do you want to continue?\\n');
      let n = 0;
      const iv = setInterval(() => {
        n++;
        if (n % 2 === 0) process.stdout.write('\\r\\u001b[2K⠋ processing...');
        else process.stdout.write('\\r\\u001b[2KDo you want to continue?');
        if (n > 10) { clearInterval(iv); process.exit(0); }
      }, 200);
    `
    const job = mgr.startJob({
      kind: 'agent',
      label: 'sticky',
      file: 'node',
      args: ['-e', script],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    const statusTransitions: string[] = []
    mgr.subscribe(job.id, (ev) => {
      if (ev.type === 'status') statusTransitions.push(ev.payload.status)
    })
    await new Promise((r) => setTimeout(r, 3500))
    mgr.stopJob(job.id)
    await new Promise((r) => setTimeout(r, 300))
    // Esperado: no máximo 1 needs-input + 1 cancelled ao interromper.
    const needsInputCount = statusTransitions.filter((s) => s === 'needs-input').length
    expect(needsInputCount).toBe(1)
    await mgr.shutdownAll()
  }, 10_000)

  it('writeInput aplica grace period: não re-flaga needs-input durante o grace', async () => {
    const mgr = createJobManager()
    // Script que pede input, recebe qualquer coisa, e imediatamente imprime outra pergunta —
    // mas dentro do grace period de 3s, não deve flagar needs-input de novo.
    const script = `
      process.stdout.write('First question?\\n');
      process.stdin.on('data', () => {
        // imediatamente re-imprime a pergunta (simulando que o Claude ainda está renderizando).
        process.stdout.write('First question?\\n');
        setTimeout(() => process.exit(0), 1500);
      });
    `
    const job = mgr.startJob({
      kind: 'agent',
      label: 'grace',
      file: 'node',
      args: ['-e', script],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    const transitions: string[] = []
    mgr.subscribe(job.id, (ev) => {
      if (ev.type === 'status') transitions.push(ev.payload.status)
    })
    await waitForStatus(mgr, job.id, 'needs-input', 5000)
    // Usuário responde — deve sair de needs-input e entrar em grace.
    mgr.writeInput(job.id, 'yes\r')
    await new Promise((r) => setTimeout(r, 2000))
    // Durante o grace (3s), mesmo com a pergunta re-impressa, não deve virar needs-input de novo.
    const needsInputCount = transitions.filter((s) => s === 'needs-input').length
    expect(needsInputCount).toBe(1)
    mgr.stopJob(job.id)
    await mgr.shutdownAll()
  }, 10_000)

  it('writeInput envia dados para o PTY e a resposta aparece no buffer', async () => {
    const mgr = createJobManager()
    const job = mgr.startJob({
      kind: 'agent',
      label: 'echo-stdin',
      file: 'node',
      args: [
        '-e',
        `let buf = ''; process.stdin.on('data', (d) => { buf += d.toString(); if (buf.includes('\\n')) { process.stdout.write('got:'+buf); process.exit(0); } })`,
      ],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    await new Promise((r) => setTimeout(r, 200))
    expect(mgr.writeInput(job.id, 'abc\r')).toBe(true)
    await waitForStatus(mgr, job.id, 'done', 5000)
    const j = mgr.getJob(job.id)
    expect(j?.buffer).toContain('got:abc')
    await mgr.shutdownAll()
  })

  it('stopJob mata o processo com SIGINT', async () => {
    const mgr = createJobManager()
    const job = mgr.startJob({
      kind: 'agent',
      label: 'sleep',
      file: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    await new Promise((r) => setTimeout(r, 100))
    mgr.stopJob(job.id)
    // Espera até status endedAt definido
    await new Promise((r) => setTimeout(r, 300))
    const j = mgr.getJob(job.id)
    expect(j?.status).toBe('cancelled')
    await mgr.shutdownAll()
  })

  it('buffer respeita o bufferBytesCap (ring buffer)', async () => {
    const mgr = createJobManager()
    const job = mgr.startJob({
      kind: 'agent',
      label: 'spam',
      file: 'node',
      args: [
        '-e',
        `for (let i = 0; i < 5000; i++) { process.stdout.write('x'.repeat(100)+'\\n'); } process.exit(0)`,
      ],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 10_000,
    })
    await waitForStatus(mgr, job.id, 'done', 10000)
    const j = mgr.getJob(job.id)
    expect(j?.buffer.length).toBeLessThanOrEqual(10_000)
    await mgr.shutdownAll()
  }, 15_000)

  it('deleteJob só funciona para jobs terminados', async () => {
    const mgr = createJobManager()
    const runningJob = mgr.startJob({
      kind: 'agent',
      label: 'loop',
      file: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    expect(mgr.deleteJob(runningJob.id)).toBe(false)
    mgr.stopJob(runningJob.id)
    await new Promise((r) => setTimeout(r, 500))
    expect(mgr.deleteJob(runningJob.id)).toBe(true)
    expect(mgr.getJob(runningJob.id)).toBeNull()
    await mgr.shutdownAll()
  })

  it('listJobs retorna os jobs ordenados por startedAt desc', async () => {
    const mgr = createJobManager()
    const j1 = mgr.startJob({
      kind: 'agent',
      label: 'a',
      file: 'node',
      args: ['-e', 'setTimeout(() => process.exit(0), 2000)'],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    await new Promise((r) => setTimeout(r, 50))
    const j2 = mgr.startJob({
      kind: 'agent',
      label: 'b',
      file: 'node',
      args: ['-e', 'setTimeout(() => process.exit(0), 2000)'],
      cwd: process.cwd(),
      promptPatterns: basePatterns,
      bufferBytesCap: 1_000_000,
    })
    const list = mgr.listJobs()
    expect(list[0]?.id).toBe(j2.id)
    expect(list[1]?.id).toBe(j1.id)
    mgr.stopJob(j1.id)
    mgr.stopJob(j2.id)
    await mgr.shutdownAll()
  })
})
