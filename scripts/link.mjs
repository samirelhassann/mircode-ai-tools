// Linka (ou deslinka) globalmente todos os pacotes publicáveis de packages/*,
// para testar os bins (`mircode-ai`, `specs`, ...) como se estivessem instalados.
//
//   pnpm link:global     → build + `pnpm link --global` em cada pacote
//   pnpm unlink:global   → `pnpm remove --global <nome>` em cada pacote
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
if (mode !== 'link' && mode !== 'unlink') {
  console.error('uso: node scripts/link.mjs <link|unlink>')
  process.exit(1)
}

const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' })

// O `pnpm link --global` precisa de um diretório global de bins (PNPM_HOME no PATH).
// Sem ele, `pnpm bin --global` às vezes sai com 0 e saída vazia — por isso checar o path.
let globalBin = ''
try {
  globalBin = execSync('pnpm bin --global', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim()
} catch {}
if (!globalBin || !existsSync(globalBin)) {
  console.error('✗ O pnpm não tem diretório global configurado (PNPM_HOME).')
  console.error('  Rode `pnpm setup` e reabra o terminal. No fish, se preciso:')
  console.error('    set -Ux PNPM_HOME ~/Library/pnpm; fish_add_path $PNPM_HOME')
  process.exit(1)
}

const packages = readdirSync(path.join(root, 'packages'))
  .map((dir) => path.join(root, 'packages', dir))
  .filter((dir) => existsSync(path.join(dir, 'package.json')))
  .map((dir) => ({ dir, pkg: JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) }))
  .filter(({ pkg }) => !pkg.private && pkg.bin)

if (mode === 'link') {
  run('pnpm build')
  for (const { dir, pkg } of packages) {
    console.log(`\n→ link ${pkg.name}`)
    run('pnpm link --global', dir)
  }
} else {
  for (const { pkg } of packages) {
    console.log(`→ unlink ${pkg.name}`)
    try {
      run(`pnpm remove --global ${pkg.name}`)
    } catch {
      console.log(`  · ${pkg.name} não estava linkado`)
    }
  }
}

const bins = packages.flatMap(({ pkg }) => Object.keys(pkg.bin))
console.log(
  mode === 'link'
    ? `\n✓ Linkados em ${globalBin}: ${bins.join(', ')}. Rebuilds (\`pnpm build\`) já valem sem relinkar.`
    : `\n✓ Removidos: ${bins.join(', ')}`,
)
