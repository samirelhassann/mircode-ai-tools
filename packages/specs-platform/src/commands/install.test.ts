import { lstat, mkdir, mkdtemp, readFile, readlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { exists } from '@mir-code/toolkit-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runInstall } from './install.js'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'specs-install-'))
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

const at = (...p: string[]) => path.join(root, ...p)

describe('runInstall', () => {
  it('instala o scaffold completo num projeto vazio', async () => {
    const result = await runInstall({ projectRoot: root })

    expect(result).toEqual({ fresh: true, legacyAppDir: false })
    for (const file of [
      '.agents/project.md',
      '.agents/agents/feature-runner.md',
      '.agents/skills/spec-writing/SKILL.md',
      '.agents/scripts/validate-spec.mjs',
      '.specs/config.json',
      '.specs/specs/meta.json',
      '.specs/specs/exemplo/meta.json',
      '.specs/specs/_templates/task-backend.md',
      '.specs/discoveries/meta.json',
      '.specs/drawings/meta.json',
      'SPECS.md',
    ]) {
      expect(await exists(at(file)), file).toBe(true)
    }
    expect(await readlink(at('.claude', 'skills'))).toBe('../.agents/skills')
    expect((await lstat(at('.cursor', 'agents'))).isSymbolicLink()).toBe(true)
    expect(await readFile(at('.gitignore'), 'utf8')).toContain('.specs/.run/')
  })

  it('na atualização regrava skills mas preserva o que o projeto customizou', async () => {
    await runInstall({ projectRoot: root })
    await writeFile(at('.agents', 'project.md'), 'meu projeto')
    await writeFile(at('.agents', 'skills', 'spec-writing', 'SKILL.md'), 'editado à mão')
    await mkdir(at('.agents', 'skills', 'minha-skill'), { recursive: true })
    await writeFile(at('.specs', 'specs', 'meta.json'), '{"title":"Specs","pages":[]}')

    const result = await runInstall({ projectRoot: root })

    expect(result.fresh).toBe(false)
    expect(await readFile(at('.agents', 'project.md'), 'utf8')).toBe('meu projeto')
    expect(await readFile(at('.agents', 'skills', 'spec-writing', 'SKILL.md'), 'utf8')).not.toBe(
      'editado à mão',
    )
    expect(await exists(at('.agents', 'skills', 'minha-skill'))).toBe(true)
    expect(await readFile(at('.specs', 'specs', 'meta.json'), 'utf8')).toContain('"pages":[]')
  })

  it('detecta e remove o .specs/app/ legado só com cleanLegacy', async () => {
    await mkdir(at('.specs', 'app', 'packages'), { recursive: true })

    expect((await runInstall({ projectRoot: root })).legacyAppDir).toBe(true)
    expect(await exists(at('.specs', 'app'))).toBe(true)

    await runInstall({ projectRoot: root, cleanLegacy: true })
    expect(await exists(at('.specs', 'app'))).toBe(false)
  })
})
