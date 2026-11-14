/**
 * Putting the app on the Home Screen.
 *
 * Better is a web app. On Android the browser will offer to install it and
 * can be asked to; on an iPhone nothing offers anything — the person has to
 * know to open the Share menu and choose "Add to Home Screen", and nobody
 * knows that unprompted. So the app says so: at sign-in, on Today, and
 * under More.
 *
 * One thing about iPhones shapes where it is said. A Home Screen app there
 * keeps its own storage, apart from the browser it was added from: the
 * sign-in may not come with it, and what this app keeps on the device (a
 * wake time, the getting-started list) does not. The best moment to add it
 * is therefore before signing in, which is why the login page asks first.
 */

export type InstallPlatform = 'ios' | 'android' | 'other'

export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  // An iPad says it is a Mac. A Mac with a touch screen is an iPad.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'other'
}

/** Chrome's offer to install, held until the person asks for it. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallState {
  /** 'unknown' on the server and for the first paint, so nothing flashes in and out. */
  platform: InstallPlatform | 'unknown'
  /** Already running from the Home Screen. */
  standalone: boolean
  /** The browser has offered to install and can be asked to. */
  canPrompt: boolean
  /** The person has put the hint on Today away. */
  dismissed: boolean
}

const KEY = 'install-hint-dismissed'
const SERVER: InstallState = { platform: 'unknown', standalone: false, canPrompt: false, dismissed: false }

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
let snapshot: InstallState | null = null
let listening = false
const listeners = new Set<() => void>()

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || installed || (window.matchMedia?.('(display-mode: standalone)').matches ?? false)
}

function compute(): InstallState {
  let dismissed = false
  try {
    dismissed = localStorage.getItem(KEY) === '1'
  } catch {
    /* no storage: the hint simply cannot be put away */
  }
  return {
    platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    standalone: isStandalone(),
    canPrompt: deferred !== null,
    dismissed,
  }
}

function emit(): void {
  snapshot = compute()
  listeners.forEach((listener) => listener())
}

/** Chrome makes its offer once, soon after the page loads; it has to be caught then or not at all. */
function listen(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', emit)
}
listen()

export function subscribeInstall(listener: () => void): () => void {
  listen()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getInstallState(): InstallState {
  return (snapshot ??= compute())
}

export function getServerInstallState(): InstallState {
  return SERVER
}

/** Whether there is anything to say: not already installed, and on something that can be. */
export function canOfferInstall(state: InstallState): boolean {
  if (state.standalone || state.platform === 'unknown') return false
  return state.platform === 'ios' || state.platform === 'android' || state.canPrompt
}

/** Ask the browser to install. Resolves true if the person said yes. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  // The offer can be used once.
  deferred = null
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') installed = true
    return outcome === 'accepted'
  } catch {
    return false
  } finally {
    emit()
  }
}

export function dismissInstallHint(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* storage is a convenience */
  }
  emit()
}

/** For tests: forget everything this module has seen. */
export function resetInstallForTests(): void {
  deferred = null
  installed = false
  snapshot = null
}
