import { describe, expect, it } from 'vitest'
import { detectInstallMode, installCommand, isOutdated, parseGlobalList } from './update.js'

describe('detectInstallMode', () => {
  it('npm global', () => {
    expect(detectInstallMode('/Users/me/.npm-global/lib/node_modules/@mir-code/ai-tools')).toBe(
      'npm',
    )
  })

  it('pnpm global (caminho real dentro do .pnpm)', () => {
    expect(
      detectInstallMode(
        '/Users/me/Library/pnpm/global/5/.pnpm/@mir-code+ai-tools@1.0.0/node_modules/@mir-code/ai-tools',
      ),
    ).toBe('pnpm')
  })

  it('link de desenvolvimento aponta para o repo, fora de node_modules', () => {
    expect(detectInstallMode('/Users/me/mircode/mircode-ai-tools/packages/ai-tools')).toBe('linked')
  })
})

describe('parseGlobalList', () => {
  it('lê o objeto do `npm ls -g --json`', () => {
    const json = JSON.stringify({
      name: 'lib',
      dependencies: {
        '@mir-code/ai-tools': { version: '1.0.0' },
        '@mir-code/specs-platform': { version: '1.0.1' },
      },
    })
    expect(parseGlobalList(json)).toEqual(
      new Map([
        ['@mir-code/ai-tools', '1.0.0'],
        ['@mir-code/specs-platform', '1.0.1'],
      ]),
    )
  })

  it('lê o array do `pnpm ls -g --json`', () => {
    const json = JSON.stringify([
      { path: '/x', dependencies: { '@mir-code/ai-tools': { version: '1.2.0' } } },
    ])
    expect(parseGlobalList(json).get('@mir-code/ai-tools')).toBe('1.2.0')
  })

  it('sem pacotes globais', () => {
    expect(parseGlobalList('{}').size).toBe(0)
  })
})

describe('isOutdated', () => {
  it('só quando o npm respondeu e a versão difere', () => {
    expect(isOutdated({ name: 'a', installed: '1.0.0', latest: '1.1.0' })).toBe(true)
    expect(isOutdated({ name: 'a', installed: '1.1.0', latest: '1.1.0' })).toBe(false)
    expect(isOutdated({ name: 'a', installed: '1.0.0', latest: null })).toBe(false)
  })
})

describe('installCommand', () => {
  it('usa o mesmo gerenciador da instalação, sempre com @latest', () => {
    expect(installCommand('npm', ['@mir-code/ai-tools'])).toEqual([
      'npm',
      'install',
      '-g',
      '@mir-code/ai-tools@latest',
    ])
    expect(installCommand('pnpm', ['@mir-code/ai-tools', '@mir-code/specs-platform'])).toEqual([
      'pnpm',
      'add',
      '-g',
      '@mir-code/ai-tools@latest',
      '@mir-code/specs-platform@latest',
    ])
  })
})
