import path from 'node:path'
import { findPackageRoot } from '@mir-code/toolkit-core'

export const packageRoot = findPackageRoot(import.meta.url)

/** Arquivos copiados para o projeto consumidor por `specs install`. */
export const templateDir = path.join(packageRoot, 'assets', 'template')

/** Build estático da UI, servido pelo Fastify. */
export const uiDir = path.join(packageRoot, 'dist', 'ui')

export const cliEntry = path.join(packageRoot, 'dist', 'cli.js')

export const statuslineScript = path.join(packageRoot, 'assets', 'specs-usage-statusline.sh')

/** Estado de runtime local (pid/log do `specs start` em background). */
export function runDir(projectRoot: string): string {
  return path.join(projectRoot, '.specs', '.run')
}
