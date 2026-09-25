import { describe, expect, it } from 'vitest'
import { EXPIRED_AFTER_MS, isExpired, isStale, sessionState, STALE_AFTER_MS } from './usage-view'
import type { UsageWindow } from './types'

const NOW = new Date(2026, 7, 23, 22, 34).getTime()
const win = (usedPercentage: number, resetsAt: number | null = null): UsageWindow => ({
  usedPercentage,
  resetsAt,
  resetEstimated: true,
})

describe('isStale', () => {
  it('uma amostra recém-gravada é fresca', () => {
    expect(isStale(NOW - 5 * 60_000, NOW)).toBe(false)
  })

  it('aguenta o intervalo normal do app desktop (~25 min)', () => {
    expect(isStale(NOW - 25 * 60_000, NOW)).toBe(false)
  })

  it('56 min sem amostra é velho — foi exatamente o caso que enganou a tela', () => {
    expect(isStale(NOW - 56 * 60_000, NOW)).toBe(true)
  })

  it('a fronteira é o limiar declarado', () => {
    expect(isStale(NOW - STALE_AFTER_MS, NOW)).toBe(false)
    expect(isStale(NOW - STALE_AFTER_MS - 1, NOW)).toBe(true)
  })
})

describe('isExpired', () => {
  it('uma medida velha mas do mesmo turno ainda não expirou', () => {
    expect(isExpired(NOW - 3 * 60 * 60_000, NOW)).toBe(false)
  })

  it('a fronteira é o limiar declarado', () => {
    expect(isExpired(NOW - EXPIRED_AFTER_MS, NOW)).toBe(false)
    expect(isExpired(NOW - EXPIRED_AFTER_MS - 1, NOW)).toBe(true)
  })

  it('nove dias sem o app desktop aberto expira — foi o caso real', () => {
    expect(isExpired(NOW - 9 * 24 * 60 * 60_000, NOW)).toBe(true)
  })
})

describe('sessionState', () => {
  it('0% com dado fresco = janela parada, esperando a próxima mensagem', () => {
    expect(sessionState(win(0), false)).toBe('idle')
  })

  it('com consumo, a janela está correndo', () => {
    expect(sessionState(win(19), false)).toBe('running')
  })

  it('dado velho não permite afirmar nada sobre a janela', () => {
    expect(sessionState(win(19), true)).toBe('unknown')
    expect(sessionState(win(0), true)).toBe('unknown')
  })
})
