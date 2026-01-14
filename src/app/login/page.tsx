'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff } from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AuthStep = 'email' | 'password'

interface EmailCheckResult {
  exists: boolean
  hasPassword: boolean
  authProvider: string | null
  preferredName: string | null
}

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()

  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isNewUser, setIsNewUser] = useState(false)
  const [existingUserName, setExistingUserName] = useState<string | null>(null)
  const [isGoogleOnlyUser, setIsGoogleOnlyUser] = useState(false)

  const passwordInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/')
    }
  }, [status, router])

  // Focus password input when moving to password step
  useEffect(() => {
    if (step === 'password') {
      setTimeout(() => {
        passwordInputRef.current?.focus()
      }, 100)
    }
  }, [step])

  const checkEmailAndProceed = async () => {
    if (!email || !EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsCheckingEmail(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        const result: EmailCheckResult = await response.json()

        if (result.exists) {
          setIsNewUser(false)
          setExistingUserName(result.preferredName)
          setIsGoogleOnlyUser(!result.hasPassword)
        } else {
          setIsNewUser(true)
          setExistingUserName(null)
          setIsGoogleOnlyUser(false)
        }

        setStep('password')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsCheckingEmail(false)
    }
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    checkEmailAndProceed()
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    try {
      if (isNewUser) {
        // Register new account (name will be collected in onboarding)
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to create account')
          setIsLoading(false)
          return
        }
      }

      // Sign in
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        router.push('/')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' })
  }

  const handleBack = () => {
    setStep('email')
    setPassword('')
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
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {step === 'email' ? (
              'Sign in to Time Logger'
            ) : isNewUser ? (
              'Create your account'
            ) : (
              <>Welcome back{existingUserName ? `, ${existingUserName}` : ''}</>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 'email' ? (
              'Enter your email to continue'
            ) : isNewUser ? (
              'Create a password to get started'
            ) : isGoogleOnlyUser ? (
              'Add a password to enable email login'
            ) : (
              'Enter your password to sign in'
            )}
          </p>
        </div>

        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                disabled={isCheckingEmail}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isCheckingEmail || !email}
            >
              {isCheckingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Sign In with Email'
              )}
            </Button>
          </form>
        )}

        {/* Password Step */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Show email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email-display" className="text-xs text-muted-foreground">
                Email
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email-display"
                  type="email"
                  value={email}
                  readOnly
                  className="bg-muted"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="shrink-0 text-xs"
                >
                  Change
                </Button>
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  ref={passwordInputRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isNewUser ? 'Create a password (8+ characters)' : 'Enter your password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  autoComplete={isNewUser ? 'new-password' : 'current-password'}
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || password.length < 8}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isNewUser ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        )}

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={isLoading || isCheckingEmail}
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
          Google
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By clicking continue, you agree to our{' '}
          <button className="underline underline-offset-4 hover:text-foreground">
            Terms of Service
          </button>{' '}
          and{' '}
          <button className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </div>
  )
}
