import { mkdir, mkdtemp, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cliCachePath,
  desktopHistoryPath,
  inferPeriodicReset,
  inferSessionReset,
  readClaudeUsage,
  statuslineSnapshotPath,
  type UsageSample,
} from './claude-usage.js'

const HOUR = 3_600_000

/**
 * `cliMtime` (epoch ms) permite reproduzir o cenário real: o cache do CLI parou
 * de ser reescrito e está meses atrás do histórico do desktop. Sem ele o mtime
 * seria "agora", o que nunca acontece em produção.
 */
async function fakeHome(
  files: { desktop?: string; cli?: string; cliMtime?: number; statusline?: string } = {},
): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'specs-usage-'))
  if (files.desktop !== undefined) {
    await mkdir(path.dirname(desktopHistoryPath(home)), { recursive: true })
    await writeFile(desktopHistoryPath(home), files.desktop, 'utf8')
  }
  if (files.cli !== undefined) {
    await mkdir(path.dirname(cliCachePath(home)), { recursive: true })
    await writeFile(cliCachePath(home), files.cli, 'utf8')
    if (files.cliMtime !== undefined) {
      const seconds = files.cliMtime / 1000
      await utimes(cliCachePath(home), seconds, seconds)
    }
  }
  if (files.statusline !== undefined) {
    await mkdir(path.dirname(statuslineSnapshotPath(home)), { recursive: true })
    await writeFile(statuslineSnapshotPath(home), files.statusline, 'utf8')
  }
  return home
}

function history(samples: UsageSample[]): string {
  return JSON.stringify({
    version: 2,
    samples: samples.map((s) => ({ t: s.t, u: { fh: s.fh, sd: s.sd } })),
  })
}

describe('inferSessionReset', () => {
  const now = new Date(2026, 7, 23, 20, 45, 0).getTime()

  it('ancora na hora cheia dentro do intervalo da queda', () => {
    // Cenário real: 39% às 16:56, 4% às 17:11 ⇒ a janela virou às 17:00.
    const samples: UsageSample[] = [
      { t: new Date(2026, 7, 23, 16, 56).getTime(), fh: 39, sd: 5 },
      { t: new Date(2026, 7, 23, 17, 11).getTime(), fh: 4, sd: 5 },
      { t: new Date(2026, 7, 23, 20, 38).getTime(), fh: 13, sd: 5 },
    ]
    expect(inferSessionReset(samples, now)).toBe(new Date(2026, 7, 23, 22, 0).getTime())
  })

  it('desiste quando o intervalo da queda é largo demais para pinar a hora', () => {
    // App fechado por dias: a queda só diz "resetou em algum momento aí".
    const samples: UsageSample[] = [
      { t: new Date(2026, 7, 15, 17, 8).getTime(), fh: 53, sd: 16 },
      { t: new Date(2026, 7, 23, 13, 2).getTime(), fh: 11, sd: 2 },
    ]
    expect(inferSessionReset(samples, now)).toBeNull()
  })

  it('desiste quando o intervalo não contém nenhuma hora cheia', () => {
    const samples: UsageSample[] = [
      { t: new Date(2026, 7, 23, 17, 5).getTime(), fh: 39, sd: 5 },
      { t: new Date(2026, 7, 23, 17, 40).getTime(), fh: 4, sd: 5 },
    ]
    expect(inferSessionReset(samples, now)).toBeNull()
  })

  it('desiste quando o reset calculado já passou (janelas perdidas no meio)', () => {
    const samples: UsageSample[] = [
      { t: new Date(2026, 7, 23, 5, 50).getTime(), fh: 30, sd: 5 },
      { t: new Date(2026, 7, 23, 6, 5).getTime(), fh: 0, sd: 5 },
    ]
    expect(inferSessionReset(samples, now)).toBeNull()
  })

  it('devolve null sem nenhuma queda no histórico', () => {
    const samples: UsageSample[] = [
      { t: now - 2 * HOUR, fh: 3, sd: 5 },
      { t: now - HOUR, fh: 9, sd: 5 },
    ]
    expect(inferSessionReset(samples, now)).toBeNull()
  })
})

