import { spawn } from 'node:child_process'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import type {
  AgentCli,
  AgentEffort,
  AgentModel,
  AgentScopeKey,
  SpecsConfig,
  TerminalKind,
} from './types.js'

type RunAgentInput = {
  scope: AgentScopeKey
  feature: string
  task?: string
  cli?: AgentCli
  model?: string
  effort?: AgentEffort
}

/**
 * Resolve o template de comando para a CLI escolhida. Cai no `commands[cli]`,
 * depois no comando padrão da config, garantindo retrocompat com configs antigas
 * que só tinham `agent.command`.
 */
export function resolveCommand(config: SpecsConfig, cli?: AgentCli): string {
  const key = cli && config.agent.commands?.[cli] ? cli : config.agent.cli
  return config.agent.commands?.[key] ?? config.agent.command
}

/**
 * Injeta a flag de modelo no template. Se houver `{model}`, substitui (por
 * `--model <id>` ou vazio). Sem placeholder, insere a flag logo após o binário.
 * `quote` controla o escaping (identidade p/ argv inline, shellQuote p/ shell).
 */
export function injectModel(
  template: string,
  model: string | undefined,
  quote: (s: string) => string,
): string {
  const flag = model ? `--model ${quote(model)}` : ''
  if (template.includes('{model}')) return template.replaceAll('{model}', flag)
  if (!flag) return template
  return template.replace(/^(\s*\S+)/, `$1 ${flag}`)
}

/**
 * Como cada CLI recebe o nível de esforço. O Claude Code tem a flag `--effort`;
 * o cursor-agent expõe o esforço como parâmetro entre colchetes do próprio
 * modelo (`claude-opus-4-8[effort=high]`), então lá ele só se aplica quando há
 * um modelo escolhido.
 */
const EFFORT_MODE: Record<string, 'flag' | 'model-param'> = {
  claude: 'flag',
  cursor: 'model-param',
}

function effortMode(cli: string | undefined): 'flag' | 'model-param' {
  return EFFORT_MODE[cli ?? 'claude'] ?? 'flag'
}

/**
 * Acrescenta `[effort=<nível>]` ao id do modelo (sintaxe do cursor-agent),
 * preservando os parâmetros que já estiverem entre colchetes.
 */
