/**
 * The Reminders screen, and the way to it.
 *
 * It existed for most of a year with no row leading to it, and turning
 * reminders on never enrolled anyone. What is pinned here: it can be
 * reached, the switch is the subscription, a test can be sent, and a device
 * that cannot receive notifications is told why and what to do.
 */

import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { useAccount } from '@/hooks/useAccount'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/api'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useInstall } from '@/hooks/useInstall'

jest.mock('@/hooks/useAccount', () => ({ useAccount: jest.fn(), signOutTo: jest.fn() }))
const stableRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => stableRouter }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn() }))
jest.mock('@/hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }))
jest.mock('@/hooks/useInstall', () => ({ useInstall: jest.fn() }))
jest.mock('@/lib/account-client', () => ({ downloadExport: jest.fn(), deleteAccount: jest.fn(), forgetThisDevice: jest.fn() }))

import NotificationsPage from '@/app/settings/notifications/page'
import MorePage from '@/app/settings/page'

const STORED = [
  { id: 'midday', label: 'Midday check-in', time: '12:00', enabled: true },
  { id: 'evening', label: 'Evening check-in', time: '18:00', enabled: true },
  { id: 'night', label: 'Night check-in', time: '21:00', enabled: false },
]

const push = (patch: Record<string, unknown> = {}) => ({
  isSupported: true,
  permission: 'granted',
  isSubscribed: true,
  isLoading: false,
  error: null,
  subscribe: jest.fn(async () => true),
  unsubscribe: jest.fn(async () => true),
  sendTest: jest.fn(async () => null),
  ...patch,
})

async function setup(pushState = push(), install: Record<string, unknown> = {}) {
  ;(usePushNotifications as jest.Mock).mockReturnValue(pushState)
  ;(useInstall as jest.Mock).mockReturnValue({ platform: 'android', standalone: true, canPrompt: false, dismissed: false, ...install })
  render(<NotificationsPage />)
  // Let the saved times arrive before the test looks at anything.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return pushState
}

beforeEach(() => {
  jest.clearAllMocks()
  window.sessionStorage.clear()
  ;(useAccount as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1', email: 'me@example.com' } } })
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ preferences: { reminder_times: STORED } }) })) as unknown as typeof fetch
  ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })
})

describe('the way in', () => {
  it('is a row under More', async () => {
    ;(useInstall as jest.Mock).mockReturnValue({ platform: 'other', standalone: false, canPrompt: false, dismissed: false })
    render(<MorePage />)

    fireEvent.click(screen.getByText('Reminders'))

    expect(stableRouter.push).toHaveBeenCalledWith('/settings/notifications')
  })
})

describe('turning reminders on and off', () => {
  it('is off until asked, and turning on subscribes this device', async () => {
    const state = await setup(push({ isSubscribed: false, permission: 'prompt' }))

    expect(screen.getByRole('status')).toHaveTextContent(/^Off\./)
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }))

    expect(state.subscribe).toHaveBeenCalledTimes(1)
  })

  it('says it is on, and turning off unsubscribes', async () => {
    const state = await setup()

    expect(screen.getByRole('status')).toHaveTextContent('On for this device.')
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))

    expect(state.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('shows why it could not be turned on', async () => {
    await setup(push({ isSubscribed: false, error: 'Notifications are not set up on the server yet.' }))
    expect(screen.getByRole('alert')).toHaveTextContent('not set up on the server yet')
  })

  it('offers no switch when notifications are blocked, and says where to allow them', async () => {
    await setup(push({ isSubscribed: false, permission: 'denied' }))

    expect(screen.getByRole('status')).toHaveTextContent(/blocked for Better/)
    expect(screen.queryByRole('button', { name: /Turn o/ })).not.toBeInTheDocument()
  })
})

