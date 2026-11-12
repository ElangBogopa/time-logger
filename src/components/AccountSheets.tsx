'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { downloadExport, deleteAccount, forgetThisDevice, type ExportFormat } from '@/lib/account-client'
import { DELETE_WORD } from '@/lib/account-shared'

/**
 * Take your data with you.
 *
 * Two files, because two different people ask: the one who wants a complete
 * copy, and the one who wants their log in a spreadsheet — which, for an app
 * about when you do things, is most of the people who will ask at all.
 */
export function ExportDataSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  const download = async (format: ExportFormat) => {
    setBusy(format)
    setError(null)
    try {
      await downloadExport(format)
      toast.success('Your export is downloading')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your data could not be exported. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export your data</DialogTitle>
          <DialogDescription>A copy of what Better holds about you, as a file you keep.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Button className="w-full" disabled={busy !== null} onClick={() => download('json')}>
              {busy === 'json' && <Loader2 className="animate-spin" />}
              Download everything
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              One .json file: your log, plans, goals, reviews and settings.
            </p>
          </div>
          <div>
            <Button variant="outline" className="w-full" disabled={busy !== null} onClick={() => download('csv')}>
              {busy === 'csv' && <Loader2 className="animate-spin" />}
              Just the log, as a spreadsheet
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              A .csv file that opens in Excel, Numbers or Google Sheets.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Not in the file: your Google sign-in tokens, and anything kept only on this device.
        </p>
      </DialogContent>
    </Dialog>
  )
}

type DeleteStage = 'asking' | 'deleting' | 'done'

/**
 * Leave, and take everything with you.
 *
 * It names the account, says what goes, and asks for a typed word — the one
 * action in the app that cannot be taken back gets the one confirmation
 * that cannot be tapped through. Once it is done the sheet says so and can
 * only be left by signing out: the screen behind it belongs to an account
 * that no longer exists.
 */
export function DeleteAccountSheet({
  open,
  onOpenChange,
  email,
  onExportFirst,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Whose account this is, so nobody has to wonder which one is meant. */
  email?: string | null
  onExportFirst: () => void
}) {
  const [typed, setTyped] = useState('')
  const [stage, setStage] = useState<DeleteStage>('asking')
  const [error, setError] = useState<string | null>(null)
  const [googleAccessRevoked, setGoogleAccessRevoked] = useState<boolean | null>(null)

  const confirmed = typed.trim().toLowerCase() === DELETE_WORD
  const locked = stage !== 'asking'

  const close = (next: boolean) => {
    if (locked) return
    if (!next) {
      setTyped('')
      setError(null)
    }
    onOpenChange(next)
  }

  const confirm = async () => {
    if (!confirmed || locked) return
    setStage('deleting')
    setError(null)
    try {
      const result = await deleteAccount()
      setGoogleAccessRevoked(result.googleAccessRevoked)
      await forgetThisDevice()
      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong, and your account has not been deleted.')
      setStage('asking')
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        showCloseButton={!locked}
        onInteractOutside={(event) => locked && event.preventDefault()}
        onEscapeKeyDown={(event) => locked && event.preventDefault()}
      >
        {stage === 'done' ? (
          <>
            <DialogHeader>
              <DialogTitle>Your account has been deleted</DialogTitle>
              <DialogDescription>
                Everything Better held about you has been removed, and what this device kept has been cleared.
              </DialogDescription>
            </DialogHeader>
            {googleAccessRevoked === true && (
              <p className="text-sm text-muted-foreground">
                Better&rsquo;s access to your Google account has been ended.
              </p>
            )}
            {googleAccessRevoked === false && (
              <p className="text-sm text-muted-foreground" role="status">
                Google did not confirm that Better&rsquo;s access was ended. You can remove it yourself in your
                Google account, under Security → Your connections to third-party apps.
              </p>
            )}
            <Button className="w-full" onClick={() => signOut({ callbackUrl: '/login' })}>
              Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Delete your account</DialogTitle>
              <DialogDescription>
                This removes {email ? <strong className="font-medium text-foreground">{email}</strong> : 'your account'}{' '}
                and everything in it: your log, plans, goals, reviews and settings. It cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>Better&rsquo;s access to your Google account is ended. Nothing in your Google Calendar is touched.</li>
              <li>Signing in again afterwards starts a new, empty account.</li>
            </ul>

            <Button variant="outline" className="w-full" disabled={locked} onClick={onExportFirst}>
              Export your data first
            </Button>

            <div>
              {/* Plain text, not the small-capitals label: the word has to be
                  read as the word to type. */}
              <label htmlFor="delete-confirm" className="text-sm text-muted-foreground">
                Type <strong className="font-medium text-foreground">{DELETE_WORD}</strong> to confirm
              </label>
              <Input
                id="delete-confirm"
                className="mt-1.5"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Button variant="destructive" className="w-full" disabled={!confirmed || locked} onClick={confirm}>
                {stage === 'deleting' && <Loader2 className="animate-spin" />}
                {stage === 'deleting' ? 'Deleting…' : 'Delete account'}
              </Button>
              <Button variant="ghost" className="w-full" disabled={locked} onClick={() => close(false)}>
                Keep my account
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
