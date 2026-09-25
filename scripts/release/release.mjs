// Release independente por pacote publicado (packages/*), com semantic-release.
//
//   pnpm release              # CI: versiona, gera CHANGELOG, publica no npm e cria tag/GitHub release
//   pnpm release:dry          # mostra o que seria lançado, sem publicar nada
//   pnpm release:dry --package @mir-code/specs-platform
//
// Para cada pacote:
// - tag própria: `<nome>@<versão>` (ex.: @mir-code/specs-platform@1.2.0);
// - só contam commits que tocam a pasta do pacote OU a de uma dependência de
//   workspace (transitiva) — inclusive `internal/*`, que vai embutido no build;
// - ordem topológica: uma tool sai antes do `@mir-code/ai-tools`, que depende dela,
//   para o `workspace:^` virar a versão recém-publicada no `pnpm publish`.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import semanticRelease from 'semantic-release'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const only = args.includes('--package') ? args[args.indexOf('--package') + 1] : undefined

/** @type {Map<string, { dir: string, pkg: any }>} */
const workspace = new Map()
for (const group of ['packages', 'internal']) {
  for (const entry of readdirSync(path.join(root, group))) {
    const file = path.join(root, group, entry, 'package.json')
    if (!existsSync(file)) continue
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    workspace.set(pkg.name, { dir: `${group}/${entry}`, pkg })
  }
}

const workspaceDeps = (name) => {
  const { pkg } = workspace.get(name)
  const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }
  return Object.keys(all).filter((dep) => workspace.has(dep))
}

/** Pasta do pacote + pastas de todas as dependências de workspace, transitivamente. */
const releasePaths = (name, seen = new Set()) => {
  if (seen.has(name)) return []
  seen.add(name)
  return [workspace.get(name).dir, ...workspaceDeps(name).flatMap((d) => releasePaths(d, seen))]
}

const publishable = [...workspace.keys()].filter(
  (name) => workspace.get(name).dir.startsWith('packages/') && !workspace.get(name).pkg.private,
)

// Ordem topológica: dependências publicáveis primeiro.
const ordered = []
const visit = (name) => {
  if (ordered.includes(name)) return
  for (const dep of workspaceDeps(name)) if (publishable.includes(dep)) visit(dep)
  ordered.push(name)
}
publishable.forEach(visit)

if (only && !publishable.includes(only)) {
  console.error(`✗ pacote desconhecido: ${only}. Publicáveis: ${publishable.join(', ')}`)
  process.exit(1)
}

// O semantic-release cria o commit de versão e a tag ANTES do publish. Um erro
// que só o registry detecta deixaria tag/commit sem pacote no npm — então o que
// dá para checar localmente é checado aqui, antes de qualquer pacote rodar.
const problems = ordered.flatMap((name) => {
  const { pkg } = workspace.get(name)
  const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  // A provenance do npm exige `repository.url` igual ao repositório do GitHub.
  return url ? [] : [`${name}: falta "repository.url" no package.json (exigido pela provenance)`]
})
if (problems.length > 0) {
  console.error(`✗ Release abortado antes de começar:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

const results = []
for (const name of ordered.filter((n) => !only || n === only)) {
  const { dir } = workspace.get(name)
  const paths = [...new Set(releasePaths(name))]
  console.log(`\n━━━ ${name} (${paths.join(', ')}) ━━━`)

  const plugins = [
    ['./scripts/release/path-filter.mjs', { preset: 'conventionalcommits', paths }],
    ['@semantic-release/changelog', { changelogFile: `${dir}/CHANGELOG.md` }],
    [
      '@semantic-release/exec',
      {
        execCwd: dir,
        // O `npm pkg set` reformata o JSON; o biome devolve ao estilo do repo.
        prepareCmd:
          'npm pkg set version=${nextRelease.version} && pnpm exec biome format --write package.json',
        // `pnpm publish` (não `npm publish`) para converter `workspace:^` na versão real.
        publishCmd: 'pnpm publish --no-git-checks --access public',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [`${dir}/package.json`, `${dir}/CHANGELOG.md`],
        message: `chore(release): ${name}@\${nextRelease.version} [skip ci]\n\n\${nextRelease.notes}`,
      },
    ],
  ]
  // Local (sem token) o dry-run funciona sem o plugin do GitHub.
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
    plugins.push(['@semantic-release/github', { successComment: false }])
  }

  const result = await semanticRelease(
    {
      branches: ['main'],
      tagFormat: `${name}@\${version}`,
      dryRun,
      ...(dryRun ? { ci: false } : {}),
      plugins,
    },
    { cwd: root, env: process.env, stdout: process.stdout, stderr: process.stderr },
  )
  results.push({ name, version: result ? result.nextRelease.version : null })
}

console.log('\nResumo:')
for (const { name, version } of results) {
  console.log(
    `  ${name.padEnd(28)} ${version ? `→ ${version}${dryRun ? ' (dry-run)' : ''}` : 'sem release'}`,
  )
}
