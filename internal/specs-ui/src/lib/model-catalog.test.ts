import { describe, expect, it } from 'vitest'
import {
  compareModels,
  contextFromLabel,
  parseModelId,
  resolveModelInfo,
  tierOf,
} from './model-catalog'

describe('parseModelId', () => {
  it('reconhece o alias simples do Claude Code', () => {
    expect(parseModelId('opus')).toMatchObject({ base: 'opus', effort: null, thinking: false })
  })

  it('descasca esforço, thinking e fast do id do cursor', () => {
    expect(parseModelId('claude-opus-5-thinking-xhigh-fast')).toMatchObject({
      base: 'claude-opus-5',
      effort: 'xhigh',
      thinking: true,
      fast: true,
    })
  })

  it('aceita a ordem invertida de thinking e esforço', () => {
    expect(parseModelId('claude-4.6-sonnet-medium-thinking')).toMatchObject({
      base: 'claude-4.6-sonnet',
      effort: 'medium',
      thinking: true,
    })
  })

  it('não confunde a versão no nome com sufixo de esforço', () => {
    expect(parseModelId('claude-opus-4-8-high').base).toBe('claude-opus-4-8')
  })

  it('trata "extra-high" como xhigh', () => {
    expect(parseModelId('gpt-5.5-extra-high')).toMatchObject({
      base: 'gpt-5.5',
      effort: 'xhigh',
    })
  })

  it('preserva sufixos que fazem parte do nome da família', () => {
    expect(parseModelId('gpt-5.4-mini-low').base).toBe('gpt-5.4-mini')
  })

  it('ignora parâmetros entre colchetes', () => {
    expect(parseModelId('claude-opus-4-8[effort=high]').base).toBe('claude-opus-4-8')
  })
})

describe('resolveModelInfo', () => {
  it('resolve a família de uma variante do cursor', () => {
    expect(resolveModelInfo('claude-sonnet-5-thinking-max')?.displayName).toBe('Sonnet 5')
  })

  it('devolve null para id desconhecido', () => {
    expect(resolveModelInfo('modelo-inexistente-9')).toBeNull()
  })
})

describe('tierOf', () => {
  it('usa a família quando conhecida', () => {
    expect(tierOf('claude-fable-5-thinking-low')).toBe(4)
  })

  it('cai no palpite por nome quando o id é desconhecido', () => {
    expect(tierOf('claude-haiku-9-9')).toBe(1)
  })
})

describe('compareModels', () => {
  it('ordena do mais leve ao mais capaz', () => {
    const sorted = ['claude-fable-5', 'claude-opus-5', 'haiku', 'sonnet'].sort(compareModels)
    expect(sorted).toEqual(['haiku', 'sonnet', 'claude-opus-5', 'claude-fable-5'])
  })

  it('mantém as variantes da mesma família juntas e em progressão de esforço', () => {
    const sorted = [
      'claude-opus-5-max',
      'claude-opus-5-low',
      'claude-opus-4-8-low',
      'claude-opus-5-high',
    ].sort(compareModels)
    expect(sorted).toEqual([
      'claude-opus-4-8-low',
      'claude-opus-5-low',
      'claude-opus-5-high',
      'claude-opus-5-max',
    ])
  })
})

describe('contextFromLabel', () => {
  it('lê a janela declarada pelo label da CLI', () => {
    expect(contextFromLabel('Opus 5 1M Max Thinking Fast')).toBe('1M')
    expect(contextFromLabel('Sonnet 4.6 1M Thinking')).toBe('1M')
  })

  it('devolve null quando o label não declara janela', () => {
    expect(contextFromLabel('GPT-5.4 Mini High')).toBeNull()
    expect(contextFromLabel('Composer 2.5')).toBeNull()
  })

  it('não confunde a versão do modelo com a janela', () => {
    expect(contextFromLabel('Gemini 3.1 Pro')).toBeNull()
    expect(contextFromLabel('Kimi K3 Low')).toBeNull()
  })
})

describe('catálogo sem dados inventados', () => {
  it('não declara preço para modelos fora do catálogo oficial Claude', () => {
    expect(resolveModelInfo('cursor-grok-4.6-high')?.pricing).toBeUndefined()
    expect(resolveModelInfo('gpt-5.6-sol-max')?.pricing).toBeUndefined()
    expect(resolveModelInfo('claude-4.5-sonnet')?.pricing).toBeUndefined()
  })

  it('não estima janela de contexto de terceiros', () => {
    expect(resolveModelInfo('gemini-3.7-flash-high')?.context).toBeUndefined()
    expect(resolveModelInfo('composer-2.5')?.context).toBeUndefined()
  })

  it('mantém preço e janela dos modelos do catálogo oficial', () => {
    expect(resolveModelInfo('claude-opus-5-thinking-max')).toMatchObject({
      context: '1M',
      pricing: { inputPerMTok: 5, outputPerMTok: 25 },
    })
  })
})
