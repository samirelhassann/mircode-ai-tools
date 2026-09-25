import type {
  AgentCli,
  AgentEffort,
  AgentModel,
  AgentScopeKey,
  ExecutionMode,
  JobKind,
  JobSummary,
  JobWithBuffer,
} from './types'

export type CreateJobBody =
  | {
      kind: 'agent'
      mode: ExecutionMode
      cli?: AgentCli
      model?: string
      effort?: AgentEffort
      scope: AgentScopeKey
      feature: string
      task?: string
      cols?: number
      rows?: number
    }
  | {
      kind: 'refinement'
      mode: ExecutionMode
      cli?: AgentCli
      model?: string
      effort?: AgentEffort
      prompt: string
      cols?: number
      rows?: number
    }
  | {
      kind: 'refinement-runner'
      mode: ExecutionMode
      cli?: AgentCli
      model?: string
      effort?: AgentEffort
      prompt: string
      cols?: number
      rows?: number
    }
  | {
      kind: 'design'
      mode: ExecutionMode
      cli?: AgentCli
      model?: string
      effort?: AgentEffort
      prompt: string
      /** `snapshot` regrava a cópia local do protótipo; `change` (default) altera o design. */
      intent?: 'change' | 'snapshot'
      feature?: string
      task?: string
      cols?: number
      rows?: number
    }
  | {
      kind: 'discovery-agent'
      mode: ExecutionMode
      cli?: AgentCli
      model?: string
      effort?: AgentEffort
      prompt: string
      cols?: number
      rows?: number
    }
  | {
      kind: 'drawing-agent'
      mode: ExecutionMode
      cli?: AgentCli
      model?: string
      effort?: AgentEffort
      prompt: string
      cols?: number
      rows?: number
    }

export type ListModelsResult = {
  models: AgentModel[]
  source: 'dynamic' | 'static' | 'none'
  error?: string
}

export type CreateJobResponse =
  | { ok: true; mode: 'external' }
  | { ok: true; mode: 'inline'; jobId: string; job: JobSummary }

async function json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let detail: unknown
    try {
      detail = await res.json()
    } catch {}
    const err = new Error(
      `Request failed ${res.status}: ${(detail as { error?: string } | undefined)?.error ?? res.statusText}`,
    )
    ;(err as Error & { status?: number; detail?: unknown }).status = res.status
    ;(err as Error & { status?: number; detail?: unknown }).detail = detail
    throw err
  }
  return (await res.json()) as T
}

export const jobsApi = {
  create: (body: CreateJobBody) =>
    json<CreateJobResponse>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  list: () => json<{ jobs: JobSummary[] }>('/api/jobs'),
  models: (cli: string) =>
    json<ListModelsResult>(`/api/agent-models?cli=${encodeURIComponent(cli)}`),
  get: (id: string) => json<JobWithBuffer>(`/api/jobs/${encodeURIComponent(id)}`),
  sendInput: (id: string, data: string) =>
    json<{ ok: true }>(`/api/jobs/${encodeURIComponent(id)}/input`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),
  resize: (id: string, cols: number, rows: number) =>
    json<{ ok: true }>(`/api/jobs/${encodeURIComponent(id)}/resize`, {
      method: 'POST',
      body: JSON.stringify({ cols, rows }),
    }),
  stop: (id: string) =>
    json<{ ok: true }>(`/api/jobs/${encodeURIComponent(id)}/stop`, {
      method: 'POST',
    }),
  remove: (id: string) =>
    json<{ ok: true }>(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export type JobStreamEvent =
  | { type: 'chunk'; payload: string }
  | {
      type: 'status'
      payload: {
        status: JobSummary['status']
        exitCode?: number
        needsInputHint?: string
      }
    }

export function createJobStream(
  jobId: string,
  onEvent: (ev: JobStreamEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/stream`)
  source.addEventListener('chunk', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as string
      onEvent({ type: 'chunk', payload: data })
    } catch {}
  })
  source.addEventListener('status', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as {
        status: JobSummary['status']
        exitCode?: number
        needsInputHint?: string
      }
      onEvent({ type: 'status', payload: data })
    } catch {}
  })
  if (onError) source.onerror = onError
  return () => {
    source.close()
  }
}

// Compat helper — reexport tipo para componentes existentes
export type { JobKind }
