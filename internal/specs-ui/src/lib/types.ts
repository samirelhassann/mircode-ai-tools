export type Status = 'pending' | 'in-progress' | 'completed' | 'blocked'

export type TerminalKind = 'osascript' | 'gnome-terminal' | 'kitty' | 'wezterm' | 'none'

export type AgentScopeKey = 'feature' | 'featureNoPause' | 'task'

export type DiscoveryType = 'rfc' | 'spike' | 'adr' | 'note'

/** Natureza do desenho — a pergunta que ele responde, não o tipo de diagrama Mermaid. */
export type DrawingType = 'architecture' | 'flow' | 'sequence' | 'data' | 'state'

export type ExecutionMode = 'inline' | 'external'

export type AgentCli = string

export type AgentModel = { id: string; label: string }

/** Níveis de esforço de raciocínio, do mais barato ao mais caro. */
export type AgentEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type JobKind =
  | 'agent'
  | 'refinement'
  | 'refinement-runner'
  | 'discovery-agent'
  | 'drawing-agent'
  | 'design'

/** Ferramenta de prototipação usada pelo projeto. */
export type PrototypeTool = 'claude-design' | 'pencil'

export type PrototypeConfig = {
  tool: PrototypeTool
  title?: string
  /** Claude Design: URL do canvas publicado. */
  url?: string
  /** Pencil: caminho do `.pen` relativo à raiz do projeto. */
  file?: string
  designDir?: string
  artboards?: string[]
  nodeIds?: string[]
  openCommand?: string
  /** HTML do protótipo salvo no repo, servido pela plataforma para o iframe. */
  snapshot?: string
}

export type PrototypeResolved = PrototypeConfig & {
  source: 'config' | 'feature'
  feature?: string
  filePath?: string
  fileExists?: boolean
  snapshotPath?: string
  snapshotExists?: boolean
}

export type JobStatus = 'running' | 'needs-input' | 'done' | 'failed' | 'cancelled'

export type JobSummary = {
  id: string
  kind: JobKind
  label: string
  feature?: string
  task?: string
  status: JobStatus
  pid: number
  startedAt: number
  endedAt?: number
  exitCode?: number
  bufferBytes: number
  needsInputHint?: string
  /** true quando o registro veio do histórico em disco, de uma sessão anterior do servidor. */
  restored?: boolean
}

export type JobWithBuffer = JobSummary & { buffer: string }

export type SpecsConfig = {
  agent: {
    cli: AgentCli
    commands: Record<string, string>
    modelsCommand: Record<string, string>
    models: Record<string, string[]>
    command: string
    openTerminal: TerminalKind
    cwd: string
    scopes: Record<AgentScopeKey, string>
    defaultExecutionMode: ExecutionMode
    sound: boolean
    inputPromptPatterns: string[]
    bufferBytesCap: number
  }
  prototype: PrototypeConfig | null
  theme: 'dark'
  warnBelowWidth: number
  featuresDir: string
  discoveriesDir: string
  drawingsDir: string
  port: number
}

export type TaskNode = {
  slug: string
  title: string
  description?: string
  status: Status
  file: string
}

export type FeatureNode = {
  slug: string
  title: string
  description?: string
  icon?: string
  status: Status
  tasks: TaskNode[]
}

export type DiscoveryNode = {
  slug: string
  title: string
  type: DiscoveryType
  date?: string
  file: string
}

export type DrawingNode = {
  slug: string
  title: string
  type: DrawingType
  date?: string
  file: string
}

export type TreeResponse = {
  features: FeatureNode[]
  discoveries: DiscoveryNode[]
  drawings: DrawingNode[]
}

export type Heading = { id: string; text: string; level: number }

export type ContentResponse = {
  frontmatter: {
    title?: string
    description?: string
    status: Status
    [key: string]: unknown
  }
  body: string
  headings: Heading[]
  raw: string
}

export type DiscoveryContentResponse = {
  frontmatter: {
    title?: string
    type: DiscoveryType
    date?: string
    [key: string]: unknown
  }
  body: string
  headings: Heading[]
  raw: string
}

export type DrawingContentResponse = {
  frontmatter: {
    title?: string
    type: DrawingType
    date?: string
    [key: string]: unknown
  }
  body: string
  headings: Heading[]
  raw: string
}

export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'

export type ChangedFile = {
  path: string
  previousPath?: string
  status: ChangeStatus
  additions: number
  deletions: number
  generated: boolean
  binary: boolean
}

export type FileDiff = {
  path: string
  binary: boolean
  truncated: boolean
  diff: string
}

export type LocalCommit = {
  hash: string
  shortHash: string
  subject: string
  date: string
  files: ChangedFile[]
  additions: number
  deletions: number
}

export type ReviewChanges = {
  branch: string
  upstream: string | null
  commits: LocalCommit[]
  files: ChangedFile[]
  totals: { files: number; additions: number; deletions: number }
}

/** Uso do plano do Claude (mesmo dado do `/usage`). */
export type UsageWindow = {
  usedPercentage: number
  /** epoch em **segundos**; null quando não deu para determinar o reset. */
  resetsAt: number | null
  /** true quando o reset foi deduzido do histórico local, não lido direto. */
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
