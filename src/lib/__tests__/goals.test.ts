import { fetchGoals, invalidateGoals } from '../goals'

const goals = [{ id: 'g1', title: 'Increase Productivity', description: null }]

beforeEach(() => {
  invalidateGoals()
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ goals }) })) as unknown as typeof fetch
})

it('returns the goals', async () => {
  await expect(fetchGoals()).resolves.toEqual(goals)
})

it('coalesces concurrent readers into one request', async () => {
  // this is the dashboard case: YourPlan and useDashboardState mount together
  const [a, b] = await Promise.all([fetchGoals(), fetchGoals()])

  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(a).toEqual(goals)
  expect(b).toEqual(goals)
})

it('serves a second read from cache', async () => {
  await fetchGoals()
  await fetchGoals()
  expect(global.fetch).toHaveBeenCalledTimes(1)
})

it('refetches after invalidation', async () => {
  await fetchGoals()
  invalidateGoals()
  await fetchGoals()
  expect(global.fetch).toHaveBeenCalledTimes(2)
})

it('does not cache a failure, so the next read retries', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch
  await expect(fetchGoals()).rejects.toThrow()

  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ goals }) })) as unknown as typeof fetch
  await expect(fetchGoals()).resolves.toEqual(goals)
})

it('releases the in-flight slot when a request throws', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('offline')
  }) as unknown as typeof fetch
  await expect(fetchGoals()).rejects.toThrow('offline')

  // a stuck in-flight promise would make every later read reject forever
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ goals }) })) as unknown as typeof fetch
  await expect(fetchGoals()).resolves.toEqual(goals)
})
