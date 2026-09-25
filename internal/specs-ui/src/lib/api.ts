import type {
  AgentScopeKey,
  ClaudeUsage,
  ContentResponse,
  DiscoveryContentResponse,
  DrawingContentResponse,
  FileDiff,
  PrototypeResolved,
  ReviewChanges,
  SpecsConfig,
  Status,
  TreeResponse,
} from './types'

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
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

export const api = {
  tree: () => request<TreeResponse>('/api/tree'),
  reviewChanges: () => request<ReviewChanges>('/api/review/changes'),
  reviewDiff: (path: string, commit?: string) =>
    request<FileDiff>(
      `/api/review/diff?path=${encodeURIComponent(path)}${commit ? `&commit=${commit}` : ''}`,
    ),
  openInEditor: (path: string, line?: number) =>
    request<{ ok: true; command: string }>('/api/review/open', {
      method: 'POST',
      body: JSON.stringify({ path, line }),
    }),
  content: (feature: string, task: string) =>
    request<ContentResponse>(
      `/api/content?feature=${encodeURIComponent(feature)}&task=${encodeURIComponent(task)}`,
    ),
  setStatus: (feature: string, task: string, status: Status) =>
    request<{ ok: true; status: Status }>('/api/status', {
      method: 'POST',
      body: JSON.stringify({ feature, task, status }),
    }),
  reorderFeatures: (pages: string[]) =>
    request<{ ok: true }>('/api/reorder-features', {
      method: 'POST',
      body: JSON.stringify({ pages }),
    }),
  reorderTasks: (feature: string, pages: string[]) =>
    request<{ ok: true }>('/api/reorder-tasks', {
      method: 'POST',
      body: JSON.stringify({ feature, pages }),
    }),
  runAgent: (scope: AgentScopeKey, feature: string, task?: string) =>
    request<{ ok: true }>('/api/run-agent', {
      method: 'POST',
      body: JSON.stringify({ scope, feature, task }),
    }),
  runRefinement: (prompt: string) =>
    request<{ ok: true }>('/api/run-refinement', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  runDrawingAgent: (prompt: string) =>
    request<{ ok: true }>('/api/run-drawing-agent', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  runDiscoveryAgent: (prompt: string) =>
    request<{ ok: true }>('/api/run-discovery-agent', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  updateContent: (feature: string, task: string, body: string) =>
    request<{ ok: true }>('/api/content', {
      method: 'PUT',
      body: JSON.stringify({ feature, task, body }),
    }),
  deleteTask: (feature: string, task: string) =>
    request<{ ok: true }>(
      `/api/task?feature=${encodeURIComponent(feature)}&task=${encodeURIComponent(task)}`,
      { method: 'DELETE' },
    ),
  deleteFeature: (feature: string) =>
    request<{ ok: true }>(`/api/feature?feature=${encodeURIComponent(feature)}`, {
      method: 'DELETE',
    }),
  discoveryContent: (slug: string) =>
    request<DiscoveryContentResponse>(`/api/discovery/content?slug=${encodeURIComponent(slug)}`),
  updateDiscoveryContent: (slug: string, body: string) =>
    request<{ ok: true }>('/api/discovery/content', {
      method: 'PUT',
      body: JSON.stringify({ slug, body }),
    }),
  deleteDiscovery: (slug: string) =>
    request<{ ok: true }>(`/api/discovery?slug=${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    }),
  reorderDiscoveries: (pages: string[]) =>
    request<{ ok: true }>('/api/reorder-discoveries', {
      method: 'POST',
      body: JSON.stringify({ pages }),
    }),
  drawingContent: (slug: string) =>
    request<DrawingContentResponse>(`/api/drawing/content?slug=${encodeURIComponent(slug)}`),
  updateDrawingContent: (slug: string, body: string) =>
    request<{ ok: true }>('/api/drawing/content', {
      method: 'PUT',
      body: JSON.stringify({ slug, body }),
    }),
  deleteDrawing: (slug: string) =>
    request<{ ok: true }>(`/api/drawing?slug=${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    }),
  reorderDrawings: (pages: string[]) =>
    request<{ ok: true }>('/api/reorder-drawings', {
      method: 'POST',
      body: JSON.stringify({ pages }),
    }),
  config: () => request<{ config: SpecsConfig; projectRoot: string }>('/api/config'),
  prototype: (feature?: string) =>
    request<{ prototype: PrototypeResolved | null }>(
      `/api/prototype${feature ? `?feature=${encodeURIComponent(feature)}` : ''}`,
    ),
  openPrototype: (feature?: string) =>
    request<{ ok: true; command: string }>('/api/prototype/open', {
      method: 'POST',
      body: JSON.stringify({ feature }),
    }),
  usage: () => request<{ usage: ClaudeUsage | null }>('/api/usage'),
}
