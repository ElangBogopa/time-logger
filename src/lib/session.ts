import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

/**
 * Who is asking, for an API route.
 *
 * Every route reads the signed-in person through here and nowhere else, so
 * the sign-in provider can change without touching the routes. `user.id` is
 * always our own `users.id` — the id every table is keyed on — never an id
 * the provider made up.
 */
export interface AppSession {
  user: {
    id: string
    email?: string | null
    name?: string | null
    preferredName?: string
  }
  /** 'google' when the person signed in with Google. */
  authProvider?: string
  error?: string
}

export async function getAppSession(): Promise<AppSession | null> {
  return getServerSession(authOptions)
}
