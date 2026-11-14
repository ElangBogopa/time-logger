'use client'

import { useState } from 'react'
import { Share, Smartphone, X, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useInstall } from '@/hooks/useInstall'
import { canOfferInstall, dismissInstallHint, promptInstall } from '@/lib/install'

/** The words the phone's own menu uses — and short enough to clear the sheet's close button. */
const TITLE = 'Add to Home Screen'

/**
 * How to do it, for the device in hand.
 *
 * An iPhone gets the three taps, because nothing on an iPhone will ever
 * offer them. Android gets a button where the browser has offered to
 * install, and the menu path where it has not.
 */
export function InstallSheet({
  open,
  onOpenChange,
  beforeSignIn = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Shown on the login page: say to sign in from the Home Screen, not here. */
  beforeSignIn?: boolean
}) {
  const install = useInstall()
  const [asking, setAsking] = useState(false)

  const ask = async () => {
    setAsking(true)
    const accepted = await promptInstall()
    setAsking(false)
    if (accepted) {
      toast.success('Better is on your Home Screen')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>
            It opens full screen like any other app, one tap from where the rest of your apps are.
          </DialogDescription>
        </DialogHeader>

        {install.platform === 'ios' ? (
          <>
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex gap-3">
                <span className="tabular-nums text-muted-foreground">1.</span>
                <span>
                  Tap the <strong className="font-medium">Share</strong> button{' '}
                  <Share className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> in your browser&rsquo;s
                  toolbar.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="tabular-nums text-muted-foreground">2.</span>
                <span>
                  Scroll down and tap <strong className="font-medium">Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="tabular-nums text-muted-foreground">3.</span>
                <span>
                  Tap <strong className="font-medium">Add</strong>.
                </span>
              </li>
            </ol>
            <p className="text-sm text-muted-foreground">
              {beforeSignIn
                ? 'Then open Better from your Home Screen and sign in there. On an iPhone the Home Screen app keeps its own sign-in.'
                : 'Then open Better from your Home Screen. On an iPhone it keeps its own sign-in and settings, so you may be asked to sign in once more.'}
            </p>
            <p className="text-xs text-muted-foreground">
              No Share button? This page is open inside another app. Open it in Safari first.
            </p>
          </>
        ) : install.canPrompt ? (
          <Button className="w-full" disabled={asking} onClick={ask}>
            Install
          </Button>
        ) : (
          <ol className="space-y-3 text-sm text-foreground">
            <li className="flex gap-3">
              <span className="tabular-nums text-muted-foreground">1.</span>
              <span>
                Open your browser&rsquo;s menu, the <strong className="font-medium">⋮</strong> at the top.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tabular-nums text-muted-foreground">2.</span>
              <span>
                Tap <strong className="font-medium">Add to Home screen</strong> or{' '}
                <strong className="font-medium">Install app</strong>.
              </span>
            </li>
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * On Today: one quiet row for someone using the app in a browser tab, which
 * can be put away for good. It is not a step in "Getting started" — that
 * list is the loop, and this is not part of it.
 */
export function InstallHintCard() {
  const install = useInstall()
  const [open, setOpen] = useState(false)

  if (!canOfferInstall(install) || install.dismissed) return null

  return (
    <section className="mt-6" aria-label="Install">
      <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card">
        <button
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-accent/40 active:bg-accent/60"
        >
          <Smartphone className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{TITLE}</span>
            <span className="block text-xs text-muted-foreground">Opens like an app, one tap away.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        <button
          onClick={dismissInstallHint}
          aria-label="Hide this"
          className="flex w-11 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <InstallSheet open={open} onOpenChange={setOpen} />
    </section>
  )
}

/**
 * On the login page, for a phone: the moment to add it is before signing
 * in, because on an iPhone the Home Screen app signs in separately.
 */
export function InstallHintLink() {
  const install = useInstall()
  const [open, setOpen] = useState(false)

  if (!canOfferInstall(install) || install.platform === 'other') return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mx-auto flex min-h-11 items-center gap-2 px-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        On your phone? Put Better on your Home Screen first
      </button>
      <InstallSheet open={open} onOpenChange={setOpen} beforeSignIn />
    </>
  )
}
