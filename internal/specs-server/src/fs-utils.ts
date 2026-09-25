import { constants } from 'node:fs'
import { access, readFile, rename, stat, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_REGEX.test(slug)
}

export function assertInsideProject(absPath: string, projectRoot: string): void {
  const rel = path.relative(projectRoot, absPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path ${absPath} fora do projectRoot ${projectRoot}.`)
  }
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK)
    const s = await stat(p)
    return s.isFile()
  } catch {
    return false
  }
}

export async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p)
    return s.isDirectory()
  } catch {
    return false
  }
}

export async function readText(p: string): Promise<string> {
  return readFile(p, 'utf8')
}

export function detectEOL(content: string): '\n' | '\r\n' {
  // Amostra até 4KB para detecção
  const sample = content.length > 4096 ? content.slice(0, 4096) : content
  return sample.includes('\r\n') ? '\r\n' : '\n'
}

/**
 * Escreve `finalPath` de forma atômica: grava em arquivo temporário na mesma
 * pasta e faz rename.
 */
export async function atomicWrite(finalPath: string, content: string): Promise<void> {
  const dir = path.dirname(finalPath)
  await mkdir(dir, { recursive: true })
  const tmp = `${finalPath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, finalPath)
}
