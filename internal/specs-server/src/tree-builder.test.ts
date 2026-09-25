import { describe, expect, it } from 'vitest'
import { aggregateStatus } from './tree-builder.js'

describe('aggregateStatus', () => {
  it('retorna pending para array vazio', () => {
    expect(aggregateStatus([])).toBe('pending')
  })

  it('retorna completed quando todas completed', () => {
    expect(aggregateStatus(['completed', 'completed'])).toBe('completed')
  })

  it('retorna blocked se alguma blocked', () => {
    expect(aggregateStatus(['completed', 'blocked', 'pending'])).toBe('blocked')
  })

  it('retorna in-progress com mix de in-progress/completed', () => {
    expect(aggregateStatus(['in-progress', 'completed'])).toBe('in-progress')
    expect(aggregateStatus(['in-progress', 'pending'])).toBe('in-progress')
    expect(aggregateStatus(['completed', 'pending'])).toBe('in-progress')
  })

  it('retorna pending quando todas pending', () => {
    expect(aggregateStatus(['pending', 'pending'])).toBe('pending')
  })
})
