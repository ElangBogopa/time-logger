'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, Mail } from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AuthStep = 'email' | 'check-email' | 'redirecting-google' | 'suggest-google'

function LoginContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showGooglePrompt, setShowGooglePrompt] = useState(false)

  // Check for URL params
  useEffect(() => {
    const merged = searchParams.get('merged')
    const errorParam = searchParams.get('error')

    if (merged === 'true') {
      setSuccessMessage('Accounts merged successfully. Please sign in with Google.')
      router.replace('/login', { scroll: false })
    }

    if (errorParam === 'Verification') {
      setError('The magic link has expired or is invalid. Please request a new one.')
      router.replace('/login', { scroll: false })
    }

    if (errorParam === 'google_account' || errorParam === 'google_account_exists') {
      setShowGooglePrompt(true)
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/')
    }
  }, [status, router])

  // Send magic link
  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Pre-check if this email already has a Google account linked
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkData = await checkRes.json()

      // If account exists and was created via Google, auto-redirect to Google
      if (checkData.exists && checkData.authProvider === 'google') {
        setStep('redirecting-google')
        setIsLoading(false)
        // Brief delay so user sees the message, then redirect
        setTimeout(() => {
          signIn('google', { callbackUrl: '/' })
        }, 1500)
        return
      }

      // If new user with Gmail, suggest Google sign-in for better experience
      if (!checkData.exists && email.toLowerCase().endsWith('@gmail.com')) {
        setStep('suggest-google')
        setIsLoading(false)
        return
      }

      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: '/',
      })

      if (result?.error) {
        setError('Failed to send magic link. Please try again.')
        setIsLoading(false)
      } else {
        setStep('check-email')
        setIsLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' })
  }

  const handleBackToEmail = () => {
    setStep('email')
    setError(null)
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-[350px] space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <p>{successMessage}</p>
          </div>
        )}

        {/* Redirecting to Google */}
        {step === 'redirecting-google' && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <svg className="h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Taking you to Google
              </h1>
              <p className="text-sm text-muted-foreground">
                This email is connected via Google sign-in.
              </p>
            </div>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep('email')}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Suggest Google for Gmail users */}
        {step === 'suggest-google' && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Use Google Sign-In?
              </h1>
              <p className="text-sm text-muted-foreground">
                Since you have a Gmail account, signing in with Google gives you calendar sync and one-click access.
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleGoogleSignIn}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                setIsLoading(true)
                const result = await signIn('email', {
                  email,
                  redirect: false,
                  callbackUrl: '/',
                })
                if (result?.error) {
                  setError('Failed to send magic link. Please try again.')
                  setStep('email')
                } else {
                  setStep('check-email')
                }
                setIsLoading(false)
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send magic link instead
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep('email')}
            >
              Use a different email
            </Button>
          </div>
        )}

        {/* Google Account Prompt - fallback for URL param redirects */}
        {showGooglePrompt && step === 'email' && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Sign in with Google
              </h1>
              <p className="text-sm text-muted-foreground">
                This email is connected via Google. Please sign in with Google to access all your data including calendar sync.
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleGoogleSignIn}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowGooglePrompt(false)}
            >
              Use a different email
            </Button>
          </>
        )}

        {/* Email Step - Enter email and send magic link */}
        {step === 'email' && !showGooglePrompt && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Sign in to Time Logger
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email to receive a sign-in link
              </p>
            </div>

            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="sr-only">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  autoComplete="email"
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Continue with Email
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            {/* Google Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <button className="underline underline-offset-4 hover:text-foreground">
                Terms of Service
              </button>{' '}
              and{' '}
              <button className="underline underline-offset-4 hover:text-foreground">
                Privacy Policy
              </button>
              .
            </p>
          </>
        )}

        {/* Check Email Step - Confirmation after sending magic link */}
        {step === 'check-email' && (
          <>
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Check your email
              </h1>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to{' '}
                <span className="font-medium text-foreground">{email}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                The link will expire in 10 minutes.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleBackToEmail}
              >
                Use a different email
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Didn&apos;t receive an email?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setError(null)
                  }}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Try again
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