describe('inferPeriodicReset', () => {
  const now = new Date(2026, 7, 23, 20, 45, 0).getTime()
  const SEVEN_DAYS = 7 * 24 * HOUR

  /**
   * Intervalos reais extraídos de um `plan-usage-history.json`: quedas semanais
   * flagradas em sáb 25/07 13:56, sáb 01/08 16:20, sáb 15/08 17:08 e dom 23/08
   * 13:02 — esta última com um dia de atraso, porque o app ficou fechado por
   * cima do reset de sáb 22/08. Só a primeira (intervalo de 60 min) crava a
   * hora; as outras são largas e apenas precisam ser compatíveis.
   * A única fase que explica todas é **sábado 13:00**.
   */
  const weekly: UsageSample[] = [
    { t: new Date(2026, 6, 25, 12, 55).getTime(), fh: 1, sd: 31 },
    { t: new Date(2026, 6, 25, 13, 56).getTime(), fh: 1, sd: 0 },
    { t: new Date(2026, 7, 1, 9, 29).getTime(), fh: 1, sd: 44 },
    { t: new Date(2026, 7, 1, 16, 20).getTime(), fh: 1, sd: 0 },
    { t: new Date(2026, 7, 15, 2, 34).getTime(), fh: 1, sd: 53 },
    { t: new Date(2026, 7, 15, 17, 8).getTime(), fh: 1, sd: 0 },
    { t: new Date(2026, 7, 18, 20, 2).getTime(), fh: 1, sd: 16 },
    { t: new Date(2026, 7, 23, 13, 2).getTime(), fh: 1, sd: 2 },
  ]

  it('acha a fase semanal mesmo com uma queda observada com 1 dia de atraso', () => {
    expect(inferPeriodicReset(weekly, 'sd', SEVEN_DAYS, now)).toBe(
      new Date(2026, 7, 29, 13, 0).getTime(),
    )
  })

  it('sempre devolve um reset no futuro', () => {
    const reset = inferPeriodicReset(weekly, 'sd', SEVEN_DAYS, now)
    expect(reset ?? 0).toBeGreaterThan(now)
  })

  it('deixa a queda de intervalo estreito mandar sobre as largas', () => {
    // Uma única queda cravada às 13:00 vale mais que duas de intervalo largo
    // que também seriam compatíveis com 20:00.
    const samples: UsageSample[] = [
      { t: new Date(2026, 6, 25, 12, 55).getTime(), fh: 1, sd: 31 },
      { t: new Date(2026, 6, 25, 13, 56).getTime(), fh: 1, sd: 0 },
      { t: new Date(2026, 7, 1, 2, 0).getTime(), fh: 1, sd: 40 },
      { t: new Date(2026, 7, 1, 23, 0).getTime(), fh: 1, sd: 0 },
      { t: new Date(2026, 7, 8, 2, 0).getTime(), fh: 1, sd: 40 },
      { t: new Date(2026, 7, 8, 23, 0).getTime(), fh: 1, sd: 0 },
    ]
    expect(inferPeriodicReset(samples, 'sd', SEVEN_DAYS, now)).toBe(
      new Date(2026, 7, 29, 13, 0).getTime(),
    )
  })

  it('devolve null sem quedas', () => {
    expect(inferPeriodicReset([{ t: now, fh: 1, sd: 5 }], 'sd', SEVEN_DAYS, now)).toBeNull()
  })
})

