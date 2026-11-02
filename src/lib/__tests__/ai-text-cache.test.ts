import {
  stableHash,
  readCachedText,
  writeCachedText,
  storedFingerprint,
  clearCachedText,
} from '../ai-text-cache'

beforeEach(() => clearCachedText())

describe('stableHash', () => {
  it('is stable and distinguishes different inputs', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'))
    expect(stableHash('abc')).not.toBe(stableHash('abd'))
    expect(stableHash('')).toEqual(expect.any(String))
  })
})

describe('namespaces', () => {
  it('keeps the day and week surfaces apart', () => {
    writeCachedText('day', '2026-11-01', 'fp', 'day text')
    writeCachedText('week', '2026-11-01', 'fp', 'week text')

    expect(readCachedText('day', '2026-11-01', 'fp')).toBe('day text')
    expect(readCachedText('week', '2026-11-01', 'fp')).toBe('week text')
  })

  it('prunes each namespace on its own', () => {
    for (let d = 1; d <= 10; d++) writeCachedText('day', `2026-11-${String(d).padStart(2, '0')}`, 'fp', `d${d}`)
    writeCachedText('week', '2026-10-26', 'fp', 'the week')

    expect(readCachedText('day', '2026-11-01', 'fp')).toBeNull() // pruned
    expect(readCachedText('day', '2026-11-10', 'fp')).toBe('d10')
    expect(readCachedText('week', '2026-10-26', 'fp')).toBe('the week') // untouched
  })
})

describe('storedFingerprint', () => {
  it('reports what we hold, so the server can skip regenerating', () => {
    writeCachedText('week', '2026-10-26', 'abc123', 'A strong week.')
    expect(storedFingerprint('week', '2026-10-26')).toBe('abc123')
  })

  it('is null when nothing is stored', () => {
    expect(storedFingerprint('week', '2026-10-26')).toBeNull()
  })

  it('is null for a different namespace', () => {
    writeCachedText('day', '2026-10-26', 'abc123', 'text')
    expect(storedFingerprint('week', '2026-10-26')).toBeNull()
  })
})

describe('resilience', () => {
  it('treats a corrupt store as cold', () => {
    window.localStorage.setItem('ai-text-cache-v1', '{{{')
    expect(readCachedText('day', 'k', 'fp')).toBeNull()
    expect(storedFingerprint('day', 'k')).toBeNull()
  })

  it('treats a non-object store as cold', () => {
    window.localStorage.setItem('ai-text-cache-v1', '"a string"')
    expect(readCachedText('day', 'k', 'fp')).toBeNull()
  })

  it('does not throw when writing is blocked', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => writeCachedText('day', 'k', 'fp', 'text')).not.toThrow()
    spy.mockRestore()
  })
})
