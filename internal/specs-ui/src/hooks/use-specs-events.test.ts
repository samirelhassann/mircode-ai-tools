import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { invalidateFor } from './use-specs-events'

function spyClient() {
  const qc = new QueryClient()
  const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined)
  return { qc, keys: () => spy.mock.calls.map((c) => c[0]?.queryKey) }
}

describe('invalidateFor', () => {
  it('árvore invalida só a árvore', () => {
    const { qc, keys } = spyClient()
    invalidateFor(qc, { type: 'tree' })
    expect(keys()).toEqual([['tree']])
  })

  it('conteúdo invalida exatamente aquela task', () => {
    const { qc, keys } = spyClient()
    invalidateFor(qc, { type: 'content', feature: 'f', task: 't' })
    expect(keys()).toEqual([['content', 'f', 't']])
  })

  it('discovery invalida aquele slug', () => {
    const { qc, keys } = spyClient()
    invalidateFor(qc, { type: 'discovery', slug: 'spike-cache' })
    expect(keys()).toEqual([['discovery-content', 'spike-cache']])
  })

  it('config arrasta o protótipo junto, que é declarado dentro dele', () => {
    const { qc, keys } = spyClient()
    invalidateFor(qc, { type: 'config' })
    expect(keys()).toEqual([['config'], ['prototype']])
  })

  it('uso invalida o medidor', () => {
    const { qc, keys } = spyClient()
    invalidateFor(qc, { type: 'usage' })
    expect(keys()).toEqual([['usage']])
  })
})
