import { describe, expect, it } from 'vitest'
import { parseFrontmatter, patchStatusInFrontmatter } from './frontmatter.js'

describe('parseFrontmatter', () => {
  it('extrai data e body', () => {
    const raw = '---\ntitle: "X"\nstatus: pending\n---\n# Hello\n\nbody'
    const parsed = parseFrontmatter(raw)
    expect(parsed.data.title).toBe('X')
    expect(parsed.data.status).toBe('pending')
    expect(parsed.body.trim().startsWith('# Hello')).toBe(true)
  })
})

describe('patchStatusInFrontmatter', () => {
  it('substitui status preservando o resto', () => {
    const raw = '---\ntitle: "X"\ndescription: "Y"\nstatus: pending\n---\n# Hello\n'
    const next = patchStatusInFrontmatter(raw, 'in-progress')
    expect(next).toBe('---\ntitle: "X"\ndescription: "Y"\nstatus: in-progress\n---\n# Hello\n')
  })

  it('preserva CRLF', () => {
    const raw = '---\r\ntitle: "X"\r\nstatus: pending\r\n---\r\n# Hello\r\n'
    const next = patchStatusInFrontmatter(raw, 'completed')
    expect(next).toContain('status: completed')
    expect(next.startsWith('---\r\n')).toBe(true)
    expect(next.includes('\r\n# Hello\r\n')).toBe(true)
  })

  it('insere status quando ausente', () => {
    const raw = '---\ntitle: "X"\n---\n# Hello\n'
    const next = patchStatusInFrontmatter(raw, 'blocked')
    expect(next).toContain('status: blocked')
  })

  it('idempotência: status igual resulta no mesmo conteúdo', () => {
    const raw = '---\nstatus: pending\n---\nbody\n'
    expect(patchStatusInFrontmatter(raw, 'pending')).toBe(raw)
  })

  it('não toca conteúdo fora do frontmatter', () => {
    const raw = '---\nstatus: pending\n---\n# status: fake in body\n'
    const next = patchStatusInFrontmatter(raw, 'in-progress')
    expect(next).toContain('# status: fake in body')
    expect(next.split('\n')[1]).toBe('status: in-progress')
  })

  it('retorna inalterado se não há frontmatter', () => {
    const raw = '# Only body\n'
    expect(patchStatusInFrontmatter(raw, 'in-progress')).toBe(raw)
  })
})
