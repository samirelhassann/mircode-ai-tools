import { describe, expect, it } from 'vitest'
import { formatAge, formatCountdown, formatDuration, formatStartedAt } from './job-time'

const NOW = new Date(2026, 7, 23, 14, 30, 0).getTime()

describe('formatStartedAt', () => {
  it('mostra "agora" abaixo de um minuto', () => {
    expect(formatStartedAt(NOW - 30_000, NOW)).toBe('agora')
  })

  it('mostra minutos relativos dentro da última hora', () => {
    expect(formatStartedAt(NOW - 25 * 60_000, NOW)).toBe('há 25 min')
  })

  it('mostra o horário quando é do mesmo dia', () => {
    expect(formatStartedAt(new Date(2026, 7, 23, 9, 5).getTime(), NOW)).toBe('hoje 09:05')
  })

  it('mostra "ontem" com horário', () => {
    expect(formatStartedAt(new Date(2026, 7, 22, 23, 40).getTime(), NOW)).toBe('ontem 23:40')
  })

  it('mostra dia/mês para execuções mais antigas', () => {
    expect(formatStartedAt(new Date(2026, 6, 4, 8, 0).getTime(), NOW)).toBe('04/07 08:00')
  })
})

describe('formatAge', () => {
  const NOW = new Date(2026, 8, 1, 22, 30).getTime()

  it('abaixo de um minuto é "agora"', () => {
    expect(formatAge(NOW - 30_000, NOW)).toBe('agora')
  })

  it('minutos dentro da primeira hora', () => {
    expect(formatAge(NOW - 25 * 60_000, NOW)).toBe('há 25 min')
  })

  it('horas dentro do dia', () => {
    expect(formatAge(NOW - 5 * 3_600_000, NOW)).toBe('há 5h')
  })

  it('singular no primeiro dia', () => {
    expect(formatAge(NOW - 26 * 3_600_000, NOW)).toBe('há 1 dia')
  })

  it('dias — o caso que "23/08 22:53" escondia', () => {
    expect(formatAge(new Date(2026, 7, 23, 22, 53).getTime(), NOW)).toBe('há 8 dias')
  })
})

describe('formatDuration', () => {
  it('formata segundos', () => {
    expect(formatDuration(NOW - 42_000, NOW, NOW)).toBe('42s')
  })

  it('formata minutos e segundos', () => {
    expect(formatDuration(NOW - 125_000, NOW, NOW)).toBe('2m 5s')
  })

  it('formata horas e minutos', () => {
    expect(formatDuration(NOW - 3 * 3_600_000 - 15 * 60_000, NOW, NOW)).toBe('3h 15m')
  })

  it('usa `now` quando a execução ainda está em curso', () => {
    expect(formatDuration(NOW - 10_000, undefined, NOW)).toBe('10s')
  })
})

describe('formatCountdown', () => {
  it('mostra minutos na última hora', () => {
    expect(formatCountdown(NOW + 34 * 60_000, NOW)).toBe('34 min')
  })

  it('nunca mostra "0 min" enquanto ainda falta tempo', () => {
    expect(formatCountdown(NOW + 20_000, NOW)).toBe('1 min')
  })

  it('mostra horas e minutos dentro do dia', () => {
    expect(formatCountdown(NOW + 2 * 3_600_000 + 14 * 60_000, NOW)).toBe('2h 14min')
  })

  it('omite os minutos quando são zero', () => {
    expect(formatCountdown(NOW + 3 * 3_600_000, NOW)).toBe('3h')
  })

  it('mostra dias e horas acima de 24h', () => {
    expect(formatCountdown(NOW + 3 * 86_400_000 + 4 * 3_600_000, NOW)).toBe('3d 4h')
  })

  it('mostra "agora" quando o reset já passou', () => {
    expect(formatCountdown(NOW - 1000, NOW)).toBe('agora')
  })
})
