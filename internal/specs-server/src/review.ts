import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

const MAX_DIFF_LINES = 1500

export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'

export type ChangedFile = {
  path: string
  previousPath?: string
  status: ChangeStatus
  additions: number
  deletions: number
  /** Arquivo gerado/mecânico (lock, snapshot, migration SQL) — agrupado à parte na UI. */
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
  /** Commits locais ainda não enviados — no modo feature, um por task. */
  commits: LocalCommit[]
  files: ChangedFile[]
  totals: { files: number; additions: number; deletions: number }
}

const GENERATED_PATTERNS = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /\.snap$/,
  /(^|\/)dist\//,
  /(^|\/)node_modules\//,
  /(^|\/)migrations?\/.+\.sql$/,
]

function isGenerated(file: string): boolean {
  return GENERATED_PATTERNS.some((re) => re.test(file))
}

function statusFromCode(code: string): ChangeStatus {
  if (code === '??') return 'untracked'
  const flags = code.replace(/\s/g, '')
  if (flags.includes('R')) return 'renamed'
  if (flags.includes('D')) return 'deleted'
  if (flags.includes('A')) return 'added'
  return 'modified'
}

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await run('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 })
    return stdout
  } catch (err) {
    // `git diff --no-index` sai com 1 quando há diferença: a saída ainda é válida.
    const withStdout = err as { stdout?: string; code?: number }
    if (typeof withStdout.stdout === 'string' && withStdout.stdout.length > 0) {
      return withStdout.stdout
    }
    throw err
  }
}

/** Entradas de `git status --porcelain=v1 -z`, já resolvendo os pares de rename. */
function parseStatus(raw: string): Array<{ code: string; file: string; previous?: string }> {
  const parts = raw.split('\0').filter((p) => p.length > 0)
  const out: Array<{ code: string; file: string; previous?: string }> = []
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i] as string
    const code = entry.slice(0, 2)
    const file = entry.slice(3)
    if (code.includes('R') || code.includes('C')) {
      const previous = parts[i + 1]
      i += 1
      out.push({ code, file, previous })
      continue
    }
    out.push({ code, file })
  }
  return out
}

/** `git diff --numstat -z`: "add\tdel\0path\0" (renames trazem dois paths). */
function parseNumstat(raw: string): Map<string, { additions: number; deletions: number }> {
  const out = new Map<string, { additions: number; deletions: number }>()
  const parts = raw.split('\0').filter((p) => p.length > 0)
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i] as string
    const match = /^(\d+|-)\t(\d+|-)\t?(.*)$/.exec(entry)
    if (!match) continue
    const additions = match[1] === '-' ? 0 : Number(match[1])
    const deletions = match[2] === '-' ? 0 : Number(match[2])
    let file = match[3] ?? ''
    if (!file) {
      // rename: os dois paths vêm nas entradas seguintes (origem, destino)
      i += 1
      file = parts[i + 1] ?? parts[i] ?? ''
      i += 1
    }
    if (file) out.set(file, { additions, deletions })
  }
  return out
}

async function countUntracked(projectRoot: string, file: string): Promise<number> {
  try {
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(path.resolve(projectRoot, file), 'utf8')
    if (content === '') return 0
    return content.split('\n').length
  } catch {
    return 0
  }
}

function truncate(diff: string): { diff: string; truncated: boolean } {
  const lines = diff.split('\n')
  if (lines.length <= MAX_DIFF_LINES) return { diff, truncated: false }
  return { diff: lines.slice(0, MAX_DIFF_LINES).join('\n'), truncated: true }
}

async function resolveUpstream(projectRoot: string, branch: string): Promise<string | null> {
  const tracked = await git(projectRoot, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ])
    .then((out) => out.trim())
    .catch(() => '')
  if (tracked) return tracked
  const fallback = `origin/${branch}`
  const exists = await git(projectRoot, ['rev-parse', '--verify', '--quiet', fallback])
    .then((out) => out.trim().length > 0)
    .catch(() => false)
  return exists ? fallback : null
}

/** `git show --numstat`: uma linha "add\tdel\tpath" por arquivo do commit. */
function parseShowNumstat(raw: string): ChangedFile[] {
  const files: ChangedFile[] = []
  for (const line of raw.split('\n')) {
    const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line.trim())
    if (!match) continue
    const file = match[3] as string
    files.push({
      path: file,
      status: 'modified',
      additions: match[1] === '-' ? 0 : Number(match[1]),
      deletions: match[2] === '-' ? 0 : Number(match[2]),
      generated: isGenerated(file),
      binary: match[1] === '-' && match[2] === '-',
    })
  }
  return files
}

