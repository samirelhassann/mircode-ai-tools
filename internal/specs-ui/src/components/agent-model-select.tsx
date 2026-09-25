import { useMemo } from 'react'
import { useAgentModels } from '@/hooks/use-agent-model'
import { Select, type SelectOption } from '@/components/ui/select'
import { PowerBar } from '@/components/ui/power-bar'
import { Badge } from '@/components/ui/badge'
import {
  activePromo,
  compareModels,
  contextFromLabel,
  EFFORT_LABEL,
  formatPricing,
  formatPromoDeadline,
  formatPromoPricing,
  type ModelFamily,
  parseModelId,
  tierOf,
} from '@/lib/model-catalog'

type Props = {
  cli: string
  value: string | undefined
  onChange: (model: string | undefined) => void
  hideLabel?: boolean
  className?: string
}

const DEFAULT_VALUE = '__default__'

type Variant = { key: string; tone: 'success' | 'accent' | 'neutral' | 'warning'; text: string }

/** Preço cheio riscado + preço promocional em destaque, com a data limite. */
function PricingLine({ family }: { family: ModelFamily }) {
  const full = formatPricing(family)
  const promo = activePromo(family)
  if (!full) return <>{family.vendor}</>
  if (!promo) return <>{full}</>
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <s className="text-[var(--text-muted)]">{full}</s>
      <span className="font-semibold text-[var(--status-completed)]">
        {formatPromoPricing(promo)} por MTok
      </span>
      <span className="text-[var(--text-muted)]">até {formatPromoDeadline(promo)}</span>
    </span>
  )
}

/**
 * Seletor de modelo da CLI, do mais leve ao mais capaz, com barra de potência,
 * custo por milhão de tokens, janela de contexto e selos de variante (esforço,
 * thinking, fast, promoção vigente). A lista vem de `/api/agent-models` — no
 * Cursor são ~200 ids, então o select entra em modo busca.
 */
export function AgentModelSelect({ cli, value, onChange, hideLabel, className }: Props) {
  const { data, isLoading, isError } = useAgentModels(cli)
  const models = useMemo(() => data?.models ?? [], [data])

  const options = useMemo<SelectOption[]>(() => {
    const sorted = [...models].sort((a, b) => compareModels(a.id, b.id))
    return [
      {
        value: DEFAULT_VALUE,
        label: 'Padrão da CLI',
        description: 'Usa o modelo que a CLI já escolhe sozinha.',
      },
      ...sorted.map((model) => {
        const { family, effort, thinking, fast } = parseModelId(model.id)
        const promo = family ? activePromo(family) : null
        const tier = tierOf(model.id)
        // O label da CLI é mais confiável que o catálogo para contexto: é o
        // próprio fornecedor declarando ("Opus 5 1M Thinking").
        const context = contextFromLabel(model.label) ?? family?.context ?? null
        const variants = [
          promo ? { key: 'promo', tone: 'success' as const, text: 'promo' } : null,
          effort ? { key: 'effort', tone: 'accent' as const, text: EFFORT_LABEL[effort] } : null,
          thinking ? { key: 'thinking', tone: 'neutral' as const, text: 'thinking' } : null,
          fast ? { key: 'fast', tone: 'warning' as const, text: 'fast' } : null,
        ].filter((v): v is Variant => v !== null)

        return {
          value: model.id,
          label: family ? family.displayName : model.label,
          description: family ? <PricingLine family={family} /> : model.id,
          meta: context ? `${context} ctx` : undefined,
          indicator: tier >= 1 && tier <= 4 ? <PowerBar level={tier} /> : undefined,
          badge: variants.length ? (
            <span className="flex shrink-0 items-center gap-1">
              {variants.map((v) => (
                <Badge key={v.key} tone={v.tone}>
                  {v.text}
                </Badge>
              ))}
            </span>
          ) : undefined,
          keywords: `${model.id} ${model.label} ${family?.vendor ?? ''}`,
        }
      }),
    ]
  }, [models])

  if (!isLoading && !isError && models.length === 0) return null

  const effectiveValue = value && models.some((m) => m.id === value) ? value : DEFAULT_VALUE

  return (
    <Select
      className={className}
      label={hideLabel ? undefined : 'Modelo'}
      aria-label="Modelo"
      value={effectiveValue}
      onChange={(next) => onChange(next === DEFAULT_VALUE ? undefined : next)}
      options={isLoading ? [{ value: DEFAULT_VALUE, label: 'Carregando modelos…' }] : options}
      disabled={isLoading}
      searchable={options.length > 8}
      searchPlaceholder="Buscar modelo…"
      hint={
        isError
          ? 'Não foi possível listar modelos — verifique se a CLI está instalada. Usando o padrão.'
          : data?.source === 'static'
            ? 'Do mais leve ao mais capaz. Preço por milhão de tokens (entrada / saída).'
            : // No Cursor o consumo sai do plano, não da API Anthropic: o preço
              // listado serve só para comparar o peso relativo dos modelos.
              'Do mais leve ao mais capaz. Preço é o da API Anthropic, referência — no Cursor o consumo segue o seu plano.'
      }
    />
  )
}
