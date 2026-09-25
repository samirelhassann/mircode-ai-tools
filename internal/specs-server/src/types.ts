export type Status = 'pending' | 'in-progress' | 'completed' | 'blocked'

export type TerminalKind = 'osascript' | 'gnome-terminal' | 'kitty' | 'wezterm' | 'none'

export type AgentScopeKey = 'feature' | 'featureNoPause' | 'task'

export type DiscoveryType = 'rfc' | 'spike' | 'adr' | 'note'

/**
 * Natureza do desenho. Não é o tipo de diagrama Mermaid (um `architecture` pode
 * ser um `flowchart`): é a **pergunta** que o desenho responde, que é o que
 * importa para achar o desenho certo na lista.
 */
export type DrawingType = 'architecture' | 'flow' | 'sequence' | 'data' | 'state'

export type ExecutionMode = 'inline' | 'external'

/**
 * Chave da CLI de agente usada para disparar os jobs. `claude` (Claude Code) e
 * `cursor` (cursor-agent) são reconhecidas nativamente; chaves extras podem ser
 * adicionadas em `agent.commands` do `.specs/config.json`.
 */
export type AgentCli = string

/** Modelo de uma CLI: `id` é o valor passado para `--model`; `label` é o nome amigável. */
export type AgentModel = { id: string; label: string }

/** Níveis de esforço de raciocínio aceitos pelas CLIs (do mais barato ao mais caro). */
export const AGENT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type AgentEffort = (typeof AGENT_EFFORTS)[number]

export type JobKind =
  | 'agent'
  | 'refinement'
  | 'refinement-runner'
  | 'discovery-agent'
  | 'drawing-agent'
  | 'design'

/** Ferramenta de prototipação usada pelo projeto. */
export type PrototypeTool = 'claude-design' | 'pencil'

/**
 * Protótipo do projeto (ou de uma feature). Declarado em `.specs/config.json`
 * como default do projeto e sobrescrevível no `meta.json` de cada feature.
 */
export type PrototypeConfig = {
  tool: PrototypeTool
  /** Título humano exibido no painel da Specs Platform. */
  title?: string
  /** Claude Design: URL do canvas/artifact publicado. */
  url?: string
  /** Pencil: caminho do arquivo `.pen`, relativo à raiz do projeto. */
  file?: string
  /** Pasta com o README/notas do protótipo (ex.: `design/finance-redesign`). */
  designDir?: string
  /** Artboards/telas do protótipo, listados no painel. */
  artboards?: string[]
  /** Node IDs relevantes (Pencil), quando o projeto quiser fixá-los. */
  nodeIds?: string[]
  /** Sobrescreve o comando de abertura local (Pencil). `{file}` é expandido. */
  openCommand?: string
  /**
   * HTML do protótipo salvo no repositório, servido pela plataforma para embutir
   * o protótipo em iframe. O canvas do Claude Design manda `frame-ancestors
   * 'self'` e não embute pela URL — o snapshot local resolve isso. Default:
   * `<designDir>/canvas.html`, quando existir.
   */
  snapshot?: string
}

/** Protótipo já resolvido (config global + override da feature). */
export type PrototypeResolved = PrototypeConfig & {
  /** De onde veio a declaração usada. */
  source: 'config' | 'feature'
  /** Feature cujo override foi aplicado, quando `source === 'feature'`. */
  feature?: string
  /** Pencil: caminho absoluto do `.pen`, quando ele existe no disco. */
  filePath?: string
  /** Pencil: `false` quando `file` está declarado mas não existe no disco. */
  fileExists?: boolean
  /** Caminho relativo do snapshot em uso (declarado ou o default do `designDir`). */
  snapshotPath?: string
  /** `true` quando há snapshot no disco — é o que habilita o iframe. */
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
  /**
   * true quando o registro veio do histórico em disco, de uma sessão anterior
   * do servidor. O processo não existe mais: dá para ler o terminal, não para
   * responder nele.
   */
  restored?: boolean
}

export type JobWithBuffer = JobSummary & { buffer: string }

export type SpecsConfig = {
  agent: {
    /**
     * CLI padrão usada ao abrir os modais de execução. Deve ser uma chave de
     * `commands`. Persistida por sessão no browser via `localStorage`.
     */
    cli: AgentCli
    /**
     * Template de comando por CLI. A chave é o identificador da CLI (`claude`,
     * `cursor`, ...) e o valor o comando a ser disparado, com `{prompt}`, o
     * placeholder opcional `{model}` (expandido para `--model <id>` ou vazio) e o
     * token `feature-runner` (trocado pelo agent correspondente).
     */
    commands: Record<string, string>
    /**
     * Comando que lista os modelos de uma CLI dinamicamente (ex.: `cursor-agent
     * --list-models`). A saída é parseada linha a linha. Chave = id da CLI.
     */
    modelsCommand: Record<string, string>
    /**
     * Lista estática de modelos por CLI, usada como fallback (ou única fonte
     * quando a CLI não expõe listagem, ex.: Claude Code). Chave = id da CLI.
     */
    models: Record<string, string[]>
    /** Comando legado / fallback (= commands[cli]). Mantido para retrocompat. */
    command: string
    openTerminal: TerminalKind
    cwd: string
    scopes: Record<AgentScopeKey, string>
    defaultExecutionMode: ExecutionMode
    sound: boolean
    inputPromptPatterns: string[]
    bufferBytesCap: number
  }
  /**
   * Protótipo default do projeto. `null` quando o projeto não tem protótipo —
   * nesse caso a Specs Platform esconde o painel e os agents pulam a fase visual.
   */
  prototype: PrototypeConfig | null
  review: {
    /**
     * Comando que abre um arquivo no editor a partir da tela de review.
     * Placeholders: `{path}` (absoluto) e `{line}`. Default: Cursor.
     */
    openCommand: string
  }
  theme: 'dark'
  warnBelowWidth: number
  featuresDir: string
  discoveriesDir: string
  drawingsDir: string
  port: number
}

export type StartServerOptions = {
  projectRoot: string
  /** Diretório com o build estático da UI. Ausente → só a API (UI via Vite em dev). */
  uiDir?: string
}

export type StartedServer = {
  url: string
  port: number
  close: () => Promise<void>
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
