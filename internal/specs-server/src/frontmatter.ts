import matter from 'gray-matter'
import type { DiscoveryType, DrawingType, Status } from './types.js'
import { detectEOL } from './fs-utils.js'

const VALID_STATUS: readonly Status[] = ['pending', 'in-progress', 'completed', 'blocked']

export function isValidStatus(s: unknown): s is Status {
  return typeof s === 'string' && (VALID_STATUS as readonly string[]).includes(s)
}

const VALID_DISCOVERY_TYPE: readonly DiscoveryType[] = ['rfc', 'spike', 'adr', 'note']

export function isValidDiscoveryType(s: unknown): s is DiscoveryType {
  return typeof s === 'string' && (VALID_DISCOVERY_TYPE as readonly string[]).includes(s)
}

const VALID_DRAWING_TYPE: readonly DrawingType[] = [
  'architecture',
  'flow',
  'sequence',
  'data',
  'state',
]

export function isValidDrawingType(s: unknown): s is DrawingType {
  return typeof s === 'string' && (VALID_DRAWING_TYPE as readonly string[]).includes(s)
}

/**
 * Normaliza a data do frontmatter. YAML sem aspas (`date: 2026-09-01`) chega
 * aqui como `Date`, não como string — sem esta conversão o campo some da
 * resposta e o badge de data nunca aparece.
 */
export function toIsoDate(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return undefined
}

export type ParsedFrontmatter = {
  data: Record<string, unknown>
  body: string
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const parsed = matter(raw)
  return { data: parsed.data as Record<string, unknown>, body: parsed.content }
}

/**
 * Reescreve apenas a linha `status:` dentro do bloco frontmatter YAML, preservando
 * todo o resto byte a byte (ordem de chaves, comentários, aspas, EOL).
 *
 * Regras:
 * - Se o arquivo não tem frontmatter (`---\n...\n---`), retorna o conteúdo inalterado.
 * - Se o bloco YAML tem linha `status: xxx`, substitui pelo novo valor.
 * - Se não tem, insere `status: <value>` antes do `---` de fechamento.
 * - EOL original é preservado (LF ou CRLF).
 */
export function patchStatusInFrontmatter(raw: string, newStatus: Status): string {
  const eol = detectEOL(raw)
  const leading = raw.slice(0, 4)
  if (!leading.startsWith('---')) return raw

  // encontra o bloco frontmatter
  // separator: --- + EOL no início; --- + EOL no final do bloco
  const startIdx = raw.indexOf(`---${eol}`)
  if (startIdx !== 0) return raw

  const afterStart = raw.slice(3 + eol.length)
  const endIdx = afterStart.indexOf(`${eol}---`)
  if (endIdx < 0) return raw

  const yamlBlock = afterStart.slice(0, endIdx)
  const rest = afterStart.slice(endIdx) // inclui EOL + '---'

  const statusLineRegex = /^status:[ \t]*.*$/m
  let newYaml: string
  if (statusLineRegex.test(yamlBlock)) {
    newYaml = yamlBlock.replace(statusLineRegex, `status: ${newStatus}`)
  } else {
    // insere ao final do bloco YAML (antes do EOL de fechamento)
    const trimmedEnd = yamlBlock.endsWith(eol) ? yamlBlock : `${yamlBlock}${eol}`
    newYaml = `${trimmedEnd}status: ${newStatus}`
  }

  return `---${eol}${newYaml}${rest}`
}

export function extractFrontmatterFields(data: Record<string, unknown>): {
  title?: string
  description?: string
  status: Status
} {
  const title = typeof data.title === 'string' ? data.title : undefined
  const description = typeof data.description === 'string' ? data.description : undefined
  const rawStatus = data.status
  const status: Status = isValidStatus(rawStatus) ? rawStatus : 'pending'
  return { title, description, status }
}

export function extractDiscoveryFrontmatterFields(data: Record<string, unknown>): {
  title?: string
  type: DiscoveryType
  date?: string
} {
  const title = typeof data.title === 'string' ? data.title : undefined
  const rawType = data.type
  const type: DiscoveryType = isValidDiscoveryType(rawType) ? rawType : 'note'
  const date = toIsoDate(data.date)
  return { title, type, date }
}

export function extractDrawingFrontmatterFields(data: Record<string, unknown>): {
  title?: string
  type: DrawingType
  date?: string
} {
  const title = typeof data.title === 'string' ? data.title : undefined
  const rawType = data.type
  // Sem `type` válido cai em `architecture`: é o desenho mais comum e um badge
  // errado é menos ruim do que um desenho invisível na lista.
  const type: DrawingType = isValidDrawingType(rawType) ? rawType : 'architecture'
  const date = toIsoDate(data.date)
  return { title, type, date }
}
