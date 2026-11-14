'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import type { AppSession } from '@/lib/session'

/**
 * Who is signed in, for a screen.
 *
 * Every component reads the signed-in person through here, and signs in
 * or out through the two functions below, so the sign-in provider can
 * change without touching the screens. `data.user.id` is our own
 * `users.id`.
 *
 * Two screens are the sign-in itself and still talk to NextAuth directly:
 * `app/login/page.tsx` and `components/Providers.tsx`. Nothing else may;
 * `session-discipline.test.ts` fails if another file does.
 */
export type AccountStatus = 'loading' | 'authenticated' | 'unauthenticated'

export function useAccount(): { data: AppSession | null; status: AccountStatus } {
  const { data, status } = useSession()
  return { data: data ?? null, status }
}

/** Sign out and land on `to` (a path in this app). */
export function signOutTo(to: string): Promise<void> {
  return signOut({ callbackUrl: to })
}

/** Sign in with Google again — after the calendar's access has lapsed. */
export function reconnectGoogle(): Promise<unknown> {
  return signIn('google')
}
