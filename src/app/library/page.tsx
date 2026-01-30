'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, ExternalLink, FlaskConical, Brain } from 'lucide-react'

// ── Library Data ──

interface LibraryEntry {
  id: string
  type: 'book' | 'study' | 'paper'
  title: string
  author: string
  year: number
  cover?: string // emoji placeholder
  keyInsight: string
  howWeUseIt: string
  link?: string // external link (Amazon, DOI, etc.)
}

const LIBRARY: LibraryEntry[] = [
  {
    id: 'time-paradox',
    type: 'book',
    title: 'The Time Paradox',
    author: 'Philip Zimbardo & John Boyd',
    year: 2008,
    cover: '⏳',
    keyInsight:
      'People\'s perception of time is fundamentally broken — we overestimate productive time by 25-40%. Self-monitoring (logging) is the single most effective intervention to correct this bias.',
    howWeUseIt:
      'Our core philosophy. Better exists because simply tracking your time changes how you spend it. The act of logging makes the invisible visible — and awareness drives behavior change without willpower.',
    link: 'https://www.amazon.com/Time-Paradox-Psychology-That-Change/dp/1416541993',
  },
]

// ── Type badge ──
function TypeBadge({ type }: { type: LibraryEntry['type'] }) {
  const config = {
    book: { label: 'Book', icon: BookOpen, bg: 'bg-blue-500/10', text: 'text-blue-500' },
    study: { label: 'Study', icon: FlaskConical, bg: 'bg-green-500/10', text: 'text-green-500' },
    paper: { label: 'Paper', icon: Brain, bg: 'bg-purple-500/10', text: 'text-purple-500' },
  }
  const c = config[type]
  const Icon = c.icon

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${c.bg}`}>
      <Icon className={`h-3 w-3 ${c.text}`} />
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${c.text}`}>{c.label}</span>
    </div>
  )
}

// ── Library Card ──
function LibraryCard({ entry }: { entry: LibraryEntry }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header with cover emoji + title */}
      <div className="flex items-start gap-4 p-4 pb-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-3xl flex-shrink-0">
          {entry.cover || '📖'}
        </div>
        <div className="flex-1 min-w-0">
          <TypeBadge type={entry.type} />
          <h3 className="text-base font-semibold text-foreground mt-1.5 leading-tight">
            {entry.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entry.author} · {entry.year}
          </p>
        </div>
      </div>

      {/* Key insight */}
      <div className="px-4 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Key Insight
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          {entry.keyInsight}
        </p>
      </div>

      {/* How we use it */}
      <div className="px-4 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          How We Use This
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          {entry.howWeUseIt}
        </p>
      </div>

      {/* External link */}
      {entry.link && (
        <a
          href={entry.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border-t border-border py-3 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Read More
        </a>
      )}
    </div>
  )
}

// ── Page ──
export default function LibraryPage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <BookOpen className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">The Science</h1>
              <p className="text-sm text-muted-foreground">
                Research and books behind how Better works
              </p>
            </div>
          </div>
        </header>

        {/* Intro */}
        <div className="rounded-xl bg-secondary/50 border border-border p-4 mb-6">
          <p className="text-sm text-foreground/80 leading-relaxed">
            Better isn't built on guesswork. Every feature is grounded in behavioral science,
            psychology research, and proven frameworks for behavior change. Here's what we're built on.
          </p>
        </div>

        {/* Library entries */}
        <div className="space-y-4">
          {LIBRARY.map((entry) => (
            <LibraryCard key={entry.id} entry={entry} />
          ))}
        </div>

        {/* More coming */}
        {LIBRARY.length < 5 && (
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              More research sources coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
