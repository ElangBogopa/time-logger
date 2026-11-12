/**
 * The browser's half of export and delete-account: asking the server, and
 * tidying up the device afterwards.
 */

import { csrfFetch } from './api'
import { getLocalDateString } from './types'
import { DELETE_CONFIRMATION } from './account-shared'

export type ExportFormat = 'json' | 'csv'

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null)
  return new Error(typeof body?.error === 'string' ? body.error : fallback)
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Not at once: the browser is still reading from it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Fetch the export and hand it to the browser as a download. */
export async function downloadExport(format: ExportFormat): Promise<void> {
  const response = await fetch(`/api/account/export?format=${format}`, { cache: 'no-store' })
  if (!response.ok) throw await errorFrom(response, 'Your data could not be exported. Try again.')

  // Named here rather than by the server, which does not know what day it is where you are.
  const day = getLocalDateString()
  saveBlob(await response.blob(), format === 'csv' ? `better-log-${day}.csv` : `better-export-${day}.json`)
}

/**
 * Ask for the account to be deleted. Resolves with whether Google confirmed
 * that the app's access was handed back: true, false, or null when there
 * was none to hand back.
 */
export async function deleteAccount(): Promise<{ googleAccessRevoked: boolean | null }> {
  const response = await csrfFetch('/api/account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: DELETE_CONFIRMATION }),
  })
  if (!response.ok) {
    throw await errorFrom(response, 'Something went wrong, and your account has not been deleted. Try again.')
  }
  const body = await response.json().catch(() => ({}))
  return { googleAccessRevoked: body?.googleAccessRevoked ?? null }
}

/**
 * Remove what this device kept: the wake time and skipped tasks in local
 * storage, the cached screens, the offline copy of API responses, and the
 * notification subscription. Deleting an account and leaving its last week
 * readable in the browser would not be deleting it. Every step is allowed
 * to fail — a private window has no storage to clear — and none stops the
 * next.
 */
export async function forgetThisDevice(): Promise<void> {
  try { localStorage.clear() } catch { /* nothing to clear */ }
  try { sessionStorage.clear() } catch { /* nothing to clear */ }
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys()
      await Promise.all(names.map((name) => caches.delete(name)))
    }
  } catch { /* no cache storage here */ }
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager?.getSubscription()
      await subscription?.unsubscribe()
    }
  } catch { /* no subscription here */ }
}
