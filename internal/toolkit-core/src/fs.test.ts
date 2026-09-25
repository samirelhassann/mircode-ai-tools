import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { copyIfAbsent, ensureGitignore, ensureSymlink } from './fs.js'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'toolkit-core-'))
})

describe('copyIfAbsent', () => {
  it('preserva o destino existente, salvo com force', async () => {
    const src = path.join(root, 'src.txt')
    const dest = path.join(root, 'nested', 'dest.txt')
    await writeFile(src, 'novo')

    expect(await copyIfAbsent(src, dest)).toBe(true)
    await writeFile(dest, 'customizado')
    expect(await copyIfAbsent(src, dest)).toBe(false)
    expect(await readFile(dest, 'utf8')).toBe('customizado')

    expect(await copyIfAbsent(src, dest, true)).toBe(true)
    expect(await readFile(dest, 'utf8')).toBe('novo')
  })
})

describe('ensureSymlink', () => {
  it('cria, reconhece link existente e faz backup de diretório real', async () => {
    const link = path.join(root, '.claude', 'skills')
    expect(await ensureSymlink('../.agents/skills', link)).toBe('created')
    expect(await ensureSymlink('../.agents/skills', link)).toBe('unchanged')

    const real = path.join(root, '.cursor', 'skills')
    await mkdir(real, { recursive: true })
    await writeFile(path.join(real, 'mine.md'), 'x')
    expect(await ensureSymlink('../.agents/skills', real)).toBe('backed-up')
    expect((await lstat(real)).isSymbolicLink()).toBe(true)
    expect(await readlink(real)).toBe('../.agents/skills')
    const backups = (await readdir(path.join(root, '.cursor'))).filter((f) =>
      f.startsWith('skills.bak-'),
    )
    expect(backups).toHaveLength(1)
  })
})

describe('ensureGitignore', () => {
  it('adiciona só as entradas ausentes, num bloco com cabeçalho', async () => {
    await writeFile(path.join(root, '.gitignore'), 'node_modules\n.specs/.run\n')
    const added = await ensureGitignore(root, 'Specs', ['.specs/.jobs.json', '.specs/.run/'])
    expect(added).toEqual(['.specs/.jobs.json'])
    expect(await readFile(path.join(root, '.gitignore'), 'utf8')).toBe(
      'node_modules\n.specs/.run\n\n# Specs\n.specs/.jobs.json\n',
    )
    expect(await ensureGitignore(root, 'Specs', ['.specs/.jobs.json'])).toEqual([])
  })

  it('cria o .gitignore se não existir', async () => {
    await ensureGitignore(root, 'Specs', ['.specs/.run/'])
    expect(await readFile(path.join(root, '.gitignore'), 'utf8')).toBe('# Specs\n.specs/.run/\n')
  })
})
