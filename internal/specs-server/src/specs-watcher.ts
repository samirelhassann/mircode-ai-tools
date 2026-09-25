import { watch, type FSWatcher } from 'node:fs'
import path from 'node:path'

/**
 * Mudança observada no disco, já traduzida para "o que a UI precisa reinvalidar".
 * O watcher não sabe nada de react-query — só descreve o que mudou.
 */
export type SpecsChangeEvent =
  | { type: 'tree' }
  | { type: 'content'; feature: string; task: string }
  | { type: 'discovery'; slug: string }
  | { type: 'drawing'; slug: string }
  | { type: 'config' }
  | { type: 'usage' }

export type ClassifyDirs = {
  /** Relativo ao projectRoot, ex.: `.specs/specs`. */
  featuresDir: string
  /** Relativo ao projectRoot, ex.: `.specs/discoveries`. */
  discoveriesDir: string
  /** Relativo ao projectRoot, ex.: `.specs/drawings`. */
  drawingsDir: string
}

function segments(relPath: string): string[] {
  return relPath.split(path.sep).filter((s) => s.length > 0 && s !== '.')
}

function isUnder(relPath: string, dir: string): string | null {
  const base = segments(dir)
  const parts = segments(relPath)
  if (parts.length <= base.length) return null
  for (let i = 0; i < base.length; i += 1) {
    if (parts[i] !== base[i]) return null
  }
  return parts.slice(base.length).join('/')
}

/**
 * Traduz um caminho (relativo ao projectRoot) nos eventos que ele implica.
 *
 * Um `.md` de task gera **dois** eventos: o conteúdo em si e a árvore — porque o
 * frontmatter carrega título e status, que aparecem na sidebar. Arquivos que não
 * interessam (`.DS_Store`, temporários de editor, qualquer coisa fora de
 * `.specs/`) devolvem lista vazia.
 */
export function classifyPath(relPath: string, dirs: ClassifyDirs): SpecsChangeEvent[] {
  const normalized = relPath.split(path.sep).join('/')
  const name = normalized.split('/').pop() ?? ''
  if (name.startsWith('.') || name.endsWith('~')) return []

  if (normalized === '.specs/config.json') return [{ type: 'config' }]

  const inFeatures = isUnder(relPath, dirs.featuresDir)
  if (inFeatures !== null) {
    const parts = inFeatures.split('/')
    if (parts.length === 1 && parts[0] === 'meta.json') return [{ type: 'tree' }]
    const [feature, file] = parts
    if (!feature || !file || parts.length !== 2) return [{ type: 'tree' }]
    if (file === 'meta.json') return [{ type: 'tree' }]
    if (file.endsWith('.md')) {
      const task = file.slice(0, -3)
      return [{ type: 'content', feature, task }, { type: 'tree' }]
    }
    return []
  }

  const inDiscoveries = isUnder(relPath, dirs.discoveriesDir)
  if (inDiscoveries !== null) {
    const parts = inDiscoveries.split('/')
    if (parts.length !== 1) return []
    const file = parts[0] ?? ''
    if (file === 'meta.json') return [{ type: 'tree' }]
    if (file.endsWith('.md')) {
      return [{ type: 'discovery', slug: file.slice(0, -3) }, { type: 'tree' }]
    }
    return []
  }

  const inDrawings = isUnder(relPath, dirs.drawingsDir)
  if (inDrawings !== null) {
    const parts = inDrawings.split('/')
    if (parts.length !== 1) return []
    const file = parts[0] ?? ''
    if (file === 'meta.json') return [{ type: 'tree' }]
    if (file.endsWith('.md')) {
      return [{ type: 'drawing', slug: file.slice(0, -3) }, { type: 'tree' }]
    }
    return []
  }

  return []
}

/** Chave estável de um evento, para deduplicar dentro da janela de debounce. */
export function eventKey(event: SpecsChangeEvent): string {
  switch (event.type) {
    case 'content':
      return `content:${event.feature}/${event.task}`
    case 'discovery':
      return `discovery:${event.slug}`
    case 'drawing':
      return `drawing:${event.slug}`
    default:
      return event.type
  }
}

export type SpecsWatcher = {
  subscribe: (listener: (events: SpecsChangeEvent[]) => void) => () => void
  /** false quando o SO não suporta watch recursivo — a UI cai para polling. */
  readonly watching: boolean
  close: () => void
}

