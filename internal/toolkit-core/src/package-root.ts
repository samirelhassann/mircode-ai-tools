import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Sobe a partir do arquivo que chamou até achar o `package.json` do pacote.
 * Funciona tanto no bundle (`dist/cli.js`) quanto rodando o source.
 */
export function findPackageRoot(importMetaUrl: string): string {
  let dir = path.dirname(fileURLToPath(importMetaUrl))
  for (;;) {
    if (existsSync(path.join(dir, 'package.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error(`package.json não encontrado a partir de ${importMetaUrl}`)
    dir = parent
  }
}
