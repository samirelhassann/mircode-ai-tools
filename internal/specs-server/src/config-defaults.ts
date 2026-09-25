import type { PrototypeConfig, SpecsConfig } from './types.js'

export const DEFAULT_INPUT_PROMPT_PATTERNS: string[] = [
  '\\?\\s*$',
  '\\((?:y\\/n|Y\\/n|y\\/N|Y\\/N)\\)',
  'press\\s+(?:enter|any key)',
  'Do you want to',
  'Would you like to',
  'waiting for input',
  '❯\\s*$',
]

export const DEFAULT_REVIEW_OPEN_COMMAND = 'cursor --goto {path}:{line}'

export const DEFAULT_CLAUDE_COMMAND = 'claude {model} {effort} --agent feature-runner "{prompt}"'
export const DEFAULT_CURSOR_COMMAND =
  'cursor-agent {model} "Use the feature-runner subagent. {prompt}"'

/** Comando para listar modelos dinamicamente, por CLI. */
export const DEFAULT_MODELS_COMMAND: Record<string, string> = {
  cursor: 'cursor-agent --list-models',
}

/**
 * Lista estática de modelos por CLI. O Claude Code não expõe listagem via CLI,
 * então usamos os aliases oficiais (`--model <alias>`). Pode ser sobrescrita ou
 * estendida no `.specs/config.json`.
 */
export const DEFAULT_STATIC_MODELS: Record<string, string[]> = {
  claude: ['opus', 'sonnet', 'haiku', 'fable'],
}

/** Comando de abertura local do protótipo, por ferramenta. `{file}` e `{url}` são expandidos. */
export const DEFAULT_PROTOTYPE_OPEN_COMMAND: Record<string, string> = {
  pencil: 'open -a Pencil {file}',
  'claude-design': 'open {url}',
}

/**
 * Normaliza o bloco `prototype`. Descarta declarações sem `tool` conhecida ou
 * sem o alvo que a ferramenta exige (`url` no Claude Design, `file` no Pencil) —
 * um protótipo meio declarado só geraria botão quebrado na UI.
 */
export function normalizePrototype(raw: unknown): PrototypeConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<PrototypeConfig>
  if (p.tool !== 'claude-design' && p.tool !== 'pencil') return null
  if (p.tool === 'claude-design' && !p.url) return null
  if (p.tool === 'pencil' && !p.file) return null
  return {
    tool: p.tool,
    ...(p.title ? { title: p.title } : {}),
    ...(p.url ? { url: p.url } : {}),
    ...(p.file ? { file: p.file } : {}),
    ...(p.designDir ? { designDir: p.designDir } : {}),
    ...(Array.isArray(p.artboards) ? { artboards: p.artboards.map(String) } : {}),
    ...(Array.isArray(p.nodeIds) ? { nodeIds: p.nodeIds.map(String) } : {}),
    ...(p.openCommand ? { openCommand: p.openCommand } : {}),
    ...(p.snapshot ? { snapshot: p.snapshot } : {}),
  }
}

export function applyDefaults(partial: Partial<SpecsConfig>): SpecsConfig {
  const agent = partial.agent ?? ({} as Partial<SpecsConfig['agent']>)
  const scopes = agent.scopes ?? ({} as Partial<SpecsConfig['agent']['scopes']>)

  // `commands` define um template por CLI. Para retrocompat, se o usuário só tem
  // o legado `agent.command`, ele vira o template do `claude`. Os defaults de
  // claude/cursor sempre existem (a menos que o usuário sobrescreva).
  const userCommands = agent.commands ?? {}
  const commands: Record<string, string> = {
    claude: userCommands.claude ?? agent.command ?? DEFAULT_CLAUDE_COMMAND,
    cursor: userCommands.cursor ?? DEFAULT_CURSOR_COMMAND,
    ...userCommands,
  }
  const cli = agent.cli && commands[agent.cli] ? agent.cli : 'claude'

  const modelsCommand: Record<string, string> = {
    ...DEFAULT_MODELS_COMMAND,
    ...(agent.modelsCommand ?? {}),
  }
  const models: Record<string, string[]> = {
    ...DEFAULT_STATIC_MODELS,
    ...(agent.models ?? {}),
  }

  return {
    agent: {
      cli,
      commands,
      modelsCommand,
      models,
      command: agent.command ?? commands[cli] ?? DEFAULT_CLAUDE_COMMAND,
      openTerminal: agent.openTerminal ?? (process.platform === 'darwin' ? 'osascript' : 'none'),
      cwd: agent.cwd ?? '.',
      scopes: {
        feature:
          scopes.feature ??
          'Execute a feature "{featureTitle}" ({featurePath}). Se houver task em progresso, continue de onde parou; senão, escolha a próxima task em pages[] do meta.json.',
        featureNoPause:
          scopes.featureNoPause ??
          'Execute a feature "{featureTitle}" ({featurePath}) por inteiro, sem pausar entre tasks. Continue executando cada próxima task pendente do meta.json automaticamente até completar todas. Os testes E2E e a solicitação de code review devem ser feitos apenas ao final de todas as tasks.',
        task:
          scopes.task ??
          'Execute a task {featurePath}{task}.md. Se já houver trabalho em progresso nela, continue de onde parou.',
      },
      defaultExecutionMode: agent.defaultExecutionMode ?? 'inline',
      sound: agent.sound ?? true,
      inputPromptPatterns:
        agent.inputPromptPatterns && agent.inputPromptPatterns.length > 0
          ? agent.inputPromptPatterns
          : DEFAULT_INPUT_PROMPT_PATTERNS,
      bufferBytesCap: agent.bufferBytesCap ?? 2_000_000,
    },
    prototype: normalizePrototype(partial.prototype),
    review: {
      openCommand: partial.review?.openCommand ?? DEFAULT_REVIEW_OPEN_COMMAND,
    },
    theme: 'dark',
    warnBelowWidth: partial.warnBelowWidth ?? 1024,
    featuresDir: partial.featuresDir ?? '.specs/specs',
    discoveriesDir: partial.discoveriesDir ?? '.specs/discoveries',
    drawingsDir: partial.drawingsDir ?? '.specs/drawings',
    port: partial.port ?? 4321,
  }
}
