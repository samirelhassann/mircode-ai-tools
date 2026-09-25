#!/usr/bin/env node
/**
 * Valida a mensagem de commit no formato definido em .agents/project.md:
 *
 *   <type>(<escopo>): <título da task>
 *
 *   Refs: .specs/specs/<slug>/feat-<slug>-<task>.md     (opcional, mas exigido em task de spec)
 *   Task status: in-progress -> completed
 *
 * Uso:
 *   node .agents/scripts/check-commit.mjs --message "feat(login): tela de login"
 *   node .agents/scripts/check-commit.mjs --file .git/COMMIT_EDITMSG
 *
 * Como guarda de git (opcional, uma vez, a partir da raiz do repo):
 *   printf '#!/bin/sh\nnode .agents/scripts/check-commit.mjs --file "$1"\n' > .git/hooks/commit-msg
 *   chmod +x .git/hooks/commit-msg
 */

import { readFileSync } from 'node:fs'

const TYPES = ['feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'infra', 'build', 'ci', 'perf', 'style']
const MAX_SUBJECT = 100

const args = process.argv.slice(2)
function arg(name) {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}

let message = arg('--message')
const file = arg('--file')
if (file) message = readFileSync(file, 'utf8')
if (!message) {
  console.error('uso: check-commit.mjs --message "<msg>" | --file <caminho>')
  process.exit(2)
}

const lines = message.split('\n').filter((l) => !l.startsWith('#'))
const subject = (lines[0] ?? '').trim()
const errors = []
const warnings = []

const m = subject.match(/^([a-z]+)(\(([a-z0-9][a-z0-9-]*)\))?(!)?: (.+)$/)
if (!m) {
  errors.push(
    'assunto fora do formato `<type>(<escopo>): <descrição>` — escopo em kebab-case minúsculo',
  )
} else {
  const [, type, , scope, , description] = m
  if (!TYPES.includes(type)) errors.push(`tipo \`${type}\` inválido — use: ${TYPES.join(', ')}`)
  if (!scope) warnings.push('sem escopo — prefira `<type>(<slug-da-feature>): ...`')
  if (description.endsWith('.')) errors.push('descrição não termina com ponto final')
  if (/^[A-Z]/.test(description) && !/^[A-Z]{2,}/.test(description))
    warnings.push('descrição começa com maiúscula — prefira minúscula, salvo sigla')
  if (subject.length > MAX_SUBJECT)
    errors.push(`assunto com ${subject.length} caracteres (máximo ${MAX_SUBJECT})`)
}

if (lines.length > 1 && lines[1].trim() !== '')
  errors.push('falta a linha em branco entre o assunto e o corpo')

const body = lines.slice(1).join('\n')
if (/BREAKING CHANGE/.test(body) && !/^[a-z]+(\([a-z0-9-]+\))?!:/.test(subject))
  errors.push('corpo traz `BREAKING CHANGE:` mas o assunto não tem o `!` depois do tipo/escopo')

for (const e of errors) console.error(`ERRO  ${e}`)
for (const w of warnings) console.error(`aviso ${w}`)
if (errors.length === 0 && warnings.length === 0) console.log('mensagem de commit OK')

process.exit(errors.length > 0 ? 1 : 0)
