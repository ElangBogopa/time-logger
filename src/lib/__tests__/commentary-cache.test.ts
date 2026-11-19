import {
  readFingerprint,
  readCachedCommentary,
  writeCachedCommentary,
  clearCachedCommentary,
} from '../commentary-cache'

const base = {
  date: '2026-11-01',
  read: {
    rule: 'keep-long-focus',
    facts: [
      'The longest focused block was 2h 30m on "Coding", starting at 9:00 AM.',
      'It started inside the focus window (9:00 AM–12:00 PM).',
    ],
  },
}

beforeEach(() => clearCachedCommentary())

describe('readFingerprint', () => {
  it('is stable for the same read', () => {
    expect(readFingerprint(base.read)).toBe(readFingerprint({ ...base.read, facts: [...base.read.facts] }))
  })

  it('changes when a fact changes', () => {
    const changed = { ...base.read, facts: [base.read.facts[0].replace('2h 30m', '2h 45m'), base.read.facts[1]] }
    expect(readFingerprint(changed)).not.toBe(readFingerprint(base.read))
  })

  it('changes when the rule changes, the facts held equal', () => {
    expect(readFingerprint({ ...base.read, rule: 'keep-movement-target' })).not.toBe(readFingerprint(base.read))
  })

  it('changes when a fact is added or dropped', () => {
    expect(readFingerprint({ ...base.read, facts: base.read.facts.slice(0, 1) })).not.toBe(readFingerprint(base.read))
  })
})

describe('storage', () => {
  it('returns what was written for a matching fingerprint', () => {
    const fp = readFingerprint(base.read)
    writeCachedCommentary(base.date, fp, 'A steady day.')
    expect(readCachedCommentary(base.date, fp)).toBe('A steady day.')
  })

  it('misses once the day data changes', () => {
    writeCachedCommentary(base.date, readFingerprint(base.read), 'A steady day.')
    const afterLogging = readFingerprint({ ...base.read, facts: ['Something new was logged.'] })
    expect(readCachedCommentary(base.date, afterLogging)).toBeNull()
  })

  it('misses for a different day', () => {
    const fp = readFingerprint(base.read)
    writeCachedCommentary(base.date, fp, 'A steady day.')
    expect(readCachedCommentary('2026-11-02', fp)).toBeNull()
  })

  it('survives a page reload (it is localStorage, not module state)', () => {
    const fp = readFingerprint(base.read)
    writeCachedCommentary(base.date, fp, 'Persisted.')
    // a reload keeps localStorage but resets every module-level variable
    jest.resetModules()
    const reloaded = jest.requireActual<typeof import('../commentary-cache')>('../commentary-cache')
    expect(reloaded.readCachedCommentary(base.date, fp)).toBe('Persisted.')
  })

  it('does not store an empty commentary', () => {
    const fp = readFingerprint(base.read)
    writeCachedCommentary(base.date, fp, '')
    expect(readCachedCommentary(base.date, fp)).toBeNull()
  })

  it('keeps only the most recent days', () => {
    for (let d = 1; d <= 12; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`
      writeCachedCommentary(date, 'fp', `day ${d}`)
    }
    expect(readCachedCommentary('2026-11-12', 'fp')).toBe('day 12')
    expect(readCachedCommentary('2026-11-01', 'fp')).toBeNull()
  })

  it('behaves as a cold cache when storage throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    expect(() => readCachedCommentary(base.date, 'fp')).not.toThrow()
    expect(readCachedCommentary(base.date, 'fp')).toBeNull()
    spy.mockRestore()
  })

  it('ignores corrupt stored JSON', () => {
    window.localStorage.setItem('ai-text-cache-v1', 'not json')
    expect(readCachedCommentary(base.date, 'fp')).toBeNull()
  })
})
