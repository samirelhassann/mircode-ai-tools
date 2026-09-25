#!/usr/bin/env node
/**
 * Validador estrutural das specs de `.specs/specs/`.
 *
 * Checa por código o que hoje só é lembrado: frontmatter, ordem das seções, diagrama Mermaid,
 * blocos <details>, critérios de aceite em EARS, IDs de requisito, tabela de premissas e
 * consistência com o `meta.json` da feature.
 *
 * Uso:
 *   node .agents/scripts/validate-spec.mjs <arquivo.md|pasta-da-feature> [--strict]
 *   node .agents/scripts/validate-spec.mjs --all [--strict]
 *
 * `--strict` promove os avisos a erros. Saída != 0 significa: pare e corrija.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, basename, dirname, resolve } from 'node:path'

const STATUSES = ['pending', 'in-progress', 'completed', 'blocked']
const TASK_SECTIONS = [
  '## Contexto da alteração',
  '## Visão Técnica',
  '## Escopo',
  '## Code Review Checklist',
]
const CLASS_DEFS = ['classDef changed', 'classDef added', 'classDef removed', 'classDef untouched']
const EARS_KEYWORDS = /(^|\s)(QUANDO|ENQUANTO|ONDE|SE)\s/
const REQ_ID = /^\*\*[A-Z][A-Z0-9]*(-[A-Z0-9]+)*-\d{2}\*\*/

// Heurística: pistas de que a linha descreve estrutura interna em vez de comportamento
// observável. Só gera aviso — "a estrutura é a entrega" é exceção legítima (ver a skill
// `requirements-closure`, seção "O que é critério de aceite, e o que não é").
// Extensões que contam como "path de código" neste repositório.
// Ajuste aqui ao portar — o valor espelha a seção "Documentação e processo" de .agents/project.md.
const CODE_EXTENSIONS = ['ts', 'tsx', 'prisma', 'json', 'http']
const CODE_PATH_RE = new RegExp('`[^`]*\\/[^`]*\\.(' + CODE_EXTENSIONS.join('|') + ')`')

const STRUCTURAL_HINTS = [
  { re: CODE_PATH_RE, why: 'cita path de arquivo' },
  { re: /\b(DTO|Schema|Interface|Repository|UseCase|Adapter|Controller)\b/, why: 'nomeia artefato interno' },
  { re: /`\.(strict|transform|refine|parse)\(\)`/, why: 'cita chamada de implementação' },
  { re: /\b(private readonly|setter|getter|índice novo|index novo|backfill)\b/i, why: 'descreve decisão de estrutura' },
]
/** Verbos que indicam comportamento observável — se houver um, a linha provavelmente é critério. */
const BEHAVIOR_VERBS =
  /\b(responde[r]?|retorna[r]?|exibe|exibir|persiste|persistir|grava[r]?|rejeita[r]?|bloqueia[r]?|redireciona[r]?|mantém|manter|cobra[r]?|envia[r]?|registra[r]?)\b/i

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const targets = args.filter((a) => !a.startsWith('--'))
const all = args.includes('--all')

/** Um achado de validação, ligado à linha que o originou. */
class Report {
  constructor(file) {
    this.file = file
    this.errors = []
    this.warnings = []
  }
  err(line, msg) {
    this.errors.push({ line, msg })
  }
  warn(line, msg) {
    ;(strict ? this.errors : this.warnings).push({ line, msg })
  }
}

function parseFrontmatter(lines, r) {
  if (lines[0] !== '---') {
    r.err(1, 'arquivo não começa com frontmatter `---`')
    return { data: {}, bodyStart: 0 }
  }
  const end = lines.indexOf('---', 1)
  if (end === -1) {
    r.err(1, 'frontmatter sem fechamento `---`')
    return { data: {}, bodyStart: 0 }
  }
  const data = {}
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^(\w+):\s*(.*)$/)
    if (m) data[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return { data, bodyStart: end + 1 }
}

