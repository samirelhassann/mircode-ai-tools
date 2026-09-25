import type { AgentEffort } from '@/lib/types'
import { Select, type SelectOption } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EFFORT_LABEL, parseModelId } from '@/lib/model-catalog'

type Props = {
  value: AgentEffort | undefined
  onChange: (effort: AgentEffort | undefined) => void
  /** CLI ativa — muda a dica, porque o cursor-agent aplica o esforço no modelo. */
  cli: string
  /** Id do modelo escolhido — vários ids do cursor já fixam o esforço no nome. */
  model: string | undefined
  hideLabel?: boolean
  className?: string
}

const DEFAULT_VALUE = '__default__'

/** Do mais barato ao mais caro — mesma direção do seletor de modelo. */
const EFFORT_OPTIONS: Array<{ value: AgentEffort; label: string; description: string }> = [
  {
    value: 'low',
    label: 'Low',
    description: 'Tarefas curtas e escopadas; prioriza latência.',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Reduz tokens trocando um pouco de profundidade.',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Equilíbrio entre custo e capacidade.',
  },
  {
    value: 'xhigh',
    label: 'xHigh',
    description: 'Melhor para código e trabalho agêntico.',
  },
  {
    value: 'max',
    label: 'Max',
    description: 'Correção acima de custo; pode superpensar tarefa simples.',
  },
]

/** Nível que cada CLI usa quando nada é passado — vira o selo "padrão". */
const CLI_DEFAULT: Record<string, AgentEffort | undefined> = {
  claude: 'xhigh',
}

/** O `auto` do Cursor delega a escolha do modelo, então não aceita parâmetro. */
const NON_PARAMETERIZABLE = new Set(['auto'])

/**
 * Seletor de esforço de raciocínio. No Claude Code vira a flag `--effort
 * <nível>`; no cursor-agent, parâmetro do próprio modelo — a CLI documenta
 * `claude-opus-4-8[context=1m,effort=high,fast=false]` —, o que só funciona com
 * um modelo parametrizável escolhido.
 */
export function AgentEffortSelect({ value, onChange, cli, model, hideLabel, className }: Props) {
  const usesModelParam = cli === 'cursor'
  // Presets como `claude-opus-5-thinking-xhigh` já carregam o nível no nome;
  // passar outro por parâmetro só criaria conflito.
  const builtInEffort = model ? parseModelId(model).effort : null
  const notParameterizable = Boolean(model && NON_PARAMETERIZABLE.has(model))
  const needsModel = usesModelParam && !model
  const unavailable = needsModel || notParameterizable || Boolean(builtInEffort)
  const cliDefault = CLI_DEFAULT[cli]

  const options: SelectOption[] = [
    {
      value: DEFAULT_VALUE,
      label: 'Padrão da CLI',
      description: cliDefault
        ? `Não passa nível; o Claude Code usa ${EFFORT_LABEL[cliDefault]}.`
        : 'Não passa nível de esforço; a CLI decide.',
    },
    ...EFFORT_OPTIONS.map((opt) => ({
      ...opt,
      badge:
        opt.value === cliDefault ? (
          <Badge tone="accent" title="Nível que esta CLI já usa por padrão">
            padrão
          </Badge>
        ) : undefined,
    })),
  ]

  return (
    <Select
      className={className}
      label={hideLabel ? undefined : 'Esforço'}
      aria-label="Nível de esforço"
      value={unavailable ? DEFAULT_VALUE : (value ?? DEFAULT_VALUE)}
      onChange={(next) => onChange(next === DEFAULT_VALUE ? undefined : (next as AgentEffort))}
      options={options}
      disabled={unavailable}
      hint={
        builtInEffort
          ? `O modelo escolhido já fixa o esforço em ${EFFORT_LABEL[builtInEffort]}.`
          : notParameterizable
            ? 'O modelo Auto escolhe sozinho e não aceita parâmetro de esforço.'
            : needsModel
              ? 'No cursor-agent o esforço viaja junto do modelo — escolha um modelo para habilitar.'
              : usesModelParam
                ? 'Vai como parâmetro do modelo: modelo[effort=…].'
                : 'Vai como flag do Claude Code: --effort <nível>.'
      }
    />
  )
}
