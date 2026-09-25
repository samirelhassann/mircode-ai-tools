/**
 * Metadados dos modelos exibidos no seletor: família, força relativa, janela de
 * contexto e preço por milhão de tokens.
 *
 * O Claude Code expõe poucos aliases (`opus`, `sonnet`…), mas o `cursor-agent`
 * lista ~200 ids que são a mesma família com variações no fim do nome —
 * `claude-opus-5-thinking-xhigh-fast` é o Opus 5 com esforço extra-alto,
 * thinking e roteamento rápido. Por isso o resolvedor descasca esses sufixos
 * antes de procurar a família, em vez de exigir uma entrada por id.
 *
 * Preços: catálogo oficial Claude (verificado em 24/06/2026). Modelos de outros
 * fornecedores aparecem sem preço — a CLI do Cursor não publica tabela.
 */

export type ModelPricing = {
  inputPerMTok: number
  outputPerMTok: number
  /** Preço promocional com validade — só é exibido enquanto estiver vigente. */
  promo?: {
    inputPerMTok: number
    outputPerMTok: number
    /** Último dia da promoção, em ISO (`AAAA-MM-DD`). */
    until: string
  }
}

export type ModelFamily = {
  /** Ordem do mais leve (1) ao mais capaz (4) — define a ordenação da lista. */
  tier: number
  displayName: string
  /**
   * Janela de contexto formatada (`1M`, `200K`). Só é preenchida para modelos
   * do catálogo oficial Claude; para o resto, o valor vem do label da própria
   * CLI (ver `contextFromLabel`) em vez de ser estimado aqui.
   */
  context?: string
  vendor: string
  /** Só para modelos do catálogo oficial Claude — o resto não publica tabela. */
  pricing?: ModelPricing
}

/** Nível de esforço embutido no próprio id, como o cursor-agent expõe. */
export type ModelEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type ModelVariant = {
  /** Id sem sufixos de variante — a chave usada para achar a família. */
  base: string
  family: ModelFamily | null
  effort: ModelEffort | null
  thinking: boolean
  /** Roteamento prioritário do Cursor (sufixo `-fast`). */
  fast: boolean
}

const ANTHROPIC = 'Anthropic'

const HAIKU_45: ModelFamily = {
  tier: 1,
  displayName: 'Haiku 4.5',
  context: '200K',
  vendor: ANTHROPIC,
  pricing: { inputPerMTok: 1, outputPerMTok: 5 },
}

const SONNET_5: ModelFamily = {
  tier: 2,
  displayName: 'Sonnet 5',
  context: '1M',
  vendor: ANTHROPIC,
  pricing: {
    inputPerMTok: 3,
    outputPerMTok: 15,
    promo: { inputPerMTok: 2, outputPerMTok: 10, until: '2026-08-31' },
  },
}

const SONNET_46: ModelFamily = {
  tier: 2,
  displayName: 'Sonnet 4.6',
  context: '1M',
  vendor: ANTHROPIC,
  pricing: { inputPerMTok: 3, outputPerMTok: 15 },
}

// Geração anterior: fora do catálogo oficial atual, então sem preço declarado.
const SONNET_45: ModelFamily = { tier: 2, displayName: 'Sonnet 4.5', vendor: ANTHROPIC }

const SONNET_4: ModelFamily = { tier: 2, displayName: 'Sonnet 4', vendor: ANTHROPIC }

const OPUS_5: ModelFamily = {
  tier: 3,
  displayName: 'Opus 5',
  context: '1M',
  vendor: ANTHROPIC,
  pricing: { inputPerMTok: 5, outputPerMTok: 25 },
}

const OPUS_48: ModelFamily = {
  tier: 3,
  displayName: 'Opus 4.8',
  context: '1M',
  vendor: ANTHROPIC,
  pricing: { inputPerMTok: 5, outputPerMTok: 25 },
}

const OPUS_47: ModelFamily = {
  tier: 3,
  displayName: 'Opus 4.7',
  context: '1M',
  vendor: ANTHROPIC,
  pricing: { inputPerMTok: 5, outputPerMTok: 25 },
}

const OPUS_46: ModelFamily = {
  tier: 3,
  displayName: 'Opus 4.6',
  context: '1M',
  vendor: ANTHROPIC,
  pricing: { inputPerMTok: 5, outputPerMTok: 25 },
}

const OPUS_45: ModelFamily = { tier: 3, displayName: 'Opus 4.5', vendor: ANTHROPIC }

const FABLE_5: ModelFamily = {
  tier: 4,
  displayName: 'Fable 5',
  context: '1M',
  vendor: ANTHROPIC,
  pricing: { inputPerMTok: 10, outputPerMTok: 50 },
}