function checkFrontmatter(data, r, isOverview) {
  if (!data.title) r.err(2, 'frontmatter sem `title`')
  if (!data.description) r.err(2, 'frontmatter sem `description`')
  if (isOverview) {
    if (data.status) r.err(2, '`overview.md` não pode ter `status` — não é uma task')
    return
  }
  if (!data.status) r.err(2, 'frontmatter sem `status`')
  else if (!STATUSES.includes(data.status))
    r.err(2, `status \`${data.status}\` inválido — use ${STATUSES.join(' | ')}`)
}

function checkNoH1(lines, bodyStart, r) {
  let inFence = false
  for (let i = bodyStart; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) inFence = !inFence
    if (!inFence && /^# \S/.test(lines[i]))
      r.err(i + 1, 'H1 no corpo — o `title` do frontmatter já vira o <h1> da página')
  }
}

function checkSections(lines, r, isOverview) {
  const headings = []
  let inFence = false
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) inFence = !inFence
    if (!inFence && /^## /.test(l)) headings.push({ text: l.trim(), line: i + 1 })
  })
  const texts = headings.map((h) => h.text)

  if (isOverview) {
    for (const s of ['## O que será feito', '## Visão Técnica'])
      if (!texts.includes(s)) r.err(0, `overview sem a seção \`${s}\``)
    return
  }

  for (const s of TASK_SECTIONS) if (!texts.includes(s)) r.err(0, `falta a seção \`${s}\``)

  // Ordem relativa das seções obrigatórias (ignora `## Execuções`, que vem no fim).
  const idx = TASK_SECTIONS.map((s) => texts.indexOf(s)).filter((i) => i !== -1)
  for (let i = 1; i < idx.length; i++)
    if (idx[i] < idx[i - 1]) {
      r.err(0, `seções fora de ordem — a ordem fixa é: ${TASK_SECTIONS.join(' → ')}`)
      break
    }

  for (const banned of ['## Critérios de Aceite', '## Detalhes Técnicos', '## Testes', '## Dependências'])
    if (texts.includes(banned))
      r.err(
        headings.find((h) => h.text === banned).line,
        `\`${banned}\` não existe como seção de primeiro nível — vive dentro de um bloco <details>`,
      )

  const body = lines.join('\n')
  if (!body.includes('**Depende de:**'))
    r.err(0, 'Contexto da alteração não termina com a lista `**Depende de:**`')
  if (!texts.includes('## Escopo') || !body.includes('### Fora de escopo'))
    r.err(0, 'falta `### Fora de escopo` dentro de `## Escopo`')
  if (!body.includes('### O que muda, em resumo'))
    r.err(0, 'falta `### O que muda, em resumo` na Visão Técnica')
  if (!body.includes('### Detalhamento técnico'))
    r.err(0, 'falta `### Detalhamento técnico` na Visão Técnica')
}

function checkMermaid(lines, r) {
  const start = lines.findIndex((l) => /^\s*```mermaid/.test(l))
  if (start === -1) {
    r.err(0, 'sem diagrama Mermaid na Visão Técnica (obrigatório)')
    return
  }
  const end = lines.findIndex((l, i) => i > start && /^\s*```\s*$/.test(l))
  const block = lines.slice(start, end === -1 ? lines.length : end).join('\n')
  for (const cd of CLASS_DEFS)
    if (!block.includes(cd)) r.err(start + 1, `diagrama sem \`${cd}\``)
  const after = lines.slice(end + 1, end + 4).join('\n')
  if (!after.includes('🟡') || !after.includes('⚪'))
    r.warn(end + 2, 'sem a linha de legenda `> 🟡 alterado · 🟢 adicionado · 🔴 removido · ⚪ inalterado (contexto)`')
}