export type WatcherOptions = ClassifyDirs & {
  projectRoot: string
  /** Arquivos avulsos fora do projeto (ex.: histórico de uso do Claude). */
  extraFiles?: Array<{ file: string; event: SpecsChangeEvent }>
  debounceMs?: number
}

/** Intervalo entre tentativas de (re)armar o watch de um arquivo avulso. */
const REARM_RETRY_MS = 5_000

/**
 * Observa um arquivo único de forma resiliente a saves atômicos.
 *
 * `fs.watch` prende o inode do arquivo. Quando o processo dono grava num `.tmp`
 * e renomeia por cima — o padrão de save atômico — o inode muda: o evento do
 * rename ainda chega, mas todas as escritas seguintes passam despercebidas. Por
 * isso re-armamos o watch depois de cada evento. Se o arquivo não existir (ainda
 * ou durante a janela do rename), tentamos de novo periodicamente.
 *
 * Devolve a função que encerra o watch.
 */
export function watchFileRearming(file: string, onChange: () => void): () => void {
  let current: FSWatcher | null = null
  let retry: NodeJS.Timeout | null = null
  let stopped = false

  function scheduleRetry() {
    if (stopped || retry) return
    retry = setTimeout(() => {
      retry = null
      arm()
    }, REARM_RETRY_MS)
    retry.unref?.()
  }

  function arm() {
    if (stopped) return
    try {
      current = watch(file, { persistent: false }, () => {
        onChange()
        // Re-arma no *caminho*: se foi um rename, o watch atual está morto.
        try {
          current?.close()
        } catch {}
        current = null
        arm()
      })
    } catch {
      current = null
      scheduleRetry()
    }
  }

  arm()

  return () => {
    stopped = true
    if (retry) clearTimeout(retry)
    try {
      current?.close()
    } catch {}
    current = null
  }
}

/**
 * Observa `.specs/` (e arquivos avulsos) e emite lotes de eventos com debounce.
 *
 * Um agent editando um `.md` dispara vários eventos de `fs.watch` em sequência
 * (write, rename do arquivo temporário, chmod); o debounce junta tudo num lote
 * só, deduplicado, para a UI invalidar cada query uma única vez.
 */
export function createSpecsWatcher(opts: WatcherOptions): SpecsWatcher {
  const {
    projectRoot,
    featuresDir,
    discoveriesDir,
    drawingsDir,
    extraFiles = [],
    debounceMs = 150,
  } = opts
  const listeners = new Set<(events: SpecsChangeEvent[]) => void>()
  const watchers: FSWatcher[] = []
  const fileWatchers: Array<() => void> = []
  const pending = new Map<string, SpecsChangeEvent>()
  let timer: NodeJS.Timeout | null = null
  let watching = false

  function flush() {
    timer = null
    if (pending.size === 0) return
    const batch = [...pending.values()]
    pending.clear()
    for (const listener of listeners) listener(batch)
  }

  function queue(events: SpecsChangeEvent[]) {
    if (events.length === 0) return
    for (const event of events) pending.set(eventKey(event), event)
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  }

  const specsRoot = path.join(projectRoot, '.specs')
  try {
    // `recursive` cobre macOS e Windows nativamente e Linux a partir do Node 20.
    // Se o SO não suportar, o catch abaixo deixa `watching` em false e a UI faz
    // polling — nunca fica sem atualizar.
    watchers.push(
      watch(specsRoot, { recursive: true, persistent: false }, (_event, filename) => {
        if (!filename) return
        const rel = path.join('.specs', filename.toString())
        queue(classifyPath(rel, { featuresDir, discoveriesDir, drawingsDir }))
      }),
    )
    watching = true
  } catch {
    watching = false
  }

  // Arquivos avulsos precisam de um watch que se re-arma. `fs.watch` prende o
  // inode, e um save atômico (grava num .tmp e renomeia por cima) troca o inode:
  // o evento do rename chega, mas todas as escritas seguintes ficam invisíveis.
  // O arquivo também pode ainda não existir quando o servidor sobe.
  for (const { file, event } of extraFiles) {
    fileWatchers.push(watchFileRearming(file, () => queue([event])))
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get watching() {
      return watching
    },
    close() {
      if (timer) clearTimeout(timer)
      for (const w of watchers) {
        try {
          w.close()
        } catch {}
      }
      for (const stop of fileWatchers) stop()
      listeners.clear()
    },
  }
}
