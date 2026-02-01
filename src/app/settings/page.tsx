'use client'

import { csrfFetch } from '@/lib/api'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Bell,
  BookOpen,
  Calendar,
  ChevronRight,
  Target,
  LogOut,
  Loader2,
  Star,
  MessageSquare,
  Link2,
  X,
} from 'lucide-react'

// ── Section label ──
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 mb-2 mt-6 first:mt-0">
      {children}
    </h2>
  )
}

// ── Row item ──
function RowItem({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  description,
  onClick,
  trailing,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  label: string
  description?: string
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 ${
        onClick ? 'hover:bg-accent/50 active:bg-accent transition-colors cursor-pointer' : ''
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
      {trailing || (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />)}
    </Wrapper>
  )
}

// ── Feedback Modal ──
function FeedbackModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState<'general' | 'bug' | 'feature' | 'praise'>('general')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!rating && !message.trim()) return
    setIsSubmitting(true)
    try {
      await csrfFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rating || null,
          message: message.trim() || null,
          category,
        }),
      })
      setSubmitted(true)
      setTimeout(() => {
        onClose()
        // Reset after close animation
        setTimeout(() => {
          setRating(0)
          setMessage('')
          setCategory('general')
          setSubmitted(false)
        }, 300)
      }, 1500)
    } catch {
      // silent fail
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border p-6 animate-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-accent transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">🙏</p>
            <h3 className="text-lg font-semibold text-foreground">Thanks for your feedback!</h3>
            <p className="text-sm text-muted-foreground mt-1">Your input helps us improve.</p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-foreground mb-1">Send Feedback</h3>
            <p className="text-sm text-muted-foreground mb-5">How are you liking the app?</p>

            {/* Star Rating */}
            <div className="flex justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(['general', 'bug', 'feature', 'praise'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    category === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent'
                  }`}
                >
                  {cat === 'bug' ? '🐛 Bug' : cat === 'feature' ? '💡 Feature' : cat === 'praise' ? '❤️ Praise' : '💬 General'}
                </button>
              ))}
            </div>

            {/* Message */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us more... (optional)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              rows={3}
            />

            <Button
              onClick={handleSubmit}
              disabled={(!rating && !message.trim()) || isSubmitting}
              className="w-full mt-4"
              size="lg"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                'Submit Feedback'
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──
export default function MorePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showFeedback, setShowFeedback] = useState(false)


  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl py-6">
        {/* Header */}
        <header className="px-4 mb-2">
          <h1 className="text-2xl font-bold text-foreground">More</h1>
        </header>

        {/* Account & Settings */}
        <SectionLabel>Account &amp; Settings</SectionLabel>
        <div className="rounded-xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <RowItem
            icon={Link2}
            iconBg="bg-muted"
            iconColor="text-muted-foreground"
            label="Connected Accounts"
            description="Google Calendar integration"
            onClick={() => router.push('/settings/connections')}
          />
          <RowItem
            icon={Target}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="My Goals"
            description="Weekly targets and intentions"
            onClick={() => router.push('/intentions')}
          />
        </div>

        {/* Notifications — commented out until cron infrastructure is ready
        <SectionLabel>Notifications</SectionLabel>
        <div className="rounded-xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <RowItem
            icon={Bell}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            label="Push Notifications"
            description="Manage reminders and alerts"
            onClick={() => router.push('/settings/notifications')}
          />
        </div>
        */}

        {/* Preferences */}
        <SectionLabel>Preferences</SectionLabel>
        <div className="rounded-xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <RowItem
            icon={Calendar}
            iconBg="bg-green-500/10"
            iconColor="text-green-500"
            label="View Calendar"
            onClick={() => router.push('/calendar')}
          />
        </div>

        {/* About */}
        <SectionLabel>About</SectionLabel>
        <div className="rounded-xl border border-border bg-card mx-4 overflow-hidden divide-y divide-border">
          <RowItem
            icon={BookOpen}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-500"
            label="The Science"
            description="Research and books behind Better"
            onClick={() => router.push('/library')}
          />
          <RowItem
            icon={MessageSquare}
            iconBg="bg-pink-500/10"
            iconColor="text-pink-500"
            label="Send Feedback"
            description="Rate the app and share your thoughts"
            onClick={() => setShowFeedback(true)}
          />
        </div>

        {/* Account info + Sign out */}
        <div className="mx-4 mt-8 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{session?.user?.name || session?.user?.email}</p>
              <p className="text-[11px] text-muted-foreground">
                {session?.user?.email}
                {session?.authProvider === 'google' && ' · Google'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </div>
  )
}