const OPENAI = 'OpenAI'
const GOOGLE = 'Google'
const XAI = 'xAI'

/**
 * Fornecedores fora da Anthropic: só família e força relativa. Preço e janela
 * de contexto ficam de fora — a CLI do Cursor não publica tabela e chutar aqui
 * seria pior do que não mostrar. O contexto que aparece na lista é o que o
 * próprio label da CLI declara.
 */
function other(tier: number, displayName: string, vendor: string): ModelFamily {
  return { tier, displayName, vendor }
}

const FAMILIES: Record<string, ModelFamily> = {
  // Anthropic — aliases do Claude Code e ids do cursor-agent
  haiku: HAIKU_45,
  'claude-haiku-4-5': HAIKU_45,
  sonnet: SONNET_5,
  'claude-sonnet-5': SONNET_5,
  'claude-sonnet-4-6': SONNET_46,
  'claude-4.6-sonnet': SONNET_46,
  'claude-4.5-sonnet': SONNET_45,
  'claude-4-sonnet': SONNET_4,
  opus: OPUS_5,
  'claude-opus-5': OPUS_5,
  'claude-opus-4-8': OPUS_48,
  'claude-opus-4-7': OPUS_47,
  'claude-4.6-opus': OPUS_46,
  'claude-4.5-opus': OPUS_45,
  fable: FABLE_5,
  'claude-fable-5': FABLE_5,

  // OpenAI
  'gpt-5.6-sol': other(3, 'GPT-5.6 Sol', OPENAI),
  'gpt-5.6-luna': other(3, 'GPT-5.6 Luna', OPENAI),
  'gpt-5.6-terra': other(3, 'GPT-5.6 Terra', OPENAI),
  'gpt-5.5': other(2, 'GPT-5.5', OPENAI),
  'gpt-5.4': other(2, 'GPT-5.4', OPENAI),
  'gpt-5.4-mini': other(1, 'GPT-5.4 Mini', OPENAI),
  'gpt-5.4-nano': other(1, 'GPT-5.4 Nano', OPENAI),
  'gpt-5.3-codex': other(2, 'Codex 5.3', OPENAI),
  'gpt-5.2': other(2, 'GPT-5.2', OPENAI),
  'gpt-5.1': other(2, 'GPT-5.1', OPENAI),
  'gpt-5-mini': other(1, 'GPT-5 Mini', OPENAI),

  // xAI
  'cursor-grok-4.6': other(2, 'Grok 4.6', XAI),
  'cursor-grok-4.5': other(2, 'Grok 4.5', XAI),

  // Google
  'gemini-3.7-flash': other(1, 'Gemini 3.7 Flash', GOOGLE),
  'gemini-3.6-flash': other(1, 'Gemini 3.6 Flash', GOOGLE),
  'gemini-3.5-flash': other(1, 'Gemini 3.5 Flash', GOOGLE),
  'gemini-3-flash': other(1, 'Gemini 3 Flash', GOOGLE),
  'gemini-3.1-pro': other(2, 'Gemini 3.1 Pro', GOOGLE),

  // Cursor e outros
  'composer-2.5': other(1, 'Composer 2.5', 'Cursor'),
  'kimi-k3': other(1, 'Kimi K3', 'Moonshot'),
  auto: other(0, 'Auto', 'Cursor'),
}

const EFFORT_SUFFIX: Array<[RegExp, ModelEffort]> = [
  [/-extra-high$/, 'xhigh'],
  [/-xhigh$/, 'xhigh'],
  [/-minimal$/, 'minimal'],
  [/-none$/, 'none'],
  [/-low$/, 'low'],
  [/-medium$/, 'medium'],
  [/-high$/, 'high'],
  [/-max$/, 'max'],
]

const EFFORT_RANK: Record<ModelEffort, number> = {
  none: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  max: 6,
}

export const EFFORT_LABEL: Record<ModelEffort, string> = {
  none: 'sem esforço',
  minimal: 'mínimo',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
}

/** Família pelo nome, para ids que nem o descascamento resolve. */
const FAMILY_TIER: Array<[RegExp, number]> = [
  [/haiku|mini|nano|flash|composer|kimi/i, 1],
  [/sonnet|grok|gpt-5\.[1-5]|gemini/i, 2],
  [/opus|gpt-5\.6/i, 3],
  [/fable|mythos/i, 4],
]

/**
 * Descasca os sufixos de variante (`-fast`, `-thinking`, nível de esforço) até
 * sobrar o id da família. A ordem dos sufixos varia entre gerações do Cursor
 * (`…-thinking-high` e `…-high-thinking` convivem), por isso o laço tenta os
 * três a cada volta em vez de assumir uma sequência fixa.
 */
