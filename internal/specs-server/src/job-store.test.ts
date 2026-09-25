import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  jobStorePath,
  loadJobHistory,
  MAX_PERSISTED_BUFFER,
  MAX_PERSISTED_JOBS,
  reviveJob,
  saveJobHistory,
  type StorableJob,
} from './job-store.js'

function tempProject(): string {
  return mkdtempSync(path.join(tmpdir(), 'specs-jobs-'))
}

function job(over: Partial<StorableJob> = {}): StorableJob {
  return {
    id: 'abc123',
    kind: 'drawing-agent',
    label: 'Desenho: fan-out',
    status: 'done',
    pid: 4242,
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_060_000,
    bufferBytes: 3,
    buffer: 'ok\n',
    lastSeenAt: 1_700_000_060_000,
    ...over,
  }
}

describe('saveJobHistory + loadJobHistory', () => {
  it('grava e relê um job, marcando-o como restaurado', () => {
    const root = tempProject()
    saveJobHistory(root, [job()])
    const [restored] = loadJobHistory(root)
    expect(restored?.id).toBe('abc123')
    expect(restored?.label).toBe('Desenho: fan-out')
    expect(restored?.status).toBe('done')
    expect(restored?.buffer).toBe('ok\n')
    expect(restored?.restored).toBe(true)
  })

  it('devolve lista vazia quando nunca houve histórico', () => {
    expect(loadJobHistory(tempProject())).toEqual([])
  })

  it('um arquivo corrompido custa o histórico, não o boot', () => {
    const root = tempProject()
    saveJobHistory(root, [job()])
    writeFileSync(jobStorePath(root), '{ isso não é json', 'utf8')
    expect(loadJobHistory(root)).toEqual([])
  })

  it('ignora arquivo de versão desconhecida', () => {
    const root = tempProject()
    saveJobHistory(root, [job()])
    writeFileSync(jobStorePath(root), JSON.stringify({ version: 99, jobs: [job()] }), 'utf8')
    expect(loadJobHistory(root)).toEqual([])
  })

  it('mantém só os mais recentes e os devolve em ordem decrescente', () => {
    const root = tempProject()
    const many = Array.from({ length: MAX_PERSISTED_JOBS + 10 }, (_, i) =>
      job({ id: `job-${i}`, startedAt: 1_700_000_000_000 + i * 1000 }),
    )
    saveJobHistory(root, many)
    const loaded = loadJobHistory(root)
    expect(loaded).toHaveLength(MAX_PERSISTED_JOBS)
    expect(loaded[0]?.id).toBe(`job-${MAX_PERSISTED_JOBS + 9}`)
    expect(loaded.some((j) => j.id === 'job-0')).toBe(false)
  })

  it('trunca o buffer, guardando o fim do terminal', () => {
    const root = tempProject()
    const buffer = `${'x'.repeat(MAX_PERSISTED_BUFFER + 500)}FIM`
    saveJobHistory(root, [job({ buffer })])
    const [loaded] = loadJobHistory(root)
    expect(loaded?.buffer.length).toBe(MAX_PERSISTED_BUFFER)
    expect(loaded?.buffer.endsWith('FIM')).toBe(true)
    expect(loaded?.bufferBytes).toBe(MAX_PERSISTED_BUFFER)
  })

  it('a gravação é atômica — não deixa .tmp para trás', () => {
    const root = tempProject()
    saveJobHistory(root, [job()])
    expect(() => readFileSync(`${jobStorePath(root)}.tmp`, 'utf8')).toThrow()
  })
})

describe('reviveJob', () => {
  it('um job que estava rodando volta como cancelado — o processo morreu com o servidor', () => {
    const revived = reviveJob({ ...job({ status: 'running', endedAt: undefined }) })
    expect(revived?.status).toBe('cancelled')
  })

  it('needs-input também volta cancelado: não há mais pty para responder', () => {
    const revived = reviveJob({ ...job({ status: 'needs-input', endedAt: undefined }) })
    expect(revived?.status).toBe('cancelled')
  })

  it('fecha a duração de um job ativo no último sinal de vida', () => {
    const revived = reviveJob({
      ...job({ status: 'running', endedAt: undefined, lastSeenAt: 1_700_000_030_000 }),
    })
    expect(revived?.endedAt).toBe(1_700_000_030_000)
  })

  it('preserva o desfecho de quem já tinha terminado', () => {
    const revived = reviveJob({ ...job({ status: 'failed', exitCode: 2 }) })
    expect(revived?.status).toBe('failed')
    expect(revived?.exitCode).toBe(2)
  })

  it('descarta registro sem os campos que identificam o job', () => {
    expect(reviveJob(null)).toBeNull()
    expect(reviveJob({ label: 'sem id', kind: 'agent', startedAt: 1 })).toBeNull()
    expect(reviveJob({ id: 'x', kind: 'inexistente', label: 'l', startedAt: 1 })).toBeNull()
    expect(reviveJob({ id: 'x', kind: 'agent', label: 'l' })).toBeNull()
  })
})
