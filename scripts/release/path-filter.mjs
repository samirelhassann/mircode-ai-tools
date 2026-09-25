// Plugin do semantic-release que restringe os commits aos caminhos de um pacote
// antes de delegar ao commit-analyzer e ao release-notes-generator oficiais.
//
// Por que existe: os pacotes publicados embutem código de `internal/*` no build.
// Um `fix:` em `internal/specs-server` precisa gerar release do
// `@mir-code/specs-platform`, então o filtro não pode ser só a pasta do pacote
// (é o que multi-semantic-release/semantic-release-monorepo fazem). O
// `scripts/release/release.mjs` calcula `paths` = pasta do pacote + pastas das
// dependências de workspace (transitivas).
import { execFileSync } from 'node:child_process'
import * as commitAnalyzer from '@semantic-release/commit-analyzer'
import * as notesGenerator from '@semantic-release/release-notes-generator'

function filterCommits({ paths, ...config }, context) {
  const range = context.lastRelease?.gitHead ? `${context.lastRelease.gitHead}..HEAD` : 'HEAD'
  const hashes = new Set(
    execFileSync('git', ['log', '--format=%H', range, '--', ...paths], {
      cwd: context.cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .filter(Boolean),
  )
  const commits = context.commits.filter((c) => hashes.has(c.hash))
  return { config, context: { ...context, commits } }
}

export async function analyzeCommits(pluginConfig, context) {
  const { config, context: filtered } = filterCommits(pluginConfig, context)
  context.logger.log(
    `${filtered.commits.length} de ${context.commits.length} commits tocam ${pluginConfig.paths.join(', ')}`,
  )
  return commitAnalyzer.analyzeCommits(config, filtered)
}

export async function generateNotes(pluginConfig, context) {
  const { config, context: filtered } = filterCommits(pluginConfig, context)
  return notesGenerator.generateNotes(config, filtered)
}