export function parseModelId(id: string): ModelVariant {
  let base = (id.split('[')[0] ?? id).trim().toLowerCase()
  let effort: ModelEffort | null = null
  let thinking = false
  let fast = false

  for (;;) {
    if (FAMILIES[base]) break

    if (base.endsWith('-fast')) {
      fast = true
      base = base.slice(0, -'-fast'.length)
      continue
    }
    if (base.endsWith('-thinking')) {
      thinking = true
      base = base.slice(0, -'-thinking'.length)
      continue
    }
    const match = EFFORT_SUFFIX.find(([re]) => re.test(base))
    if (match && !effort) {
      effort = match[1]
      base = base.replace(match[0], '')
      continue
    }
    break
  }

  return { base, family: FAMILIES[base] ?? null, effort, thinking, fast }
}

/**
 * Janela de contexto declarada no label que a própria CLI devolve — o
 * `cursor-agent` escreve "Opus 5 1M Thinking", "GPT-5.6 Sol 1M Max". É a única
 * fonte confiável de contexto para modelos fora do catálogo Claude.
 */
export function contextFromLabel(label: string): string | null {
  const match = label.match(/\b(\d+(?:\.\d+)?)\s*([MK])\b/)
  return match ? `${match[1]}${match[2]}` : null
}

/** Metadados da família por trás de um id, ou `null` se não reconhecida. */
export function resolveModelInfo(id: string): ModelFamily | null {
  return parseModelId(id).family
}

/**
 * Força relativa do modelo (1 = mais leve). Cai na família pelo nome quando o
 * id não é reconhecido; 99 para o que não dá para classificar.
 */
export function tierOf(id: string): number {
  const { family, base } = parseModelId(id)
  if (family) return family.tier
  const guess = FAMILY_TIER.find(([re]) => re.test(base))
  return guess ? guess[1] : 99
}

/**
 * Ordem do mais leve ao mais capaz. Dentro da mesma força, agrupa por família e
 * ordena as variantes por esforço — assim as dez linhas de um mesmo modelo
 * ficam juntas e em progressão, em vez de espalhadas em ordem alfabética.
 */
export function compareModels(a: string, b: string): number {
  const byTier = tierOf(a) - tierOf(b)
  if (byTier !== 0) return byTier

  const va = parseModelId(a)
  const vb = parseModelId(b)

  const byVendor = (va.family?.vendor ?? 'zzz').localeCompare(vb.family?.vendor ?? 'zzz')
  if (byVendor !== 0) return byVendor

  const byFamily = (va.family?.displayName ?? va.base).localeCompare(
    vb.family?.displayName ?? vb.base,
  )
  if (byFamily !== 0) return byFamily

  const byEffort =
    (va.effort ? EFFORT_RANK[va.effort] : -1) - (vb.effort ? EFFORT_RANK[vb.effort] : -1)
  if (byEffort !== 0) return byEffort

  const byThinking = Number(va.thinking) - Number(vb.thinking)
  if (byThinking !== 0) return byThinking

  const byFast = Number(va.fast) - Number(vb.fast)
  if (byFast !== 0) return byFast

  return a.localeCompare(b)
}

/** Promoção vigente hoje, se houver. Vencida = como se não existisse. */
export function activePromo(
  family: ModelFamily,
  now: Date = new Date(),
): ModelPricing['promo'] | null {
  const promo = family.pricing?.promo
  if (!promo) return null
  const [year, month, day] = promo.until.split('-').map(Number)
  if (!year || !month || !day) return null
  const lastDay = new Date(year, month - 1, day, 23, 59, 59, 999)
  return now <= lastDay ? promo : null
}

function money(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

/** "US$ 5 / 25 por MTok" — entrada / saída, sempre no preço cheio. */
export function formatPricing(family: ModelFamily): string | null {
  if (!family.pricing) return null
  return `US$ ${money(family.pricing.inputPerMTok)} / ${money(family.pricing.outputPerMTok)} por MTok`
}

/** "US$ 2 / 10" — só os números do preço promocional. */
export function formatPromoPricing(promo: NonNullable<ModelPricing['promo']>): string {
  return `US$ ${money(promo.inputPerMTok)} / ${money(promo.outputPerMTok)}`
}

/** "31/08" — dia e mês do fim da promoção. */
export function formatPromoDeadline(promo: NonNullable<ModelPricing['promo']>): string {
  const [, month, day] = promo.until.split('-')
  return `${day}/${month}`
}
