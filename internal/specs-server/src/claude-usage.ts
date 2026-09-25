import { readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const HOUR_MS = 3_600_000
const FIVE_HOURS_MS = 5 * HOUR_MS
const SEVEN_DAYS_MS = 7 * 24 * HOUR_MS

/** Janela de rate limit do plano. `resetsAt` é epoch em **segundos**. */
export type UsageWindow = {
  usedPercentage: number
  resetsAt: number | null
  /** true quando o horário de reset foi deduzido do histórico, não lido direto. */
  resetEstimated: boolean
}

export type UsageSource = 'desktop-history' | 'cli-cache' | 'statusline'

export type ClaudeUsage = {
  fiveHour: UsageWindow | null
  sevenDay: UsageWindow | null
  /** Quando o dado foi medido (epoch ms) — não é o mtime do arquivo. */
  measuredAt: number
  source: UsageSource
}

/**
 * Histórico de uso do plano que o app desktop do Claude grava a cada ~15–25 min
 * enquanto está aberto. Cada amostra tem `t` (epoch ms) e `u.fh` / `u.sd`, as
 * porcentagens das janelas de 5 horas e de 7 dias.
 */
export function desktopHistoryPath(home: string = os.homedir()): string {
  return path.join(home, 'Library', 'Application Support', 'Claude', 'plan-usage-history.json')
}

/**
 * Cache de rate limits do CLI. Em versões recentes do Claude Code ele parou de
 * ser reescrito, então serve só de fallback — e só quando for mais novo que o
 * histórico do desktop.
 */
export function cliCachePath(home: string = os.homedir()): string {
  return path.join(home, '.claude', 'rate-limits-cache.json')
}

/**
 * Snapshot gravado pelo statusLine do Claude Code.
 *
 * É a **única fonte que não depende do app desktop**: o Claude Code entrega
 * `rate_limits.five_hour` e `.seven_day` (percentual e reset) no JSON que manda
 * para o comando de statusLine — mas só para assinantes Pro/Max e só depois da
 * primeira resposta da API na sessão. Não há endpoint da API para consultar isso:
 * a Usage & Cost Admin API exige chave de organização do Console e reporta
 * tokens/custo da API, não a janela do plano.
 *
 * Quem grava o arquivo é `scripts/specs-usage-statusline.sh`, plugado no
 * `statusLine` do usuário. Sem ele, esta fonte simplesmente não existe.
 */
export function statuslineSnapshotPath(home: string = os.homedir()): string {
  return path.join(home, '.claude', 'specs-usage.json')
}

export type UsageSample = { t: number; fh: number; sd: number }

function parseSamples(raw: unknown): UsageSample[] {
  if (typeof raw !== 'object' || raw === null) return []
  const list = (raw as { samples?: unknown }).samples
  if (!Array.isArray(list)) return []
  const out: UsageSample[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const { t, u } = item as { t?: unknown; u?: unknown }
    if (typeof t !== 'number' || !Number.isFinite(t)) continue
    if (typeof u !== 'object' || u === null) continue
    const { fh, sd } = u as { fh?: unknown; sd?: unknown }
    if (typeof fh !== 'number' || typeof sd !== 'number') continue
    out.push({ t, fh, sd })
  }
  return out.sort((a, b) => a.t - b.t)
}

/**
 * Intervalos em que uma queda de porcentagem foi observada. Cada queda significa
 * "o reset aconteceu em algum ponto de `(from, to]`" — e não no instante `to`,
 * já que o app desktop só amostra enquanto está aberto e pode ter ficado dias
 * fechado por cima de um reset.
 */
export function dropIntervals(
  samples: UsageSample[],
  key: 'fh' | 'sd',
): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = []
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1]
    const cur = samples[i]
    if (!prev || !cur) continue
    if (cur[key] < prev[key]) out.push({ from: prev.t, to: cur.t })
  }
  return out
}

/** Horas cheias contidas em `(from, to]`. */
function hourBoundariesIn(from: number, to: number): number[] {
  const out: number[] = []
  let h = Math.floor(from / HOUR_MS) * HOUR_MS + HOUR_MS
  while (h <= to) {
    out.push(h)
    h += HOUR_MS
  }
  return out
}

/**
 * Reset da janela de sessão (5h). Ela **não** tem fase fixa: cada janela começa
 * na primeira mensagem depois de um período ocioso. Então só dá para estimar a
 * partir da última queda observada — e só quando o intervalo dessa queda contém
 * exatamente uma hora cheia, que é onde a Anthropic ancora o início da janela.
 *
 * Devolve null quando a queda é ambígua ou velha demais (o reset calculado já
 * passou ⇒ perdemos janelas no meio e qualquer palpite seria chute).
 */
export function inferSessionReset(samples: UsageSample[], now: number): number | null {
  const drops = dropIntervals(samples, 'fh')
  const last = drops[drops.length - 1]
  if (!last) return null
  if (last.to - last.from > HOUR_MS) return null

  const boundaries = hourBoundariesIn(last.from, last.to)
  const anchor = boundaries.length === 1 ? boundaries[0] : undefined
  if (anchor === undefined) return null

  const reset = anchor + FIVE_HOURS_MS
  return reset > now ? reset : null
}

