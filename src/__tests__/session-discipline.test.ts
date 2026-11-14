/**
 * @jest-environment node
 *
 * One way to ask who is signed in, enforced.
 *
 * Routes ask `getAppSession()` (lib/session.ts), screens ask `useAccount()`
 * (hooks/useAccount.ts), and a Google token comes from lib/google-token.ts.
 * Those three wrap NextAuth so the sign-in provider can change without
 * touching eighty files a second time — which only holds while nothing else
 * imports NextAuth. This fails the moment something does.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/** The only files that may import from `next-auth`. */
const ALLOWED = [
  // The three helpers everything else goes through.
  'src/lib/session.ts',
  'src/lib/google-token.ts',
  'src/hooks/useAccount.ts',
  // The sign-in itself.
  'src/lib/auth.ts',
  'src/lib/auth-adapter.ts',
  'src/app/api/auth/[...nextauth]/route.ts',
  'src/app/login/page.tsx',
  'src/components/Providers.tsx',
]

const IMPORTS_NEXT_AUTH = /(from|import\s*\(?|require\s*\()\s*['"]next-auth(\/[\w-]+)*['"]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return name === '__tests__' ? [] : sourceFiles(path)
    }
    return /\.tsx?$/.test(path) ? [path] : []
  })
}

const importers = sourceFiles('src')
  .filter((file) => IMPORTS_NEXT_AUTH.test(readFileSync(file, 'utf-8')))
  .map((file) => file.split('\\').join('/'))

it('imports NextAuth only in the sign-in and the three helpers', () => {
  // A route wants getAppSession() from lib/session.ts; a screen wants
  // useAccount(), signOutTo() or reconnectGoogle() from hooks/useAccount.ts;
  // a Google token comes from lib/google-token.ts.
  expect(importers.filter((file) => !ALLOWED.includes(file))).toEqual([])
})

it('has no entry in the allowed list that no longer needs to be there', () => {
  expect(ALLOWED.filter((file) => !importers.includes(file))).toEqual([])
})

it('would catch each way of importing it', () => {
  expect(IMPORTS_NEXT_AUTH.test(`import { getServerSession } from 'next-auth'`)).toBe(true)
  expect(IMPORTS_NEXT_AUTH.test(`import { useSession } from "next-auth/react"`)).toBe(true)
  expect(IMPORTS_NEXT_AUTH.test(`const { getToken } = require('next-auth/jwt')`)).toBe(true)
  expect(IMPORTS_NEXT_AUTH.test(`await import('next-auth/providers/google')`)).toBe(true)
  expect(IMPORTS_NEXT_AUTH.test(`import { getAppSession } from '@/lib/session'`)).toBe(false)
  expect(IMPORTS_NEXT_AUTH.test(`const SESSION_COOKIE = /next-auth\\.session-token/`)).toBe(false)
})
