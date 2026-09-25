function normalize(text: string): string {
  return text
    .replace(/[*_`]/g, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Remove o primeiro H1 do body quando ele repete o title do frontmatter,
 * evitando o título duplicado na página.
 */
export function stripDuplicateTitle(body: string, title?: string): string {
  if (!title) return body
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (line.trim() === '') continue
    const match = /^#\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) return body
    if (normalize(match[1] ?? '') !== normalize(title)) return body
    const rest = lines.slice(i + 1)
    while (rest.length > 0 && (rest[0] ?? '').trim() === '') rest.shift()
    return rest.join('\n')
  }
  return body
}

const TITLE_SEPARATORS = ['—', '–', '-', ':', '·']
const SEPARATOR_SPLIT = /[—–:·]|\s-\s/

/**
 * Prefixos da feature que valem como redundância no título da tarefa: o título inteiro
 * e cada trecho inicial dele. "Login — Autenticação" cobre "Login" e "Login — Autenticação".
 */
function featureAliases(featureTitle: string): Set<string> {
  const parts = featureTitle
    .split(SEPARATOR_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean)
  const aliases = new Set<string>([normalize(featureTitle)])
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc} ${part}` : part
    aliases.add(normalize(acc))
  }
  return aliases
}

/**
 * Remove do título da tarefa o prefixo que repete o título da feature, já exibido
 * acima como sobretítulo. "Login — Frontend" na feature "Login" vira "Frontend".
 */
export function stripFeaturePrefix(title: string, featureTitle?: string): string {
  if (!featureTitle) return title
  const aliases = featureAliases(featureTitle)
  aliases.delete('')
  if (aliases.size === 0) return title
  for (const separator of TITLE_SEPARATORS) {
    const index = title.indexOf(separator)
    if (index <= 0) continue
    const prefix = title.slice(0, index)
    if (!aliases.has(normalize(prefix))) continue
    const rest = title.slice(index + separator.length).trim()
    if (rest) return rest
  }
  return title
}