/**
 * Reset da janela semanal (7d). Essa **é** periódica — cai sempre no mesmo dia e
 * hora — então dá para achar a fase mesmo com o histórico cheio de buracos:
 * testamos cada hora cheia dentro do período e ficamos com a que melhor explica
 * as quedas observadas.
 *
 * Cada queda vale conforme a **estreiteza** do seu intervalo: uma queda flagrada
 * numa janela de 1h praticamente crava a hora do reset, enquanto uma flagrada
 * depois de dias com o app fechado quase não informa nada. Sem esse peso, um
 * punhado de intervalos largos empataria com a evidência boa.
 */
export function inferPeriodicReset(
  samples: UsageSample[],
  key: 'fh' | 'sd',
  periodMs: number,
  now: number,
): number | null {
  const drops = dropIntervals(samples, key)
  const lastDrop = drops[drops.length - 1]
  if (!lastDrop) return null

  const base = Math.floor(lastDrop.to / HOUR_MS) * HOUR_MS
  const slots = Math.round(periodMs / HOUR_MS)
  let best: number | null = null
  let bestScore = -1

  for (let h = 0; h < slots; h += 1) {
    const candidate = base - h * HOUR_MS
    let score = 0
    for (const drop of drops) {
      // Última ocorrência da fase candidata que não passa de `drop.to`.
      const k = Math.floor((drop.to - candidate) / periodMs)
      const instant = candidate + k * periodMs
      if (instant > drop.from && instant <= drop.to) {
        score += HOUR_MS / Math.max(drop.to - drop.from, HOUR_MS)
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  if (best === null || bestScore <= 0) return null

  let reset = best
  while (reset <= now) reset += periodMs
  return reset
}

function windowFrom(percentage: number, resetMs: number | null, estimated: boolean): UsageWindow {
  return {
    usedPercentage: Math.max(0, Math.min(100, percentage)),
    resetsAt: resetMs === null ? null : Math.round(resetMs / 1000),
    resetEstimated: estimated,
  }
}

async function readDesktopHistory(home: string, now: number): Promise<ClaudeUsage | null> {
  try {
    const samples = parseSamples(JSON.parse(await readFile(desktopHistoryPath(home), 'utf8')))
    const latest = samples[samples.length - 1]
    if (!latest) return null
    return {
      fiveHour: windowFrom(latest.fh, inferSessionReset(samples, now), true),
      sevenDay: windowFrom(latest.sd, inferPeriodicReset(samples, 'sd', SEVEN_DAYS_MS, now), true),
      measuredAt: latest.t,
      source: 'desktop-history',
    }
  } catch {
    return null
  }
}

function parseCliWindow(raw: unknown): UsageWindow | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { used_percentage: used, resets_at: resets } = raw as Record<string, unknown>
  if (typeof used !== 'number' || !Number.isFinite(used)) return null
  const resetsAt = typeof resets === 'number' && Number.isFinite(resets) ? resets * 1000 : null
  return windowFrom(used, resetsAt, false)
}

/**
 * Lê o snapshot do statusLine. `measuredAt` vem do próprio arquivo (o instante
 * em que o Claude Code entregou o dado), não do mtime — o script pode reescrever
 * o arquivo sem que os números tenham mudado.
 */
async function readStatuslineSnapshot(home: string): Promise<ClaudeUsage | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(statuslineSnapshotPath(home), 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    const fiveHour = parseCliWindow(record.five_hour)
    const sevenDay = parseCliWindow(record.seven_day)
    if (!fiveHour && !sevenDay) return null
    const measuredAt =
      typeof record.measuredAt === 'number' && Number.isFinite(record.measuredAt)
        ? record.measuredAt
        : 0
    if (measuredAt <= 0) return null
    return { fiveHour, sevenDay, measuredAt, source: 'statusline' }
  } catch {
    return null
  }
}

async function readCliCache(home: string): Promise<ClaudeUsage | null> {
  const file = cliCachePath(home)
  try {
    const [raw, info] = await Promise.all([readFile(file, 'utf8'), stat(file)])
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    const fiveHour = parseCliWindow(record.five_hour)
    const sevenDay = parseCliWindow(record.seven_day)
    if (!fiveHour && !sevenDay) return null
    return { fiveHour, sevenDay, measuredAt: info.mtimeMs, source: 'cli-cache' }
  } catch {
    return null
  }
}

/**
 * Uso do plano do Claude. Lê as três fontes locais possíveis e devolve a **mais
 * recente**, sem preferir nenhuma por natureza: o snapshot do statusLine ganha
 * quando você está usando o Claude Code, o histórico do desktop ganha quando o
 * app está aberto, e o cache do CLI é um fóssil que quase nunca vence.
 *
 * Devolve `null` quando nenhuma existe; é um dado informativo, então nunca lança.
 */
export async function readClaudeUsage(
  home: string = os.homedir(),
  now: number = Date.now(),
): Promise<ClaudeUsage | null> {
  const candidates = await Promise.all([
    readDesktopHistory(home, now),
    readCliCache(home),
    readStatuslineSnapshot(home),
  ])
  let best: ClaudeUsage | null = null
  for (const candidate of candidates) {
    if (!candidate) continue
    if (!best || candidate.measuredAt > best.measuredAt) best = candidate
  }
  return best
}