/** Percorre os blocos <details>, validando forma e conteúdo de cada um. */
function checkDetails(lines, r) {
  const blocks = []
  let open = null
  lines.forEach((l, i) => {
    const t = l.trim()
    if (t === '<details>') {
      if (open !== null) r.err(i + 1, '<details> aninhado ou anterior não fechado')
      open = { start: i, summary: null, summaryLine: null }
    } else if (t.startsWith('<summary>') && open) {
      open.summary = t.replace(/<\/?summary>/g, '').trim()
      open.summaryLine = i
      if (lines[i + 1]?.trim() !== '')
        r.err(i + 2, 'falta a linha em branco depois de `</summary>` — o markdown interno não é interpretado')
    } else if (t === '</details>' && open) {
      if (lines[i - 1]?.trim() !== '')
        r.err(i, 'falta a linha em branco antes de `</details>`')
      open.end = i
      blocks.push(open)
      open = null
    } else if (open && /^\s*#{1,6} /.test(l)) {
      r.err(i + 1, 'heading markdown dentro de <details> — use **negrito** para subtítulo interno')
    }
  })
  if (open !== null) r.err(open.start + 1, '<details> sem `</details>`')
  return blocks
}

function checkCriteria(lines, blocks, r) {
  let total = 0
  for (const b of blocks) {
    const summary = (b.summary || '').toLowerCase()
    if (summary.startsWith('dd/') || /^\d{2}\/\d{2}\/\d{4}/.test(b.summary || '')) continue // Execuções
    const isAssumptions = summary.includes('premissa')
    const isTests = summary.includes('teste')

    for (let i = b.start; i < b.end; i++) {
      const line = lines[i]
      const m = line.match(/^\s*- \[[ x]\]\s+(.*)$/)
      if (!m) continue
      total++
      const text = m[1].trim()
      if (text === '...' || text === '') continue // template não preenchido: ignorado aqui
      const withoutId = text.replace(REQ_ID, '').trim()
      // Só acusa quando a linha claramente tenta ser um ID (`**ALGO-12**`), não em negrito comum.
      if (/^\*\*[A-Z][A-Z0-9-]*\d+\*\*/.test(text) && !REQ_ID.test(text))
        r.warn(i + 1, 'ID de requisito fora do formato `**CATEGORIA-NN**`')
      if (!isTests && !/\bDEVE\b/.test(withoutId))
        r.warn(i + 1, 'critério sem `DEVE` — não está em EARS (QUANDO/ENQUANTO/ONDE/SE ... DEVE)')
      else if (!isTests && !EARS_KEYWORDS.test(withoutId) && !/^O sistema DEVE/i.test(withoutId))
        r.warn(i + 1, 'critério com `DEVE` mas sem padrão EARS reconhecível (QUANDO/ENQUANTO/ONDE/SE ou ubíquo)')

      // Estrutura interna sem verbo de comportamento: provavelmente é nota de implementação,
      // que mora na Code Review Checklist. Um único aviso por linha, com a pista encontrada.
      if (!isTests && !BEHAVIOR_VERBS.test(withoutId)) {
        const hint = STRUCTURAL_HINTS.find((h) => h.re.test(withoutId))
        if (hint)
          r.warn(
            i + 1,
            `parece nota de implementação (${hint.why}) — se não quebra ao refatorar sem mudar comportamento, mova para a Code Review Checklist`,
          )
      }
    }

    if (isAssumptions) {
      const body = lines.slice(b.start, b.end)
      if (!body.some((l) => l.includes('**Questões em aberto:**')))
        r.err(b.summaryLine + 1, 'bloco de premissas sem a linha `**Questões em aberto:**`')
      for (let i = 0; i < body.length; i++) {
        const l = body[i].trim()
        if (!l.startsWith('|') || /^\|[\s|:-]+\|$/.test(l)) continue
        const cells = l.split('|').slice(1, -1).map((c) => c.trim())
        if (cells.length >= 4 && !/premissa|decis/i.test(cells[0]) && cells.some((c) => c === ''))
          r.err(b.start + i + 1, 'linha de premissa com célula vazia — default e racional são obrigatórios')
      }
    }

    if (isTests) {
      const body = lines.slice(b.start, b.end).join('\n')
      if (!/\*\*Tipo:\*\*/.test(body) || !/\*\*Gate:\*\*/.test(body))
        r.warn(b.summaryLine + 1, 'bloco de Testes sem `**Tipo:**` e `**Gate:**` (ver skill `test-strategy`)')
    }
  }
  if (total === 0) r.err(0, 'nenhum critério de aceite (`- [ ]`) encontrado nos blocos <details>')
  return blocks.map((b) => (b.summary || '').toLowerCase())
}

