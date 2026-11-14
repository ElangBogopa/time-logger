'use client'

import { useSyncExternalStore } from 'react'
import { subscribeInstall, getInstallState, getServerInstallState, type InstallState } from '@/lib/install'

/**
 * Whether the app can be put on the Home Screen from here, and how. The
 * server and the first paint see "unknown", so a hint never appears and
 * then vanishes on a device that did not need it.
 */
export function useInstall(): InstallState {
  return useSyncExternalStore(subscribeInstall, getInstallState, getServerInstallState)
}
