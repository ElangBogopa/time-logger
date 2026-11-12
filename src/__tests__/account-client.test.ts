/**
 * The browser's half of export and delete-account.
 */

import { csrfFetch } from '@/lib/api'
import { getLocalDateString } from '@/lib/types'
import { DELETE_CONFIRMATION } from '@/lib/account-shared'
import { downloadExport, deleteAccount, forgetThisDevice } from '@/lib/account-client'

jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn() }))

const fetchMock = jest.fn()
let downloads: { name: string; href: string }[] = []

beforeEach(() => {
  jest.clearAllMocks()
  downloads = []
  global.fetch = fetchMock as unknown as typeof fetch
  URL.createObjectURL = jest.fn(() => 'blob:export')
  URL.revokeObjectURL = jest.fn()
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href })
  })
})

afterEach(() => jest.restoreAllMocks())

describe('downloadExport', () => {
  it('saves the file under the day it is here, not the day it is on the server', async () => {
    fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob(['{}']) })

    await downloadExport('json')
    await downloadExport('csv')

    const day = getLocalDateString()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/account/export?format=json', '/api/account/export?format=csv'])
    expect(downloads.map((d) => d.name)).toEqual([`better-export-${day}.json`, `better-log-${day}.csv`])
  })

  it('saves nothing and passes on the reason when the server refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Too many exports at once. Try again in a minute.' }) })

    await expect(downloadExport('json')).rejects.toThrow('Too many exports at once')
    expect(downloads).toEqual([])
  })
})

describe('deleteAccount', () => {
  it('sends the confirmation the route insists on, with the CSRF token', async () => {
    ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ deleted: true, googleAccessRevoked: false }) })

    await expect(deleteAccount()).resolves.toEqual({ googleAccessRevoked: false })

    const [url, init] = (csrfFetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/account')
    expect(init.method).toBe('DELETE')
    expect(JSON.parse(init.body)).toEqual({ confirm: DELETE_CONFIRMATION })
  })

  it('throws with the server\'s words when the account is still there', async () => {
    ;(csrfFetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not everything could be deleted, so your account is still here. Try again.' }),
    })

    await expect(deleteAccount()).rejects.toThrow('your account is still here')
  })
})

describe('forgetThisDevice', () => {
  it('clears what the device kept', async () => {
    localStorage.setItem('wake-time', '450')
    localStorage.setItem('next-up-skipped', '["a"]')
    sessionStorage.setItem('habit-history:2026-11-10', '{"entries":[]}')
    const deleted: string[] = []
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: { keys: async () => ['api-cache', 'static'], delete: async (name: string) => { deleted.push(name); return true } },
    })

    await forgetThisDevice()

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(deleted).toEqual(['api-cache', 'static'])
    delete (globalThis as { caches?: unknown }).caches
  })

  it('does not throw where there is nothing to clear', async () => {
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: { keys: async () => { throw new Error('denied') } },
    })

    await expect(forgetThisDevice()).resolves.toBeUndefined()
    delete (globalThis as { caches?: unknown }).caches
  })
})