function checkMetaJson(file, r) {
  const dir = dirname(resolve(file))
  const metaPath = join(dir, 'meta.json')
  const name = basename(file, '.md')
  if (name === 'overview') return
  if (!existsSync(metaPath)) {
    r.err(0, `feature sem \`meta.json\` em ${dir}`)
    return
  }
  let meta
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch (e) {
    r.err(0, `meta.json inválido: ${e.message}`)
    return
  }
  if (!Array.isArray(meta.pages)) {
    r.err(0, 'meta.json sem array `pages`')
    return
  }
  if (!meta.pages.includes(name))
    r.err(0, `\`${name}\` não está em \`pages\` do meta.json — a página não aparece na sidebar`)
  const slug = basename(dir)
  if (!name.startsWith(`feat-${slug}-`))
    r.warn(0, `nome do arquivo fora do padrão \`feat-${slug}-<task>.md\``)
}

function validateFile(file) {
  const r = new Report(file)
  const raw = readFileSync(file, 'utf8')
  const lines = raw.split('\n')
  const isOverview = basename(file) === 'overview.md'

  const { data, bodyStart } = parseFrontmatter(lines, r)
  checkFrontmatter(data, r, isOverview)
  checkNoH1(lines, bodyStart, r)
  checkSections(lines, r, isOverview)
  checkMermaid(lines, r)
  const blocks = checkDetails(lines, r)
  if (!isOverview) {
    const summaries = checkCriteria(lines, blocks, r)
    if (!summaries.some((s) => s.includes('teste')))
      r.warn(0, 'sem bloco <details> de Testes')
    if (!summaries.some((s) => s.includes('premissa')))
      r.warn(0, 'sem bloco <details> de Premissas e questões em aberto (ver skill `requirements-closure`)')
    checkMetaJson(file, r)
  }
  return r
}

function collect(target) {
  const p = resolve(target)
  if (!existsSync(p)) {
    console.error(`caminho não encontrado: ${target}`)
    process.exit(2)
  }
  if (statSync(p).isFile()) return [p]
  return readdirSync(p)
    .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md')
    .map((f) => join(p, f))
}

const specsRoot = resolve('.specs/specs')
let files = []
if (all) {
  for (const d of readdirSync(specsRoot)) {
    const full = join(specsRoot, d)
    if (d.startsWith('_') || !statSync(full).isDirectory()) continue
    files.push(...collect(full))
  }
} else if (targets.length === 0) {
  console.error('uso: node .agents/scripts/validate-spec.mjs <arquivo|pasta> [--strict] | --all')
  process.exit(2)
} else {
  for (const t of targets) files.push(...collect(t))
}

let errors = 0
let warnings = 0
for (const f of files) {
  const r = validateFile(f)
  errors += r.errors.length
  warnings += r.warnings.length
  if (r.errors.length || r.warnings.length) {
    console.log(`\n${f.replace(`${process.cwd()}/`, '')}`)
    for (const e of r.errors) console.log(`  ERRO  ${e.line ? `L${e.line}: ` : ''}${e.msg}`)
    for (const w of r.warnings) console.log(`  aviso ${w.line ? `L${w.line}: ` : ''}${w.msg}`)
  }
}

console.log(
  `\n${files.length} arquivo(s) · ${errors} erro(s) · ${warnings} aviso(s)${strict ? ' (--strict)' : ''}`,
)
process.exit(errors > 0 ? 1 : 0)
