import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyPath,
  createSpecsWatcher,
  eventKey,
  watchFileRearming,
  type SpecsChangeEvent,
} from './specs-watcher.js'

const DIRS = {
  featuresDir: '.specs/specs',
  discoveriesDir: '.specs/discoveries',
  drawingsDir: '.specs/drawings',
}

describe('classifyPath', () => {
  it('um .md de task invalida o conteúdo e a árvore', () => {
    expect(classifyPath('.specs/specs/minha-feature/task-01.md', DIRS)).toEqual([
      { type: 'content', feature: 'minha-feature', task: 'task-01' },
      { type: 'tree' },
    ])
  })

  it('o meta.json de uma feature invalida só a árvore', () => {
    expect(classifyPath('.specs/specs/minha-feature/meta.json', DIRS)).toEqual([{ type: 'tree' }])
  })

  it('o meta.json raiz invalida a árvore', () => {
    expect(classifyPath('.specs/specs/meta.json', DIRS)).toEqual([{ type: 'tree' }])
  })

  it('um .md de discovery invalida a discovery e a árvore', () => {
    expect(classifyPath('.specs/discoveries/spike-cache.md', DIRS)).toEqual([
      { type: 'discovery', slug: 'spike-cache' },
      { type: 'tree' },
    ])
  })

  it('o config.json invalida a config', () => {
    expect(classifyPath('.specs/config.json', DIRS)).toEqual([{ type: 'config' }])
  })

  it('desenho gera evento de drawing + tree', () => {
    expect(classifyPath('.specs/drawings/fan-out-sns.md', DIRS)).toEqual([
      { type: 'drawing', slug: 'fan-out-sns' },
      { type: 'tree' },
    ])
  })

  it('criar ou remover a pasta de uma feature invalida a árvore', () => {
    expect(classifyPath('.specs/specs/feature-nova', DIRS)).toEqual([{ type: 'tree' }])
  })

  it('ignora arquivos ocultos e temporários de editor', () => {
    expect(classifyPath('.specs/specs/f/.DS_Store', DIRS)).toEqual([])
    expect(classifyPath('.specs/specs/f/task-01.md~', DIRS)).toEqual([])
  })

  it('ignora o runtime da própria plataforma', () => {
    expect(classifyPath('.specs/app/packages/ui/src/main.tsx', DIRS)).toEqual([])
  })

  it('ignora arquivos que não são .md nem meta.json dentro de uma feature', () => {
    expect(classifyPath('.specs/specs/f/diagrama.png', DIRS)).toEqual([])
  })

  it('respeita diretórios customizados no config', () => {
    const custom = {
      featuresDir: 'docs/specs',
      discoveriesDir: 'docs/rfcs',
      drawingsDir: 'docs/desenhos',
    }
    expect(classifyPath('docs/specs/f/t.md', custom)).toEqual([
      { type: 'content', feature: 'f', task: 't' },
      { type: 'tree' },
    ])
    expect(classifyPath('.specs/specs/f/t.md', custom)).toEqual([])
  })
})

describe('eventKey', () => {
  it('separa conteúdos de tasks diferentes', () => {
    expect(eventKey({ type: 'content', feature: 'a', task: 'x' })).not.toBe(
      eventKey({ type: 'content', feature: 'a', task: 'y' }),
    )
  })

  it('colapsa eventos de árvore num só', () => {
    expect(eventKey({ type: 'tree' })).toBe(eventKey({ type: 'tree' }))
  })
})

describe('createSpecsWatcher', () => {
  it('junta várias escritas seguidas num lote deduplicado', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'specs-watch-'))
    const featureDir = path.join(root, '.specs', 'specs', 'f')
    await mkdir(featureDir, { recursive: true })
    await writeFile(path.join(featureDir, 'task-01.md'), 'a', 'utf8')

    const watcher = createSpecsWatcher({ projectRoot: root, ...DIRS, debounceMs: 60 })
    const batches: SpecsChangeEvent[][] = []
    watcher.subscribe((events) => batches.push(events))

    // Três escritas em rajada, como um agent salvando o arquivo.
    await writeFile(path.join(featureDir, 'task-01.md'), 'b', 'utf8')
    await writeFile(path.join(featureDir, 'task-01.md'), 'c', 'utf8')
    await writeFile(path.join(featureDir, 'task-01.md'), 'd', 'utf8')
    await new Promise((r) => setTimeout(r, 400))
    watcher.close()

    if (!watcher.watching) return // SO sem watch recursivo: nada a assertar
    expect(batches.length).toBeGreaterThanOrEqual(1)
    const all = batches.flat()
    expect(all).toContainEqual({ type: 'content', feature: 'f', task: 'task-01' })
    expect(all).toContainEqual({ type: 'tree' })
    // Deduplicado: cada lote traz no máximo um evento por chave.
    for (const batch of batches) {
      expect(new Set(batch.map(eventKey)).size).toBe(batch.length)
    }
  })

  it('close() para de notificar', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'specs-watch-'))
    await mkdir(path.join(root, '.specs', 'specs', 'f'), { recursive: true })
    const watcher = createSpecsWatcher({ projectRoot: root, ...DIRS, debounceMs: 20 })
    let calls = 0
    watcher.subscribe(() => {
      calls += 1
    })
    watcher.close()
    await writeFile(path.join(root, '.specs', 'specs', 'f', 't.md'), 'x', 'utf8')
    await new Promise((r) => setTimeout(r, 200))
    expect(calls).toBe(0)
  })
})

describe('watchFileRearming', () => {
  const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms))

  it('continua vendo escritas depois de um save atômico (tmp + rename)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'specs-file-watch-'))
    const file = path.join(dir, 'usage.json')
    await writeFile(file, '1', 'utf8')

    let changes = 0
    const stop = watchFileRearming(file, () => {
      changes += 1
    })
    await settle(100)

    // Save atômico: troca o inode e mataria um `fs.watch` comum.
    const tmp = `${file}.tmp`
    await writeFile(tmp, '2', 'utf8')
    await rename(tmp, file)
    await settle()
    const afterRename = changes
    expect(afterRename).toBeGreaterThan(0)

    // É esta a regressão: sem re-armar, daqui em diante nada mais é visto.
    await writeFile(file, '3', 'utf8')
    await settle()
    expect(changes).toBeGreaterThan(afterRename)

    stop()
  })

  it('não quebra quando o arquivo ainda não existe', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'specs-file-watch-'))
    const stop = watchFileRearming(path.join(dir, 'nao-existe.json'), () => {})
    await settle(50)
    stop()
  })

  it('stop() para de notificar', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'specs-file-watch-'))
    const file = path.join(dir, 'usage.json')
    await writeFile(file, '1', 'utf8')
    let changes = 0
    const stop = watchFileRearming(file, () => {
      changes += 1
    })
    await settle(100)
    stop()
    await writeFile(file, '2', 'utf8')
    await settle()
    expect(changes).toBe(0)
    await rm(dir, { recursive: true, force: true })
  })
})