async function collectLocalCommits(
  projectRoot: string,
  upstream: string | null,
): Promise<LocalCommit[]> {
  if (!upstream) return []
  const log = await git(projectRoot, [
    'log',
    '--reverse',
    '--format=%H%x1f%h%x1f%s%x1f%aI',
    `${upstream}..HEAD`,
  ]).catch(() => '')

  const commits: LocalCommit[] = []
  for (const line of log.split('\n')) {
    if (!line.trim()) continue
    const [hash, shortHash, subject, date] = line.split('\x1f')
    if (!hash) continue
    const files = parseShowNumstat(
      await git(projectRoot, ['show', '--numstat', '--format=', hash]).catch(() => ''),
    )
    commits.push({
      hash,
      shortHash: shortHash ?? hash.slice(0, 7),
      subject: subject ?? '',
      date: date ?? '',
      files,
      additions: files.reduce((sum, f) => sum + f.additions, 0),
      deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    })
  }
  return commits
}

async function diffForFile(
  projectRoot: string,
  file: string,
  status: ChangeStatus,
): Promise<string> {
  if (status === 'untracked') {
    return git(projectRoot, ['diff', '--no-index', '--unified=3', '--', '/dev/null', file])
  }
  return git(projectRoot, ['diff', 'HEAD', '--unified=3', '--', file])
}

/**
 * Alterações do working tree (staged + não staged + untracked) contra o HEAD.
 * Só metadados e contagem — o diff de cada arquivo vem sob demanda em `fileDiff`,
 * para a lista continuar barata quando a feature inteira está em revisão.
 */
export async function collectChanges(projectRoot: string): Promise<ReviewChanges> {
  const branch = (await git(projectRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  const upstream = await resolveUpstream(projectRoot, branch)
  const commits = await collectLocalCommits(projectRoot, upstream)
  const status = parseStatus(
    await git(projectRoot, ['status', '--porcelain=v1', '--untracked-files=all', '-z']),
  )
  const numstat = parseNumstat(await git(projectRoot, ['diff', '--numstat', '-z', 'HEAD']))

  const files: ChangedFile[] = []
  for (const entry of status) {
    const fileStatus = statusFromCode(entry.code)
    const counted = numstat.get(entry.file)
    const additions =
      counted?.additions ??
      (fileStatus === 'untracked' ? await countUntracked(projectRoot, entry.file) : 0)
    files.push({
      path: entry.file,
      previousPath: entry.previous,
      status: fileStatus,
      additions,
      deletions: counted?.deletions ?? 0,
      generated: isGenerated(entry.file),
      binary: false,
    })
  }

  files.sort((a, b) => {
    if (a.generated !== b.generated) return a.generated ? 1 : -1
    return a.path.localeCompare(b.path)
  })

  return {
    branch,
    upstream,
    commits,
    files,
    totals: {
      files: files.length,
      additions: files.reduce((sum, f) => sum + f.additions, 0),
      deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    },
  }
}

/**
 * Diff de um arquivo — do working tree contra o HEAD, ou de dentro de um commit
 * local quando `commit` é informado. Carregado quando o revisor abre o card.
 */
export async function fileDiff(
  projectRoot: string,
  file: string,
  commit?: string,
): Promise<FileDiff> {
  const absolute = path.resolve(projectRoot, file)
  const relative = path.relative(projectRoot, absolute)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('invalid_path')
  }
  if (commit) {
    if (!/^[0-9a-f]{7,40}$/i.test(commit)) throw new Error('invalid_commit')
    const raw = await git(projectRoot, [
      'show',
      '--format=',
      '--unified=3',
      commit,
      '--',
      file,
    ]).catch(() => '')
    const { diff, truncated } = truncate(raw)
    return { path: file, binary: raw.includes('Binary files'), truncated, diff }
  }
  const tracked = await git(projectRoot, ['ls-files', '--error-unmatch', '--', file])
    .then(() => true)
    .catch(() => false)
  const raw = await diffForFile(projectRoot, file, tracked ? 'modified' : 'untracked').catch(
    () => '',
  )
  const { diff, truncated } = truncate(raw)
  return { path: file, binary: raw.includes('Binary files'), truncated, diff }
}

export type OpenEditorResult =
  | { ok: true; command: string }
  | { ok: false; error: 'invalid_path' | 'spawn_failed'; detail?: string }

/**
 * Abre o arquivo no editor configurado (`review.openCommand`, default Cursor),
 * posicionando o cursor na linha quando informada.
 */
export async function openInEditor(
  projectRoot: string,
  template: string,
  file: string,
  line?: number,
): Promise<OpenEditorResult> {
  const absolute = path.resolve(projectRoot, file)
  const relative = path.relative(projectRoot, absolute)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, error: 'invalid_path' }
  }

  const filled = template
    .replaceAll('{path}', absolute)
    .replaceAll('{line}', String(line ?? 1))
    .trim()
  const [bin, ...args] = filled.split(/\s+/)
  if (!bin) return { ok: false, error: 'spawn_failed', detail: 'comando vazio' }

  try {
    await run(bin, args, { cwd: projectRoot })
    return { ok: true, command: filled }
  } catch (err) {
    return { ok: false, error: 'spawn_failed', detail: (err as Error).message }
  }
}
