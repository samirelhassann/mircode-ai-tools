import { constants } from 'node:fs'
import {
  access,
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

export async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/** Copia arquivo ou diretório, substituindo o destino por inteiro. */
export async function copyReplacing(src: string, dest: string): Promise<void> {
  await mkdir(path.dirname(dest), { recursive: true })
  await rm(dest, { recursive: true, force: true })
  await cp(src, dest, { recursive: true })
}

/**
 * Copia só se o destino não existir (ou com `force`). Retorna `true` quando escreveu.
 * Usado para arquivos que o projeto consumidor customiza.
 */
export async function copyIfAbsent(src: string, dest: string, force = false): Promise<boolean> {
  if (!force && (await exists(dest))) return false
  await copyReplacing(src, dest)
  return true
}

export type SymlinkResult = 'created' | 'unchanged' | 'backed-up'

/**
 * Garante `linkPath → target` (target relativo). Se já houver um diretório/arquivo
 * real no lugar, move para `<linkPath>.bak-<timestamp>` antes de criar o link.
 */
export async function ensureSymlink(target: string, linkPath: string): Promise<SymlinkResult> {
  await mkdir(path.dirname(linkPath), { recursive: true })
  let result: SymlinkResult = 'created'
  try {
    const stat = await lstat(linkPath)
    if (stat.isSymbolicLink()) {
      if ((await readlink(linkPath)) === target) return 'unchanged'
      await rm(linkPath)
    } else {
      const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      await cp(linkPath, `${linkPath}.bak-${stamp}`, { recursive: true })
      await rm(linkPath, { recursive: true, force: true })
      result = 'backed-up'
    }
  } catch {
    // não existe — cria
  }
  await symlink(target, linkPath)
  return result
}

/**
 * Garante que cada entrada esteja no `.gitignore` do projeto. Entradas ausentes
 * são adicionadas num bloco com `header`. Retorna as entradas adicionadas.
 */
export async function ensureGitignore(
  projectRoot: string,
  header: string,
  entries: string[],
): Promise<string[]> {
  const file = path.join(projectRoot, '.gitignore')
  const current = (await exists(file)) ? await readFile(file, 'utf8') : ''
  const lines = new Set(current.split(/\r?\n/).map((l) => l.trim().replace(/\/$/, '')))
  const missing = entries.filter((e) => !lines.has(e.replace(/\/$/, '')))
  if (missing.length === 0) return []
  const prefix =
    current === '' || current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n'
  await writeFile(file, `${current}${prefix}# ${header}\n${missing.join('\n')}\n`, 'utf8')
  return missing
}
