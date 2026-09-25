import GithubSlugger from 'github-slugger'
import type { Heading } from './types.js'

/**
 * Extrai headings markdown do body. Usa regex por linha para respeitar code fences
 * (linhas dentro de ``` ... ``` são ignoradas).
 */
export function extractHeadings(body: string): Heading[] {
  const slugger = new GithubSlugger()
  const lines = body.split(/\r?\n/)
  const out: Heading[] = []
  let inFence = false
  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (!match) continue
    const level = match[1]!.length
    // remove trailing hashes (ATX closing) e espaços
    const text = match[2]!.replace(/\s+#+\s*$/, '').trim()
    const id = slugger.slug(text)
    out.push({ id, text, level })
  }
  return out
}
