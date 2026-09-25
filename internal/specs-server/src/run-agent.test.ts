import { describe, expect, it } from 'vitest'
import {
  buildCommand,
  buildDesignInlineCommand,
  injectEffort,
  stripAgentFlag,
  withEffortParam,
} from './run-agent.js'
import type { SpecsConfig } from './types.js'

const identity = (s: string) => s

const config = {
  agent: {
    cli: 'claude',
    commands: {
      claude: 'claude {model} --agent feature-runner "{prompt}"',
      cursor: 'cursor-agent {model} "Use the feature-runner subagent. {prompt}"',
    },
    command: 'claude {model} --agent feature-runner "{prompt}"',
  },
} as unknown as SpecsConfig

describe('injectEffort', () => {
  it('substitui o placeholder {effort} quando existe', () => {
    expect(injectEffort('claude {effort} --agent x', 'high', identity)).toBe(
      'claude --effort high --agent x',
    )
  })

  it('limpa o placeholder e o espaço sobrando quando não há esforço', () => {
    expect(injectEffort('claude {effort} --agent x', undefined, identity)).toBe('claude --agent x')
  })

  it('insere a flag após o binário em templates antigos, sem placeholder', () => {
    expect(injectEffort('claude --agent x', 'max', identity)).toBe('claude --effort max --agent x')
  })

  it('não mexe no template quando não há esforço nem placeholder', () => {
    expect(injectEffort('claude --agent x', undefined, identity)).toBe('claude --agent x')
  })
})

describe('withEffortParam', () => {
  it('acrescenta o parâmetro ao modelo simples', () => {
    expect(withEffortParam('claude-opus-4-8', 'high')).toBe('claude-opus-4-8[effort=high]')
  })

  it('preserva parâmetros já existentes', () => {
    expect(withEffortParam('claude-opus-4-8[context=1m]', 'low')).toBe(
      'claude-opus-4-8[context=1m,effort=low]',
    )
  })

  it('não duplica quando o esforço já está no modelo', () => {
    expect(withEffortParam('claude-opus-4-8[effort=max]', 'low')).toBe(
      'claude-opus-4-8[effort=max]',
    )
  })
})

describe('buildCommand', () => {
  it('Claude Code recebe --model e --effort como flags', () => {
    expect(buildCommand(config, 'claude', 'opus', 'xhigh', identity)).toBe(
      'claude --effort xhigh --model opus --agent feature-runner "{prompt}"',
    )
  })

  it('sem esforço escolhido, só o modelo entra', () => {
    expect(buildCommand(config, 'claude', 'opus', undefined, identity)).toBe(
      'claude --model opus --agent feature-runner "{prompt}"',
    )
  })

  // O espaço duplo vem do `injectModel` (comportamento preexistente): sem modelo,
  // o `{model}` some e deixa o espaço. Inofensivo para o shell e para o parser inline.
  it('sem modelo, o esforço ainda é aplicado no Claude Code', () => {
    expect(buildCommand(config, 'claude', undefined, 'max', identity)).toBe(
      'claude --effort max  --agent feature-runner "{prompt}"',
    )
  })

  it('cursor-agent recebe o esforço como parâmetro do modelo', () => {
    expect(buildCommand(config, 'cursor', 'claude-opus-4-8', 'high', identity)).toBe(
      'cursor-agent --model claude-opus-4-8[effort=high] "Use the feature-runner subagent. {prompt}"',
    )
  })

  it('cursor-agent sem modelo ignora o esforço (não existe flag equivalente)', () => {
    expect(buildCommand(config, 'cursor', undefined, 'high', identity)).toBe(
      'cursor-agent  "Use the feature-runner subagent. {prompt}"',
    )
  })
})

describe('stripAgentFlag', () => {
  it('remove a flag --agent do template do Claude Code', () => {
    expect(stripAgentFlag('claude --agent feature-runner "{prompt}"')).toBe('claude "{prompt}"')
    expect(stripAgentFlag('claude --agent=feature-runner "{prompt}"')).toBe('claude "{prompt}"')
  })

  it('remove a menção ao subagent no template do cursor-agent', () => {
    expect(stripAgentFlag('cursor-agent "Use the feature-runner subagent. {prompt}"')).toBe(
      'cursor-agent "{prompt}"',
    )
  })

  it('colapsa os espaços deixados por {model}/{effort} vazios', () => {
    expect(stripAgentFlag('claude   --agent feature-runner  "{prompt}"')).toBe('claude "{prompt}"')
  })
})

describe('buildDesignInlineCommand', () => {
  it('dispara a CLI sem subagent, com o prompt de design como último argumento', () => {
    const inline = buildDesignInlineCommand(
      '/design trocar os KPIs',
      config,
      '/tmp/proj',
      'Design: trocar os KPIs',
      'claude',
      'opus',
    )
    expect(inline?.file).toBe('claude')
    expect(inline?.args).toEqual(['--model', 'opus', '/design trocar os KPIs'])
  })
})
