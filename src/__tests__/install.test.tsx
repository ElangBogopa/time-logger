/**
 * Putting the app on the Home Screen.
 *
 * On an iPhone nothing will ever offer to install a web app: the person has
 * to know to open Share and choose "Add to Home Screen". The app now says
 * so — at sign-in, on Today and under More — and says nothing at all where
 * there is nothing to do: on a desktop, or once it is already installed.
 */

import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { toast } from 'sonner'
import { detectPlatform, canOfferInstall, resetInstallForTests, type InstallState } from '@/lib/install'
import { InstallSheet, InstallHintCard, InstallHintLink } from '@/components/InstallHint'

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

function onDevice(userAgent: string, { standalone = false }: { standalone?: boolean } = {}) {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true })
  Object.defineProperty(window.navigator, 'standalone', { value: standalone, configurable: true })
  resetInstallForTests()
}

/** Chrome's offer to install, as the page receives it. */
function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = jest.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  })
  act(() => {
    window.dispatchEvent(event)
  })
  return { prompt, event }
}

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  onDevice(DESKTOP)
})

describe('which device this is', () => {
  it('knows an iPhone, an Android phone and a desktop', () => {
    expect(detectPlatform(IPHONE)).toBe('ios')
    expect(detectPlatform(ANDROID)).toBe('android')
    expect(detectPlatform(DESKTOP)).toBe('other')
  })

  it('knows an iPad even though it says it is a Mac', () => {
    expect(detectPlatform(IPAD_AS_MAC, 5)).toBe('ios')
    expect(detectPlatform(IPAD_AS_MAC, 0)).toBe('other') // an actual Mac
  })
})

describe('whether there is anything to say', () => {
  const state = (patch: Partial<InstallState>): InstallState => ({
    platform: 'ios',
    standalone: false,
    canPrompt: false,
    dismissed: false,
    ...patch,
  })

  it('offers on a phone in a browser', () => {
    expect(canOfferInstall(state({ platform: 'ios' }))).toBe(true)
    expect(canOfferInstall(state({ platform: 'android' }))).toBe(true)
  })

  it('says nothing once it is already on the Home Screen', () => {
    expect(canOfferInstall(state({ standalone: true }))).toBe(false)
  })

  it('says nothing on a desktop unless the browser itself has offered', () => {
    expect(canOfferInstall(state({ platform: 'other' }))).toBe(false)
    expect(canOfferInstall(state({ platform: 'other', canPrompt: true }))).toBe(true)
  })

  it('says nothing before the device is known', () => {
    expect(canOfferInstall(state({ platform: 'unknown' }))).toBe(false)
  })
})

describe('the instructions', () => {
  it('gives an iPhone the three taps, and says the Home Screen app signs in separately', () => {
    onDevice(IPHONE)
    render(<InstallSheet open onOpenChange={() => {}} />)

    expect(screen.getByText('Share')).toBeInTheDocument()
    expect(screen.getByText('Add to Home Screen', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
    expect(screen.getByText(/you may be asked to sign in once more/)).toBeInTheDocument()
    expect(screen.getByText(/Open it in Safari first/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('tells someone who has not signed in yet to sign in from the Home Screen', () => {
    onDevice(IPHONE)
    render(<InstallSheet open onOpenChange={() => {}} beforeSignIn />)

    expect(screen.getByText(/open Better from your Home Screen and sign in there/)).toBeInTheDocument()
    expect(screen.queryByText(/once more/)).not.toBeInTheDocument()
  })

  it('gives Android the menu path when the browser has not offered', () => {
    onDevice(ANDROID)
    render(<InstallSheet open onOpenChange={() => {}} />)

    expect(screen.getByText('Add to Home screen')).toBeInTheDocument()
    expect(screen.getByText('Install app')).toBeInTheDocument()
    expect(screen.queryByText('Share')).not.toBeInTheDocument()
  })

  it('gives Android a button when the browser has offered, and closes once accepted', async () => {
    onDevice(ANDROID)
    const onOpenChange = jest.fn()
    render(<InstallSheet open onOpenChange={onOpenChange} />)
    const { prompt, event } = offerInstall('accepted')

    // The browser's own banner is held back in favour of ours.
    expect(event.defaultPrevented).toBe(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Install' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Better is on your Home Screen')
  })

  it('stays open, and falls back to the menu path, when the person says no', async () => {
    onDevice(ANDROID)
    const onOpenChange = jest.fn()
    render(<InstallSheet open onOpenChange={onOpenChange} />)
    offerInstall('dismissed')

    fireEvent.click(await screen.findByRole('button', { name: 'Install' }))

    // The offer can be used once; after that only the manual way is left.
    expect(await screen.findByText('Add to Home screen')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('the row on Today', () => {
  it('is there on a phone in a browser, and opens the instructions', async () => {
    onDevice(IPHONE)
    render(<InstallHintCard />)

    fireEvent.click(screen.getByRole('button', { name: /Add to Home Screen/ }))

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('heading', { name: 'Add to Home Screen' })).toBeInTheDocument()
    expect(within(sheet).getByText('Share')).toBeInTheDocument()
  })

  it('is not there on a desktop', () => {
    render(<InstallHintCard />)
    expect(screen.queryByRole('button', { name: /Add to Home Screen/ })).not.toBeInTheDocument()
  })

  it('is not there once the app is running from the Home Screen', () => {
    onDevice(IPHONE, { standalone: true })
    render(<InstallHintCard />)
    expect(screen.queryByRole('button', { name: /Add to Home Screen/ })).not.toBeInTheDocument()
  })

  it('can be put away, and stays away', () => {
    onDevice(IPHONE)
    const { unmount } = render(<InstallHintCard />)

    fireEvent.click(screen.getByRole('button', { name: 'Hide this' }))
    expect(screen.queryByRole('button', { name: /Add to Home Screen/ })).not.toBeInTheDocument()

    // Another visit, same device.
    unmount()
    resetInstallForTests()
    render(<InstallHintCard />)
    expect(screen.queryByRole('button', { name: /Add to Home Screen/ })).not.toBeInTheDocument()
  })
})

describe('the line on the login page', () => {
  it('asks a phone to add it first, and says to sign in from there', async () => {
    onDevice(IPHONE)
    render(<InstallHintLink />)

    fireEvent.click(screen.getByRole('button', { name: /Put Better on your Home Screen first/ }))

    expect(await screen.findByText(/sign in there/)).toBeInTheDocument()
  })

  it('is shown even to someone who put the Today row away', () => {
    window.localStorage.setItem('install-hint-dismissed', '1')
    onDevice(ANDROID)
    render(<InstallHintLink />)
    expect(screen.getByRole('button', { name: /Home Screen first/ })).toBeInTheDocument()
  })

  it('is not shown on a desktop, even one whose browser offers to install', () => {
    render(<InstallHintLink />)
    offerInstall()
    expect(screen.queryByRole('button', { name: /Home Screen first/ })).not.toBeInTheDocument()
  })

  it('is not shown inside the installed app', () => {
    onDevice(IPHONE, { standalone: true })
    render(<InstallHintLink />)
    expect(screen.queryByRole('button', { name: /Home Screen first/ })).not.toBeInTheDocument()
  })
})
