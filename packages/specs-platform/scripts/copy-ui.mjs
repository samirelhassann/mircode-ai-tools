import { existsSync } from 'node:fs'
// Copia o build estático da UI (internal/specs-ui/dist) para dist/ui, de onde
// o Fastify o serve quando o pacote roda instalado via npm.
import { cp, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.resolve(root, '..', '..', 'internal', 'specs-ui', 'dist')
const dest = path.resolve(root, 'dist', 'ui')

if (!existsSync(path.join(src, 'index.html'))) {
  console.error(
    `✗ UI não buildada em ${src}. Rode \`pnpm --filter @mir-code/specs-ui build\` antes.`,
  )
  process.exit(1)
}

await rm(dest, { recursive: true, force: true })
await cp(src, dest, { recursive: true })
console.log('✓ UI copiada para dist/ui')
