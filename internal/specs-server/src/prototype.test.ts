import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizePrototype } from './config-defaults.js'
import {
  buildDesignPrompt,
  buildSnapshotPrompt,
  resolvePrototype,
  snapshotAbsolutePath,
} from './prototype.js'
import type { SpecsConfig } from './types.js'

function configWith(prototype: SpecsConfig['prototype']): SpecsConfig {
  return { prototype, featuresDir: '.specs/specs' } as unknown as SpecsConfig
}

describe('normalizePrototype', () => {
  it('aceita claude-design com url', () => {
    expect(
      normalizePrototype({ tool: 'claude-design', url: 'https://claude.ai/code/artifact/abc' }),
    ).toEqual({ tool: 'claude-design', url: 'https://claude.ai/code/artifact/abc' })
  })

  it('aceita pencil com file', () => {
    expect(normalizePrototype({ tool: 'pencil', file: 'design/app.pen' })).toEqual({
      tool: 'pencil',
      file: 'design/app.pen',
    })
  })

  it('descarta declarações incompletas ou desconhecidas', () => {
    expect(normalizePrototype({ tool: 'claude-design' })).toBeNull()
    expect(normalizePrototype({ tool: 'pencil' })).toBeNull()
    expect(normalizePrototype({ tool: 'figma', url: 'x' })).toBeNull()
    expect(normalizePrototype(null)).toBeNull()
  })
})

describe('resolvePrototype', () => {
  it('devolve null quando o projeto não declara protótipo', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'specs-proto-'))
    expect(await resolvePrototype(root, configWith(null))).toBeNull()
  })

  it('usa o default do projeto quando a feature não sobrescreve', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'specs-proto-'))
    await mkdir(path.join(root, '.specs/specs/login'), { recursive: true })
    await writeFile(path.join(root, '.specs/specs/login/meta.json'), '{"title":"Login"}')
    const config = configWith({ tool: 'claude-design', url: 'https://claude.ai/x' })
    const resolved = await resolvePrototype(root, config, 'login')
    expect(resolved).toMatchObject({ tool: 'claude-design', source: 'config' })
  })

  it('a feature sobrescreve a ferramenta do projeto', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'specs-proto-'))
    await mkdir(path.join(root, '.specs/specs/login'), { recursive: true })
    await writeFile(
      path.join(root, '.specs/specs/login/meta.json'),
      JSON.stringify({ prototype: { tool: 'pencil', file: 'design/login.pen' } }),
    )
    const config = configWith({ tool: 'claude-design', url: 'https://claude.ai/x' })
    const resolved = await resolvePrototype(root, config, 'login')
    expect(resolved).toMatchObject({ tool: 'pencil', source: 'feature', feature: 'login' })
    expect(resolved?.fileExists).toBe(false)
  })

  it('marca o .pen existente no disco', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'specs-proto-'))
    await mkdir(path.join(root, 'design'), { recursive: true })
    await writeFile(path.join(root, 'design/app.pen'), 'x')
    const resolved = await resolvePrototype(
      root,
      configWith({ tool: 'pencil', file: 'design/app.pen' }),
    )
    expect(resolved?.fileExists).toBe(true)
    expect(resolved?.filePath).toBe(path.join(root, 'design/app.pen'))
  })
})

describe('buildDesignPrompt', () => {
  it('usa /design no Claude Design e leva o contexto da task', () => {
    const prompt = buildDesignPrompt(
      {
        tool: 'claude-design',
        title: 'Finance',
        url: 'https://claude.ai/code/artifact/abc',
        designDir: 'design/finance',
        source: 'config',
      },
      'trocar os KPIs por 3 cards',
      { feature: 'finance', task: 'feat-finance-ui', specPath: '.specs/specs/finance/x.md' },
    )
    expect(prompt.startsWith('/design ')).toBe(true)
    expect(prompt).toContain('https://claude.ai/code/artifact/abc')
    expect(prompt).toContain('design/finance/README.md')
    expect(prompt).toContain('feat-finance-ui')
  })

  it('instrui o Pencil MCP e proíbe leitura direta do .pen', () => {
    const prompt = buildDesignPrompt(
      { tool: 'pencil', file: 'design/app.pen', source: 'config' },
      'aumentar o espaçamento',
    )
    expect(prompt.startsWith('/design')).toBe(false)
    expect(prompt).toContain('design/app.pen')
    expect(prompt).toContain('Pencil MCP')
    expect(prompt).toContain('node IDs')
  })
})

describe('snapshot local', () => {
  it('acha o snapshot default dentro do designDir', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'specs-proto-'))
    await mkdir(path.join(root, 'design/finance'), { recursive: true })
    await writeFile(path.join(root, 'design/finance/canvas.html'), '<html></html>')
    const resolved = await resolvePrototype(
      root,
      configWith({
        tool: 'claude-design',
        url: 'https://claude.ai/x',
        designDir: 'design/finance',
      }),
    )
    expect(resolved?.snapshotPath).toBe('design/finance/canvas.html')
    expect(resolved?.snapshotExists).toBe(true)
    expect(snapshotAbsolutePath(root, resolved!)).toBe(
      path.join(root, 'design/finance/canvas.html'),
    )
  })

  it('marca ausente quando o arquivo não existe e recusa servi-lo', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'specs-proto-'))
    const resolved = await resolvePrototype(
      root,
      configWith({
        tool: 'claude-design',
        url: 'https://claude.ai/x',
        designDir: 'design/finance',
      }),
    )
    expect(resolved?.snapshotExists).toBe(false)
    expect(snapshotAbsolutePath(root, resolved!)).toBeNull()
  })

  it('respeita o caminho declarado em `snapshot`', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'specs-proto-'))
    await mkdir(path.join(root, 'docs'), { recursive: true })
    await writeFile(path.join(root, 'docs/proto.html'), '<html></html>')
    const resolved = await resolvePrototype(
      root,
      configWith({
        tool: 'claude-design',
        url: 'https://claude.ai/x',
        designDir: 'design/finance',
        snapshot: 'docs/proto.html',
      }),
    )
    expect(resolved?.snapshotPath).toBe('docs/proto.html')
    expect(resolved?.snapshotExists).toBe(true)
  })
})

describe('buildSnapshotPrompt', () => {
  it('manda ler o canvas e gravar no caminho do snapshot', () => {
    const prompt = buildSnapshotPrompt({
      tool: 'claude-design',
      url: 'https://claude.ai/code/artifact/abc',
      snapshotPath: 'design/finance/canvas.html',
      source: 'config',
    })
    expect(prompt).toContain('https://claude.ai/code/artifact/abc')
    expect(prompt).toContain('design/finance/canvas.html')
  })

  it('é o prompt usado quando o intent é snapshot', () => {
    const viaIntent = buildDesignPrompt(
      { tool: 'claude-design', url: 'https://x', snapshotPath: 'a/b.html', source: 'config' },
      'ignorado',
      {},
      'snapshot',
    )
    expect(viaIntent).toContain('a/b.html')
    expect(viaIntent.startsWith('/design')).toBe(false)
  })
})