describe('a device that cannot receive them', () => {
  it('tells an iPhone in a browser tab to use the Home Screen, and shows how', async () => {
    await setup(push({ isSupported: false, isSubscribed: false, permission: 'unsupported' }), { platform: 'ios', standalone: false })

    expect(screen.getByRole('status')).toHaveTextContent('reminders work once Better is on your Home Screen')
    fireEvent.click(screen.getByRole('button', { name: 'Show me how' }))

    expect(await screen.findByRole('heading', { name: 'Add to Home Screen' })).toBeInTheDocument()
  })

  it('says so plainly anywhere else', async () => {
    await setup(push({ isSupported: false, isSubscribed: false, permission: 'unsupported' }), { platform: 'other', standalone: false })

    expect(screen.getByRole('status')).toHaveTextContent('This browser cannot receive notifications.')
    expect(screen.queryByRole('button', { name: 'Show me how' })).not.toBeInTheDocument()
  })
})

describe('sending a test', () => {
  it('is only offered once reminders are on', async () => {
    await setup(push({ isSubscribed: false }))
    expect(screen.queryByRole('button', { name: 'Send a test' })).not.toBeInTheDocument()
  })

  it('says it was sent', async () => {
    const state = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Send a test' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Sent. It should arrive in a moment.'))
    expect(state.sendTest).toHaveBeenCalledTimes(1)
  })

  it('says what went wrong instead of claiming it was sent', async () => {
    await setup(push({ sendTest: jest.fn(async () => 'The notification could not be delivered.') }))
    fireEvent.click(screen.getByRole('button', { name: 'Send a test' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The notification could not be delivered.'))
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('when each one arrives', () => {
  const when = () => screen.getByRole('region', { name: 'When' })
  const saved = () => JSON.parse((csrfFetch as jest.Mock).mock.calls.at(-1)[1].body).reminder_times

  it('names the three by what they ask for, with the saved hours', async () => {
    await setup()
    await waitFor(() => expect(within(when()).getByRole('switch', { name: 'Log your evening' })).not.toBeChecked())

    expect(within(when()).getByRole('switch', { name: 'Log your morning' })).toBeChecked()
    expect(within(when()).getByRole('combobox', { name: 'Log your morning: time' })).toHaveValue('12')
    expect(within(when()).getByRole('combobox', { name: 'Log your afternoon: time' })).toHaveValue('18')
    expect(within(when()).queryByText('Midday check-in')).not.toBeInTheDocument()
  })

  it('moves a reminder to another hour, always on the hour', async () => {
    await setup()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    fireEvent.change(await screen.findByRole('combobox', { name: 'Log your morning: time' }), { target: { value: '13' } })

    await waitFor(() => expect(csrfFetch).toHaveBeenCalled())
    expect(saved().find((r: { id: string }) => r.id === 'midday')).toMatchObject({ time: '13:00', enabled: true })
    expect(saved()).toHaveLength(3)
  })

  it('switches one off without touching the others', async () => {
    await setup()
    await waitFor(() => expect(within(when()).getByRole('switch', { name: 'Log your evening' })).not.toBeChecked())

    fireEvent.click(within(when()).getByRole('switch', { name: 'Log your afternoon' }))

    await waitFor(() => expect(csrfFetch).toHaveBeenCalled())
    expect(saved().map((r: { enabled: boolean }) => r.enabled)).toEqual([true, false, false])
  })

  it('says nothing will be sent the moment the last one is switched off', async () => {
    const twoOff = STORED.map((reminder) => ({ ...reminder, enabled: reminder.id === 'midday' }))
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ preferences: { reminder_times: twoOff } }) })) as unknown as typeof fetch
    await setup()
    await waitFor(() => expect(within(when()).getByRole('switch', { name: 'Log your afternoon' })).not.toBeChecked())
    expect(screen.getByText(/Sent on the hour/)).toBeInTheDocument()

    fireEvent.click(within(when()).getByRole('switch', { name: 'Log your morning' }))

    expect(await screen.findByText('All three are switched off, so nothing will be sent.')).toBeInTheDocument()
    expect(screen.queryByText(/Sent on the hour/)).not.toBeInTheDocument()
  })

  it('puts the screen back, and says so, when a change will not save', async () => {
    ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) })
    await setup()
    const select = await screen.findByRole('combobox', { name: 'Log your morning: time' })
    await waitFor(() => expect(select).toHaveValue('12'))

    fireEvent.change(select, { target: { value: '7' } })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That change could not be saved'))
    expect(screen.getByRole('combobox', { name: 'Log your morning: time' })).toHaveValue('12')
  })

  it('cannot be changed while reminders are off', async () => {
    await setup(push({ isSubscribed: false }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    for (const control of [...within(when()).getAllByRole('switch'), ...within(when()).getAllByRole('combobox')]) {
      expect(control).toBeDisabled()
    }
  })

  it('says they go out on the hour and are skipped once that part is logged', async () => {
    await setup()
    expect(screen.getByText(/Sent on the hour, give or take a few minutes, and skipped when you have already logged/)).toBeInTheDocument()
    expect(screen.queryByText('Turn reminders on to choose the times.')).not.toBeInTheDocument()
  })

  it('says to turn reminders on, instead, while they are off and can be turned on here', async () => {
    await setup(push({ isSubscribed: false }))

    expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument()
    expect(screen.getByText('Turn reminders on to choose the times.')).toBeInTheDocument()
    expect(screen.queryByText(/Sent on the hour/)).not.toBeInTheDocument()
  })

  it('says to turn reminders on for a device that has never been asked, which is the usual first state', async () => {
    await setup(push({ isSubscribed: false, permission: 'prompt' }))

    expect(screen.getByText('Turn reminders on to choose the times.')).toBeInTheDocument()
    expect(screen.queryByText(/Sent on the hour/)).not.toBeInTheDocument()
  })

  it('keeps the usual line where notifications are blocked, since there is nothing to turn on here', async () => {
    await setup(push({ isSubscribed: false, permission: 'denied' }))

    expect(screen.getByText(/Sent on the hour, give or take a few minutes/)).toBeInTheDocument()
    expect(screen.queryByText('Turn reminders on to choose the times.')).not.toBeInTheDocument()
  })

  it('keeps the usual line on a device that cannot receive them', async () => {
    await setup(push({ isSupported: false, isSubscribed: false, permission: 'unsupported' }), { platform: 'ios', standalone: false })

    expect(screen.getByText(/Sent on the hour, give or take a few minutes/)).toBeInTheDocument()
    expect(screen.queryByText('Turn reminders on to choose the times.')).not.toBeInTheDocument()
  })

  it('keeps the usual line while this device is still being checked, so it does not change a moment later', async () => {
    await setup(push({ isSubscribed: false, permission: 'prompt', isLoading: true }))

    expect(screen.getByText(/Sent on the hour, give or take a few minutes/)).toBeInTheDocument()
    expect(screen.queryByText('Turn reminders on to choose the times.')).not.toBeInTheDocument()
  })

  describe('with all three switched off', () => {
    const SENTENCE = 'All three are switched off, so nothing will be sent.'

    beforeEach(() => {
      const allOff = STORED.map((reminder) => ({ ...reminder, enabled: false }))
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ preferences: { reminder_times: allOff } }) })) as unknown as typeof fetch
    })

    it('says nothing will be sent, in place of the usual line, while reminders are on for this device', async () => {
      await setup()

      expect(await screen.findByText(SENTENCE)).toBeInTheDocument()
      expect(screen.queryByText(/Sent on the hour/)).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('On for this device.')
    })

    it('goes back to the usual line as soon as one is switched on again', async () => {
      await setup()
      await screen.findByText(SENTENCE)

      fireEvent.click(within(when()).getByRole('switch', { name: 'Log your morning' }))

      await waitFor(() => expect(screen.queryByText(SENTENCE)).not.toBeInTheDocument())
      expect(screen.getByText(/Sent on the hour, give or take a few minutes/)).toBeInTheDocument()
      expect(saved().map((r: { enabled: boolean }) => r.enabled)).toEqual([true, false, false])
    })

    it('still says to turn reminders on while they are off for this device', async () => {
      await setup(push({ isSubscribed: false }))
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())

      expect(screen.getByText('Turn reminders on to choose the times.')).toBeInTheDocument()
      expect(screen.queryByText(SENTENCE)).not.toBeInTheDocument()
    })
  })
})