describe('readClaudeUsage', () => {
  const now = new Date(2026, 7, 23, 20, 45, 0).getTime()

  it('lê a última amostra do histórico do desktop', async () => {
    const home = await fakeHome({
      desktop: history([
        { t: now - 4 * HOUR, fh: 39, sd: 5 },
        { t: now - 3 * HOUR, fh: 4, sd: 5 },
        { t: now - 10 * 60_000, fh: 13, sd: 5 },
      ]),
    })
    const usage = await readClaudeUsage(home, now)
    expect(usage?.source).toBe('desktop-history')
    expect(usage?.fiveHour?.usedPercentage).toBe(13)
    expect(usage?.sevenDay?.usedPercentage).toBe(5)
    expect(usage?.fiveHour?.resetEstimated).toBe(true)
    expect(usage?.measuredAt).toBe(now - 10 * 60_000)
  })

  it('usa o snapshot do statusLine quando ele é o mais recente', async () => {
    const home = await fakeHome({
      desktop: history([{ t: now - 9 * 24 * HOUR, fh: 3, sd: 6 }]),
      statusline: JSON.stringify({
        measuredAt: now - 60_000,
        five_hour: { used_percentage: 18, resets_at: Math.round((now + HOUR) / 1000) },
        seven_day: { used_percentage: 2, resets_at: Math.round((now + 5 * 24 * HOUR) / 1000) },
      }),
    })
    const usage = await readClaudeUsage(home, now)
    expect(usage?.source).toBe('statusline')
    expect(usage?.fiveHour?.usedPercentage).toBe(18)
    expect(usage?.sevenDay?.usedPercentage).toBe(2)
    // Vem do próprio Claude Code, não é estimado como o do histórico do desktop.
    expect(usage?.fiveHour?.resetEstimated).toBe(false)
    expect(usage?.measuredAt).toBe(now - 60_000)
  })

  it('um snapshot velho perde para um histórico de desktop mais novo', async () => {
    const home = await fakeHome({
      desktop: history([{ t: now - 5 * 60_000, fh: 40, sd: 7 }]),
      statusline: JSON.stringify({
        measuredAt: now - 3 * HOUR,
        five_hour: { used_percentage: 18 },
      }),
    })
    expect((await readClaudeUsage(home, now))?.source).toBe('desktop-history')
  })

  it('snapshot sem measuredAt é descartado — não dá para saber se ainda vale', async () => {
    const home = await fakeHome({
      statusline: JSON.stringify({ five_hour: { used_percentage: 18 } }),
    })
    expect(await readClaudeUsage(home, now)).toBeNull()
  })

  it('snapshot sem nenhuma janela é descartado', async () => {
    const home = await fakeHome({ statusline: JSON.stringify({ measuredAt: now }) })
    expect(await readClaudeUsage(home, now)).toBeNull()
  })

  it('snapshot corrompido não derruba a leitura das outras fontes', async () => {
    const home = await fakeHome({
      desktop: history([{ t: now - 60_000, fh: 11, sd: 4 }]),
      statusline: '{ isso não é json',
    })
    expect((await readClaudeUsage(home, now))?.source).toBe('desktop-history')
  })

  it('ordena amostras fora de ordem antes de pegar a última', async () => {
    const home = await fakeHome({
      desktop: history([
        { t: now - 60_000, fh: 13, sd: 5 },
        { t: now - 5 * HOUR, fh: 39, sd: 5 },
      ]),
    })
    expect((await readClaudeUsage(home, now))?.fiveHour?.usedPercentage).toBe(13)
  })

  it('cai para o cache do CLI quando não há histórico do desktop', async () => {
    const home = await fakeHome({
      cli: JSON.stringify({
        five_hour: { used_percentage: 42, resets_at: 1774062000 },
        seven_day: { used_percentage: 7, resets_at: 1774314000 },
      }),
    })
    const usage = await readClaudeUsage(home, now)
    expect(usage?.source).toBe('cli-cache')
    expect(usage?.fiveHour).toEqual({
      usedPercentage: 42,
      resetsAt: 1774062000,
      resetEstimated: false,
    })
  })

  it('prefere o histórico do desktop quando o cache do CLI está velho', async () => {
    const home = await fakeHome({
      desktop: history([{ t: now - 60_000, fh: 13, sd: 5 }]),
      cli: JSON.stringify({ five_hour: { used_percentage: 2, resets_at: 1 } }),
      cliMtime: now - 150 * 24 * HOUR,
    })
    const usage = await readClaudeUsage(home, now)
    expect(usage?.source).toBe('desktop-history')
    expect(usage?.fiveHour?.usedPercentage).toBe(13)
  })

  it('prefere o cache do CLI quando ele é o dado mais novo', async () => {
    const home = await fakeHome({
      desktop: history([{ t: now - 6 * HOUR, fh: 13, sd: 5 }]),
      cli: JSON.stringify({ five_hour: { used_percentage: 2, resets_at: 1774062000 } }),
      cliMtime: now - 60_000,
    })
    const usage = await readClaudeUsage(home, now)
    expect(usage?.source).toBe('cli-cache')
    expect(usage?.fiveHour?.usedPercentage).toBe(2)
  })

  it('trava a porcentagem em 0–100', async () => {
    const home = await fakeHome({ desktop: history([{ t: now, fh: 140, sd: -3 }]) })
    const usage = await readClaudeUsage(home, now)
    expect(usage?.fiveHour?.usedPercentage).toBe(100)
    expect(usage?.sevenDay?.usedPercentage).toBe(0)
  })

  it('devolve null quando nenhuma fonte existe', async () => {
    expect(await readClaudeUsage(await fakeHome(), now)).toBeNull()
  })

  it('devolve null em JSON inválido', async () => {
    expect(await readClaudeUsage(await fakeHome({ desktop: '{ nope' }), now)).toBeNull()
  })
})
