#!/usr/bin/env node
/**
 * pnpm não preserva o bit de execução do `spawn-helper` pré-buildado do node-pty
 * ao copiar para o store, o que faz o posix_spawnp falhar em runtime.
 * Este script garante chmod +x em todos os binários relevantes após install.
 *
 * Roda como postinstall do @mir-code/specs-platform.
 */
const { chmodSync, existsSync, readdirSync, statSync } = require('node:fs')
const { join, resolve } = require('node:path')

function walk(dir, visit) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, visit)
    else visit(full)
  }
}

function findNodePty(fromDir) {
  // Sobe diretórios procurando node_modules/node-pty
  let dir = fromDir
  const candidates = []
  for (let i = 0; i < 6; i++) {
    const direct = join(dir, 'node_modules', 'node-pty')
    if (existsSync(direct)) candidates.push(direct)
    // pnpm store layout — procurar em .pnpm/node-pty@*
    const pnpmDir = join(dir, 'node_modules', '.pnpm')
    if (existsSync(pnpmDir)) {
      for (const entry of readdirSync(pnpmDir)) {
        if (entry.startsWith('node-pty@')) {
          const maybe = join(pnpmDir, entry, 'node_modules', 'node-pty')
          if (existsSync(maybe)) candidates.push(maybe)
        }
      }
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return candidates
}

function fix(base) {
  const prebuilds = join(base, 'prebuilds')
  if (!existsSync(prebuilds)) return
  walk(prebuilds, (file) => {
    const name = file.split('/').pop()
    if (name === 'spawn-helper') {
      try {
        const st = statSync(file)
        if ((st.mode & 0o111) === 0) {
          chmodSync(file, 0o755)
          console.log(`[fix-node-pty-perms] chmod +x ${file}`)
        }
      } catch (err) {
        console.warn(`[fix-node-pty-perms] falhou em ${file}: ${err.message}`)
      }
    }
  })
}

try {
  const bases = findNodePty(__dirname)
  if (bases.length === 0) {
    console.warn('[fix-node-pty-perms] node-pty não encontrado — ignorando.')
    process.exit(0)
  }
  for (const b of bases) fix(b)
} catch (err) {
  console.warn(`[fix-node-pty-perms] erro: ${err.message}`)
}
