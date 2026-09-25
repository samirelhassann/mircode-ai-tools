import { describe, expect, it } from 'vitest'
import { extractHeadings } from './headings.js'

describe('extractHeadings', () => {
  it('extrai h1..h6 com IDs', () => {
    const md = '# Título\n\n## Escopo\n\nparagrafo\n\n### Item 1\n'
    const headings = extractHeadings(md)
    expect(headings).toEqual([
      { id: 'título', text: 'Título', level: 1 },
      { id: 'escopo', text: 'Escopo', level: 2 },
      { id: 'item-1', text: 'Item 1', level: 3 },
    ])
  })

  it('ignora linhas dentro de code fences', () => {
    const md = '# A\n\n```\n# fake heading\n```\n\n## B\n'
    const headings = extractHeadings(md)
    expect(headings.map((h) => h.text)).toEqual(['A', 'B'])
  })

  it('desambigua ids duplicados', () => {
    const md = '## Escopo\n\n## Escopo\n'
    const headings = extractHeadings(md)
    expect(headings[0]!.id).toBe('escopo')
    expect(headings[1]!.id).toBe('escopo-1')
  })
})
