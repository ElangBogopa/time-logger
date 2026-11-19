import { checkCoachLine } from '@/lib/coach-voice-check'

const rules = (text: string, opts: Parameters<typeof checkCoachLine>[1]) => checkCoachLine(text, opts).map((b) => b.rule)

it('flags teasing and banned words', () => {
  expect(rules('Third TikTok session today. Come on.', { kind: 'entry' })).toContain('banned-word')
})
it('flags a scold', () => {
  expect(rules('You should have gone to the gym.', { kind: 'entry' })).toContain('scold')
})
it('flags hype and more than one exclamation', () => {
  const r = rules('Crushed it!!', { kind: 'entry' })
  expect(r).toContain('banned-word')
  expect(r).toContain('exclamation')
})
it('flags a score quoted as a number', () => {
  expect(rules('Mind 82 today', { kind: 'entry' })).toContain('score-number')
})
it('flags looking ahead when the day is over', () => {
  expect(rules('A calm afternoon. Tomorrow is open for a run.', { kind: 'session', aheadKind: 'none' })).toContain('looks-ahead')
})
it('passes a good session line', () => {
  expect(
    checkCoachLine('Two hours on the essay took Mind to its target, and the evening is still open for a walk.', {
      kind: 'session',
      aheadKind: 'later-today',
    })
  ).toEqual([])
})
it('flags an empty line', () => {
  expect(rules('  ', { kind: 'entry' })).toEqual(['empty'])
})
