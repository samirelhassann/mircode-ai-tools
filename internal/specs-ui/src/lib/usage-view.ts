import type { UsageWindow } from './types'

/**
 * O app desktop do Claude grava uma amostra a cada ~15–25 min enquanto está
 * aberto. Passando bem disso, a medida provavelmente já não vale: a janela pode
 * ter virado, o consumo pode ter subido, e não temos como saber.
 */
export const STALE_AFTER_MS = 45 * 60_000

export function isStale(measuredAt: number, now: number): boolean {
  return now - measuredAt > STALE_AFTER_MS
}

/**
 * A partir daqui a medida deixa de ser "velha" e passa a ser inútil: a janela de
 * 5h virou várias vezes e a de 7 dias pode ter resetado. Mostrar a porcentagem
 * esmaecida ainda dá a entender que ela significa alguma coisa — a leitura
 * honesta é não mostrar número nenhum.
 */
export const EXPIRED_AFTER_MS = 12 * 60 * 60_000

export function isExpired(measuredAt: number, now: number): boolean {
  return now - measuredAt > EXPIRED_AFTER_MS
}

/**
 * Estado da janela de sessão. Ela não fica contando o tempo todo: depois de um
 * reset, só volta a correr quando você manda a próxima mensagem — é o
 * "Starts when a message is sent" que o próprio Claude mostra. Sem consumo e sem
 * reset conhecido, não há countdown para exibir.
 */
export type WindowState = 'idle' | 'running' | 'unknown'

export function sessionState(win: UsageWindow, stale: boolean): WindowState {
  if (stale) return 'unknown'
  if (win.usedPercentage === 0) return 'idle'
  return 'running'
}
