import {
  commentaryFingerprint,
  readCachedCommentary,
  writeCachedCommentary,
  clearCachedCommentary,
  type CommentaryInputs,
} from '../commentary-cache'

const base: CommentaryInputs = {
  date: '2026-11-01',
  score: 67,
  totalMinutesLogged: 1080,
  wins: [{ id: 'longest-focus', text: '150 min focus session on "Coding"' }],
  mood: null,
  longestFocusSession: { activity: 'Coding', minutes: 150 },
}

beforeEach(() => clearCachedCommentary())

describe('commentaryFingerprint', () => {
  it('is stable for the same inputs', () => {
    expect(commentaryFingerprint(base)).toBe(commentaryFingerprint({ ...base }))
  })

  it('ignores the date, which is the cache key, not prompt input', () => {
    expect(commentaryFingerprint({ ...base, date: '2026-12-25' })).toBe(commentaryFingerprint(base))
  })

  it.each([
    ['score', { score: 68 }],
    ['minutes logged', { totalMinutesLogged: 1081 }],
    ['wins', { wins: [{ id: 'balance', text: 'Good balance of focus and rest' }] }],
    ['mood', { mood: 'great' }],
    ['longest focus session', { longestFocusSession: { activity: 'Coding', minutes: 151 } }],
  ])('changes when %s changes', (_label, patch) => {
    expect(commentaryFingerprint({ ...base, ...patch } as CommentaryInputs)).not.toBe(commentaryFingerprint(base))
  })

  it('tolerates missing wins and a null focus session', () => {
    expect(() =>
      commentaryFingerprint({ date: '2026-11-01', score: 0, totalMinutesLogged: 0, wins: [], longestFocusSession: null })
    ).not.toThrow()
  })
})

describe('storage', () => {
  it('returns what was written for a matching fingerprint', () => {
    const fp = commentaryFingerprint(base)
    writeCachedCommentary(base.date, fp, 'A steady day.')
    expect(readCachedCommentary(base.date, fp)).toBe('A steady day.')
  })

  it('misses once the day data changes', () => {
    writeCachedCommentary(base.date, commentaryFingerprint(base), 'A steady day.')
    const afterLogging = commentaryFingerprint({ ...base, totalMinutesLogged: 1200 })
    expect(readCachedCommentary(base.date, afterLogging)).toBeNull()
  })

  it('misses for a different day', () => {
    const fp = commentaryFingerprint(base)
    writeCachedCommentary(base.date, fp, 'A steady day.')
    expect(readCachedCommentary('2026-11-02', fp)).toBeNull()
  })

  it('survives a page reload (it is localStorage, not module state)', () => {
    const fp = commentaryFingerprint(base)
    writeCachedCommentary(base.date, fp, 'Persisted.')
    // a reload keeps localStorage but resets every module-level variable
    jest.resetModules()
    const reloaded = jest.requireActual<typeof import('../commentary-cache')>('../commentary-cache')
    expect(reloaded.readCachedCommentary(base.date, fp)).toBe('Persisted.')
  })

  it('does not store an empty commentary', () => {
    const fp = commentaryFingerprint(base)
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
    window.localStorage.setItem('day-commentary-cache-v1', 'not json')
    expect(readCachedCommentary(base.date, 'fp')).toBeNull()
  })
})
