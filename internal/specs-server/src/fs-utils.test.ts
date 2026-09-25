import { describe, expect, it } from 'vitest'
import { assertInsideProject, isValidSlug } from './fs-utils.js'

describe('isValidSlug', () => {
  it('aceita slugs kebab-case', () => {
    expect(isValidSlug('specs-platform')).toBe(true)
    expect(isValidSlug('login')).toBe(true)
    expect(isValidSlug('a1b2c3')).toBe(true)
    expect(isValidSlug('feat-specs-platform-discovery')).toBe(true)
  })

  it('rejeita paths perigosos', () => {
    expect(isValidSlug('..')).toBe(false)
    expect(isValidSlug('a/b')).toBe(false)
    expect(isValidSlug('a\\b')).toBe(false)
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('-starts-with-dash')).toBe(false)
    expect(isValidSlug('UPPER')).toBe(false)
    expect(isValidSlug('has space')).toBe(false)
    expect(isValidSlug('a\0b')).toBe(false)
    expect(isValidSlug(undefined)).toBe(false)
    expect(isValidSlug(null)).toBe(false)
  })
})

describe('assertInsideProject', () => {
  const root = '/tmp/project'

  it('aceita paths dentro do root', () => {
    expect(() => assertInsideProject('/tmp/project/features/login/x.md', root)).not.toThrow()
  })

  it('rejeita paths com ..', () => {
    expect(() => assertInsideProject('/tmp/elsewhere/x', root)).toThrow()
  })

  it('rejeita paths absolutos diferentes', () => {
    expect(() => assertInsideProject('/etc/passwd', root)).toThrow()
  })
})
