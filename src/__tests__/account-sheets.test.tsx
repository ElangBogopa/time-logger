/**
 * Export and delete-account, as the person meets them on the More tab.
 *
 * The delete sheet is the one place in the app where a slip costs
 * everything, so what is pinned here is mostly what it will not do: act
 * before the word is typed, act twice, claim success it did not have, or
 * leave a signed-in screen standing over an account that is gone.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { signOut, useSession } from 'next-auth/react'
import { downloadExport, deleteAccount, forgetThisDevice } from '@/lib/account-client'

jest.mock('next-auth/react', () => ({ signOut: jest.fn(), useSession: jest.fn() }))
const stableRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => stableRouter }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn() }))
jest.mock('@/lib/account-client', () => ({
  downloadExport: jest.fn(),
  deleteAccount: jest.fn(),
  forgetThisDevice: jest.fn(),
}))

import { ExportDataSheet, DeleteAccountSheet } from '@/components/AccountSheets'
import MorePage from '@/app/settings/page'

beforeEach(() => {
  jest.clearAllMocks()
  ;(useSession as jest.Mock).mockReturnValue({
    status: 'authenticated',
    data: { user: { name: 'Naledi', email: 'naledi@example.com' }, authProvider: 'google' },
  })
  ;(downloadExport as jest.Mock).mockResolvedValue(undefined)
  ;(deleteAccount as jest.Mock).mockResolvedValue({ googleAccessRevoked: true })
  ;(forgetThisDevice as jest.Mock).mockResolvedValue(undefined)
})

describe('exporting', () => {
  it('offers everything, or the log alone as a spreadsheet', async () => {
    render(<ExportDataSheet open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Download everything' }))
    await waitFor(() => expect(downloadExport).toHaveBeenCalledWith('json'))

    fireEvent.click(screen.getByRole('button', { name: 'Just the log, as a spreadsheet' }))
    await waitFor(() => expect(downloadExport).toHaveBeenCalledWith('csv'))
  })

  it('says what is not in the file', () => {
    render(<ExportDataSheet open onOpenChange={() => {}} />)
    expect(screen.getByText(/Not in the file: your Google sign-in tokens/)).toBeInTheDocument()
  })

  it('says so when the export fails', async () => {
    ;(downloadExport as jest.Mock).mockRejectedValue(new Error('Your data could not be exported. Try again.'))
    render(<ExportDataSheet open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Download everything' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your data could not be exported. Try again.')
  })
})

describe('deleting the account', () => {
  const open = (props: Partial<Parameters<typeof DeleteAccountSheet>[0]> = {}) =>
    render(
      <DeleteAccountSheet open onOpenChange={() => {}} email="naledi@example.com" onExportFirst={() => {}} {...props} />
    )
  const type = (text: string) => fireEvent.change(screen.getByLabelText(/Type delete to confirm/), { target: { value: text } })
  const deleteButton = () => screen.getByRole('button', { name: 'Delete account' })

  it('names the account and says it cannot be undone', () => {
    open()
    expect(screen.getByText('naledi@example.com')).toBeInTheDocument()
    expect(screen.getByText(/It cannot be undone/)).toBeInTheDocument()
    expect(screen.getByText(/Nothing in your Google Calendar is touched/)).toBeInTheDocument()
  })

  it('does nothing until the word is typed', () => {
    open()
    expect(deleteButton()).toBeDisabled()

    type('delet')
    expect(deleteButton()).toBeDisabled()
    fireEvent.click(deleteButton())
    expect(deleteAccount).not.toHaveBeenCalled()

    // A phone capitalises the first letter and adds a space after a word.
    type(' Delete ')
    expect(deleteButton()).toBeEnabled()
  })

  it('offers the export first', () => {
    const onExportFirst = jest.fn()
    open({ onExportFirst })

    fireEvent.click(screen.getByRole('button', { name: 'Export your data first' }))

    expect(onExportFirst).toHaveBeenCalled()
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('deletes, clears the device, and can then only be left by signing out', async () => {
    const onOpenChange = jest.fn()
    open({ onOpenChange })
    type('delete')
    fireEvent.click(deleteButton())

    expect(await screen.findByText('Your account has been deleted')).toBeInTheDocument()
    expect(deleteAccount).toHaveBeenCalledTimes(1)
    expect(forgetThisDevice).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/access to your Google account has been ended/)).toBeInTheDocument()
    // No way back to the screen underneath: no close button, and Escape does nothing.
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()

    expect(signOut).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('cannot be asked twice while it is working', async () => {
    let finish: (value: { googleAccessRevoked: null }) => void = () => {}
    ;(deleteAccount as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    open()
    type('delete')

    fireEvent.click(deleteButton())
    const working = await screen.findByRole('button', { name: /Deleting/ })
    expect(working).toBeDisabled()
    fireEvent.click(working)
    expect(screen.getByRole('button', { name: 'Keep my account' })).toBeDisabled()

    finish({ googleAccessRevoked: null })
    await screen.findByText('Your account has been deleted')
    expect(deleteAccount).toHaveBeenCalledTimes(1)
  })

  it('tells the person what to do when Google did not confirm', async () => {
    ;(deleteAccount as jest.Mock).mockResolvedValue({ googleAccessRevoked: false })
    open()
    type('delete')
    fireEvent.click(deleteButton())

    expect(await screen.findByRole('status')).toHaveTextContent(/Google did not confirm/)
    expect(screen.queryByText(/has been ended/)).not.toBeInTheDocument()
  })

  it('says nothing about Google when there was no access to end', async () => {
    ;(deleteAccount as jest.Mock).mockResolvedValue({ googleAccessRevoked: null })
    open()
    type('delete')
    fireEvent.click(deleteButton())

    await screen.findByText('Your account has been deleted')
    expect(screen.queryByText(/Google/)).not.toBeInTheDocument()
  })

  it('claims nothing when the deletion fails: the account, the device and the session stay', async () => {
    ;(deleteAccount as jest.Mock).mockRejectedValue(
      new Error('Not everything could be deleted, so your account is still here. Try again.')
    )
    open()
    type('delete')
    fireEvent.click(deleteButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('your account is still here')
    expect(screen.queryByText('Your account has been deleted')).not.toBeInTheDocument()
    expect(forgetThisDevice).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
    // And it can be tried again.
    expect(deleteButton()).toBeEnabled()
  })
})

describe('the More tab', () => {
  it('has both, and opens each', async () => {
    render(<MorePage />)

    fireEvent.click(screen.getByText('Export your data'))
    expect(await screen.findByRole('button', { name: 'Download everything' })).toBeInTheDocument()
  })

  it('opens the delete sheet for the signed-in account, and hands over to the export from it', async () => {
    render(<MorePage />)

    fireEvent.click(screen.getByText('Delete account'))
    expect(await screen.findByRole('heading', { name: 'Delete your account' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('naledi@example.com')

    fireEvent.click(screen.getByRole('button', { name: 'Export your data first' }))
    expect(await screen.findByRole('heading', { name: 'Export your data' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Delete your account' })).not.toBeInTheDocument()
  })
})