export function withEffortParam(model: string, effort: AgentEffort): string {
  if (/\[.*effort=/.test(model)) return model
  const match = /^([^[]+)\[(.+)\]$/.exec(model)
  if (match) return `${match[1]}[${match[2]},effort=${effort}]`
  return `${model}[effort=${effort}]`
}

/**
 * Injeta o nível de esforço no template. Com `{effort}`, substitui; sem o
 * placeholder, insere a flag logo após o binário — mesmo contrato do modelo,
 * para não quebrar configs antigas.
 */
export function injectEffort(
  template: string,
  effort: AgentEffort | undefined,
  quote: (s: string) => string,
): string {
  const flag = effort ? `--effort ${quote(effort)}` : ''
  // Sem esforço, o placeholder leva junto o espaço que o precede — senão o
  // comando fica com espaço sobrando no meio.
  if (template.includes('{effort}')) {
    return flag ? template.replaceAll('{effort}', flag) : template.replace(/ ?\{effort\}/g, '')
  }
  if (!flag) return template
  return template.replace(/^(\s*\S+)/, `$1 ${flag}`)
}

/**
 * Resolve modelo + esforço para a CLI escolhida e devolve o comando pronto.
 */
export function buildCommand(
  config: SpecsConfig,
  cli: AgentCli | undefined,
  model: string | undefined,
  effort: AgentEffort | undefined,
  quote: (s: string) => string,
): string {
  const mode = effortMode(cli)
  const effectiveModel =
    mode === 'model-param' && model && effort ? withEffortParam(model, effort) : model
  const withModel = injectModel(resolveCommand(config, cli), effectiveModel, quote)
  return mode === 'flag' ? injectEffort(withModel, effort, quote) : withModel
}

export type RunAgentResult =
  | { ok: true }
  | { ok: false; status: 501; error: 'terminal_disabled'; hint: string }
  | { ok: false; status: 500; error: 'spawn_failed'; detail: string }

export type InlineCommand = {
  file: string
  args: string[]
  cwd: string
  label: string
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`
}

export async function readFeatureTitle(metaPath: string, fallback: string): Promise<string> {
  try {
    const raw = await readFile(metaPath, 'utf8')
    const parsed = JSON.parse(raw) as { title?: unknown }
    if (typeof parsed.title === 'string' && parsed.title.trim().length > 0) {
      return parsed.title.trim()
    }
  } catch {}
  return fallback
}

export function resolvePrompt(
  template: string,
  ctx: { feature: string; task?: string; featureTitle: string; featurePath: string },
): string {
  return template
    .replaceAll('{feature}', ctx.feature)
    .replaceAll('{task}', ctx.task ?? '')
    .replaceAll('{featureTitle}', ctx.featureTitle)
    .replaceAll('{featurePath}', ctx.featurePath)
}

function buildTerminalCommand(
  terminal: TerminalKind,
  cwd: string,
  shellCommand: string,
): { file: string; args: string[] } | null {
  switch (terminal) {
    case 'osascript': {
      const quotedCwd = shellQuote(cwd)
      const fullShell = `cd ${quotedCwd} && ${shellCommand}`
      const appleScript = [
        'tell application "Terminal"',
        '  activate',
        `  do script ${JSON.stringify(fullShell)}`,
        'end tell',
      ].join('\n')
      return { file: 'osascript', args: ['-e', appleScript] }
    }
    case 'gnome-terminal':
      return {
        file: 'gnome-terminal',
        args: ['--', 'bash', '-c', `cd ${shellQuote(cwd)} && ${shellCommand}; exec bash`],
      }
    case 'kitty':
      return {
        file: 'kitty',
        args: ['--hold', 'bash', '-c', `cd ${shellQuote(cwd)} && ${shellCommand}`],
      }
    case 'wezterm':
      return {
        file: 'wezterm',
        args: ['start', '--cwd', cwd, '--', 'bash', '-c', shellCommand],
      }
    case 'none':
      return null
  }
}

function spawnInTerminal(
  config: SpecsConfig,
  projectRoot: string,
  shellCommand: string,
): RunAgentResult {
  const terminal = config.agent.openTerminal
  if (terminal === 'none') {
    return {
      ok: false,
      status: 501,
      error: 'terminal_disabled',
      hint: 'Ajuste agent.openTerminal no .specs/config.json',
    }
  }

  const cwd = path.resolve(projectRoot, config.agent.cwd ?? '.')
  const termCmd = buildTerminalCommand(terminal, cwd, shellCommand)
  if (!termCmd) {
    return {
      ok: false,
      status: 501,
      error: 'terminal_disabled',
      hint: 'openTerminal não reconhecido.',
    }
  }

  try {
    const child = spawn(termCmd.file, termCmd.args, {
      detached: true,
      stdio: 'ignore',
    })
    child.on('error', (err) => {
      console.error(`[run-agent] spawn error: ${err.message}`)
    })
    child.unref()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: 'spawn_failed',
      detail: (err as Error).message,
    }
  }
}

/**
 * Extrai comando + args puros para execução inline (PTY).
 * Parseia o `agent.command` configurado substituindo "feature-runner" pelo agentName,
 * e injetando o prompt resolvido como último arg. Retorna null se o template
 * não puder ser parseado para o modo inline.
 */
function parseInlineCommand(
  baseCommand: string,
  agentName: string,
  prompt: string,
): { file: string; args: string[] } | null {
  // Template esperado: `claude --agent feature-runner "{prompt}"` (ou similar)
  // Estratégia: dividir nos tokens, trocar "feature-runner" por agentName, e
  // substituir a ocorrência de "{prompt}" (ou `"{prompt}"`) por prompt cru.
  const tokens = baseCommand.match(/"[^"]*"|'[^']*'|\S+/g)
  if (!tokens || tokens.length === 0) return null
  const cleaned = tokens.map((t) => {
    const unquoted =
      (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
        ? t.slice(1, -1)
        : t
    // Troca o agent alvo. Funciona tanto quando `feature-runner` é um token
    // isolado (`claude --agent feature-runner ...`) quanto quando está embutido
    // numa frase dentro de aspas (`cursor-agent "Use the feature-runner ..."`).
    return unquoted.includes('feature-runner')
      ? unquoted.replaceAll('feature-runner', agentName)
      : unquoted
  })
  const promptIdx = cleaned.findIndex((t) => t.includes('{prompt}'))
  if (promptIdx === -1) {
    // Fallback: acrescenta o prompt como último argumento
    cleaned.push(prompt)
  } else {
    cleaned[promptIdx] = (cleaned[promptIdx] ?? '').replaceAll('{prompt}', prompt)
  }
  const [file, ...args] = cleaned
  if (!file) return null
  return { file, args }
}

/**
 * Monta o comando inline (para PTY) e o label humano de um agent de feature/task.
 */
export async function buildAgentInlineCommand(
  input: RunAgentInput,
  config: SpecsConfig,
  projectRoot: string,
): Promise<InlineCommand | null> {
  const { scope, feature, task, cli, model, effort } = input
  const featuresDir = config.featuresDir ?? 'features'
  const featureMetaPath = path.join(projectRoot, featuresDir, feature, 'meta.json')
  const featureTitle = await readFeatureTitle(featureMetaPath, feature)
  const promptTemplate = config.agent.scopes[scope] ?? ''
  const prompt = resolvePrompt(promptTemplate, {
    feature,
    task,
    featureTitle,
    featurePath: `${featuresDir}/${feature}/`,
  })
  const command = buildCommand(config, cli, model, effort, (s) => s)
  const parsed = parseInlineCommand(command, 'feature-runner', prompt)
  if (!parsed) return null
  const cwd = path.resolve(projectRoot, config.agent.cwd ?? '.')
  const label =
    scope === 'task' && task ? `${featureTitle} — ${task}` : `${featureTitle} (${scope})`
  return { file: parsed.file, args: parsed.args, cwd, label }
}

export function buildNamedAgentInlineCommand(
  agentName: string,
  userPrompt: string,
  config: SpecsConfig,
  projectRoot: string,
  label: string,
  cli?: AgentCli,
  model?: string,
  effort?: AgentEffort,
): InlineCommand | null {
  const command = buildCommand(config, cli, model, effort, (s) => s)
  const parsed = parseInlineCommand(command, agentName, userPrompt)
  if (!parsed) return null
  const cwd = path.resolve(projectRoot, config.agent.cwd ?? '.')
  return { file: parsed.file, args: parsed.args, cwd, label }
}

/**
 * Remove a seleção de subagent do template. Jobs de design não rodam sob o
 * `feature-runner`: no Claude Code o pedido é o slash command `/design`, e
 * `--agent` fixaria um subagent que não tem esse comando.
 */
export function stripAgentFlag(template: string): string {
  return template
    .replace(/\s--agent(?:=|\s+)[^\s"']+/g, '')
    .replace(/Use the feature-runner subagent\.\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Monta o comando inline (PTY) de um job de design. */
export function buildDesignInlineCommand(
  prompt: string,
  config: SpecsConfig,
  projectRoot: string,
  label: string,
  cli?: AgentCli,
  model?: string,
  effort?: AgentEffort,
): InlineCommand | null {
  const command = stripAgentFlag(buildCommand(config, cli, model, effort, (s) => s))
  const parsed = parseInlineCommand(command, 'design', prompt)
  if (!parsed) return null
  const cwd = path.resolve(projectRoot, config.agent.cwd ?? '.')
  return { file: parsed.file, args: parsed.args, cwd, label }
}

/** Dispara um job de design em terminal externo. */
export function runDesign(
  prompt: string,
  config: SpecsConfig,
  projectRoot: string,
  cli?: AgentCli,
  model?: string,
  effort?: AgentEffort,
): RunAgentResult {
  const command = stripAgentFlag(buildCommand(config, cli, model, effort, shellQuote))
  const shellCommand = command.replaceAll('{prompt}', shellQuote(prompt))
  return spawnInTerminal(config, projectRoot, shellCommand)
}

export async function runAgent(
  input: RunAgentInput,
  config: SpecsConfig,
  projectRoot: string,
): Promise<RunAgentResult> {
  const { scope, feature, task, cli, model, effort } = input

  const featuresDir = config.featuresDir ?? 'features'
  const featureMetaPath = path.join(projectRoot, featuresDir, feature, 'meta.json')
  const featureTitle = await readFeatureTitle(featureMetaPath, feature)

  const scopeKey: AgentScopeKey = scope
  const promptTemplate = config.agent.scopes[scopeKey] ?? ''
  const prompt = resolvePrompt(promptTemplate, {
    feature,
    task,
    featureTitle,
    featurePath: `${featuresDir}/${feature}/`,
  })

  const commandTemplate = buildCommand(config, cli, model, effort, shellQuote)
  const shellCommand = commandTemplate.replaceAll('{prompt}', shellQuote(prompt))

  return spawnInTerminal(config, projectRoot, shellCommand)
}

export function runRefinement(
  userPrompt: string,
  config: SpecsConfig,
  projectRoot: string,
  cli?: AgentCli,
  model?: string,
  effort?: AgentEffort,
): RunAgentResult {
  return runNamedAgent('refinement', userPrompt, config, projectRoot, cli, model, effort)
}

export function runDrawingAgent(
  userPrompt: string,
  config: SpecsConfig,
  projectRoot: string,
  cli?: AgentCli,
  model?: string,
  effort?: AgentEffort,
): RunAgentResult {
  return runNamedAgent('drawing-agent', userPrompt, config, projectRoot, cli, model, effort)
}

export function runRefinementRunner(
  userPrompt: string,
  config: SpecsConfig,
  projectRoot: string,
  cli?: AgentCli,
  model?: string,
  effort?: AgentEffort,
): RunAgentResult {
  return runNamedAgent('refinement-runner', userPrompt, config, projectRoot, cli, model, effort)
}

export function runDiscoveryAgent(
  userPrompt: string,
  config: SpecsConfig,
  projectRoot: string,
  cli?: AgentCli,
  model?: string,
  effort?: AgentEffort,
): RunAgentResult {
  return runNamedAgent('discovery-agent', userPrompt, config, projectRoot, cli, model, effort)
}

function runNamedAgent(
  agentName: string,
  userPrompt: string,
  config: SpecsConfig,
  projectRoot: string,
  cli?: AgentCli,
  model?: string,
  effort?: AgentEffort,
): RunAgentResult {
  const baseCommand = buildCommand(config, cli, model, effort, shellQuote)
  const command = baseCommand.includes('feature-runner')
    ? baseCommand.replaceAll('feature-runner', agentName)
    : `claude --agent ${agentName} "{prompt}"`
  const shellCommand = command.replaceAll('{prompt}', shellQuote(userPrompt))
  return spawnInTerminal(config, projectRoot, shellCommand)
}

const ANSI_RE = /\x1b\[[0-9;]*m/g
const MODEL_LINE_RE = /^([A-Za-z0-9][A-Za-z0-9._\-/:]*)\s+-\s+(.+)$/
const MODEL_BARE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/:]*$/

/**
 * Parseia a saída de um comando de listagem de modelos. Aceita linhas no
 * formato `id - Nome de Exibição` (cursor-agent --list-models) ou só o id.
 * Linhas de cabeçalho/ruído (com espaços e sem ` - `) são ignoradas.
 */
export function parseModelsOutput(output: string): AgentModel[] {
  const seen = new Set<string>()
  const models: AgentModel[] = []
  for (const raw of output.replace(ANSI_RE, '').split('\n')) {
    const line = raw.trim().replace(/^[-*•]\s+/, '')
    if (!line) continue
    const matched = line.match(MODEL_LINE_RE)
    let id: string | undefined
    let label: string | undefined
    if (matched) {
      id = matched[1]
      label = (matched[2] ?? '').trim()
    } else if (MODEL_BARE_RE.test(line)) {
      id = line
      label = line
    }
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push({ id, label: label ?? id })
    if (models.length >= 200) break
  }
  return models
}

function runForStdout(
  file: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(file, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('timeout'))
    }, timeoutMs)
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `exit ${code}`))
    })
  })
}

export type ListModelsResult = {
  models: AgentModel[]
  source: 'dynamic' | 'static' | 'none'
  error?: string
}

/**
 * Lista os modelos disponíveis de uma CLI. Tenta o comando dinâmico em
 * `agent.modelsCommand[cli]`; em falha (ou ausência), cai na lista estática
 * `agent.models[cli]`. Retorna a fonte usada para a UI sinalizar.
 */
export async function listAgentModels(
  config: SpecsConfig,
  projectRoot: string,
  cli: AgentCli,
): Promise<ListModelsResult> {
  const cwd = path.resolve(projectRoot, config.agent.cwd ?? '.')
  const staticList = (config.agent.models?.[cli] ?? []).map((id) => ({ id, label: id }))
  const command = config.agent.modelsCommand?.[cli]

  if (command) {
    const tokens = command.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
    const cleaned = tokens.map((t) =>
      (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
        ? t.slice(1, -1)
        : t,
    )
    const [file, ...args] = cleaned
    if (file) {
      try {
        const out = await runForStdout(file, args, cwd, 20_000)
        const models = parseModelsOutput(out)
        if (models.length > 0) return { models, source: 'dynamic' }
      } catch (err) {
        if (staticList.length > 0) {
          return { models: staticList, source: 'static', error: (err as Error).message }
        }
        return { models: [], source: 'none', error: (err as Error).message }
      }
    }
  }

  if (staticList.length > 0) return { models: staticList, source: 'static' }
  return { models: [], source: 'none' }
}
