import { readSession, writeSession, clearSession } from '../session-store'

const KEY = 'test-key'
const MINUTE = 60 * 1000

beforeEach(() => {
  window.sessionStorage.clear()
  jest.useRealTimers()
})

it('round-trips a value', () => {
  writeSession(KEY, { a: 1, b: ['x'] })
  expect(readSession(KEY, MINUTE)).toEqual({ a: 1, b: ['x'] })
})

it('returns null when nothing is stored', () => {
  expect(readSession(KEY, MINUTE)).toBeNull()
})

it('returns null once the value is older than maxAge', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-02T10:00:00Z'))
  writeSession(KEY, 'fresh')
  expect(readSession(KEY, 30 * MINUTE)).toBe('fresh')

  jest.setSystemTime(new Date('2026-11-02T10:31:00Z'))
  expect(readSession(KEY, 30 * MINUTE)).toBeNull()
})

it('drops the expired entry rather than leaving it to rot', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-02T10:00:00Z'))
  writeSession(KEY, 'stale')
  jest.setSystemTime(new Date('2026-11-02T11:00:00Z'))

  readSession(KEY, 30 * MINUTE)
  expect(window.sessionStorage.getItem(KEY)).toBeNull()
})

it('treats corrupt JSON as absent', () => {
  window.sessionStorage.setItem(KEY, '{not json')
  expect(readSession(KEY, MINUTE)).toBeNull()
})

it('treats an envelope without a timestamp as absent', () => {
  window.sessionStorage.setItem(KEY, JSON.stringify({ value: 'x' }))
  expect(readSession(KEY, MINUTE)).toBeNull()
})

it('does not throw when storage is blocked', () => {
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })

  expect(() => writeSession(KEY, 'x')).not.toThrow()
  expect(readSession(KEY, MINUTE)).toBeNull()

  get.mockRestore()
  set.mockRestore()
})

it('clears the keys it is given', () => {
  writeSession('a', 1)
  writeSession('b', 2)
  clearSession('a', 'b')
  expect(readSession('a', MINUTE)).toBeNull()
  expect(readSession('b', MINUTE)).toBeNull()
})
