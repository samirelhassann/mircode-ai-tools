const MINUTE = 60_000
const HOUR = 60 * MINUTE

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function clock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Rótulo de quando a execução começou, do ponto de vista de `now`.
 * A lista de Execuções é ordenada por data desc, então o rótulo só precisa
 * situar o item — não precisa ser preciso ao segundo.
 */
export function formatStartedAt(startedAt: number, now: number = Date.now()): string {
  const diff = now - startedAt
  if (diff < MINUTE) return 'agora'
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`

  const started = new Date(startedAt)
  const today = startOfDay(new Date(now))
  const day = startOfDay(started)

  if (day === today) return `hoje ${clock(started)}`
  if (today - day === 86_400_000) return `ontem ${clock(started)}`
  return `${pad(started.getDate())}/${pad(started.getMonth() + 1)} ${clock(started)}`
}

/**
 * Há quanto tempo algo aconteceu, em texto. Diferente de `formatStartedAt`, que
 * situa o item numa lista ordenada: aqui a **idade** é a informação — "23/08
 * 22:53" passa por horário recente à primeira vista, "há 9 dias" não passa.
 */
export function formatAge(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  if (diff < MINUTE) return 'agora'
  const minutes = Math.floor(diff / MINUTE)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(diff / HOUR)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}

/** Duração legível de uma execução (em curso quando `end` é undefined). */
export function formatDuration(start: number, end?: number, now: number = Date.now()): string {
  const ms = Math.max(0, (end ?? now) - start)
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/**
 * Quanto falta até `targetMs`. Usado no reset das janelas de rate limit, então
 * a precisão cai conforme a distância aumenta: minutos na última hora, horas no
 * dia, dias depois disso.
 */
export function formatCountdown(targetMs: number, now: number = Date.now()): string {
  const ms = targetMs - now
  if (ms <= 0) return 'agora'
  const minutes = Math.floor(ms / MINUTE)
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rm = minutes % 60
    return rm > 0 ? `${hours}h ${rm}min` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const rh = hours % 24
  return rh > 0 ? `${days}d ${rh}h` : `${days}d`
}
