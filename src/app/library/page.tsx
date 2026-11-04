'use client'

import { Suspense, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, BookOpen, ExternalLink, FlaskConical, Brain } from 'lucide-react'
import { LIBRARY, entriesForMetric, foundationalEntries, linkHost, type LibraryEntry } from '@/lib/library'
import { METRIC_LABELS } from '@/lib/metrics-calc'
import { METRIC_HEX } from '@/lib/palette'
import type { MetricKey } from '@/lib/chart-colors'

/**
 * The Science — the research the metrics are built on.
 *
 * Grouped by the metric each piece of work backs, so a ring can link straight
 * to its own evidence: /library?metric=focus. The entries themselves live in
 * lib/library.ts, which the ideal-day guide reads from as well.
 */

const KIND_LABEL: Record<LibraryEntry['kind'], { label: string; icon: typeof BookOpen }> = {
  book: { label: 'Book', icon: BookOpen },
  study: { label: 'Study', icon: FlaskConical },
  paper: { label: 'Paper', icon: Brain },
}

const METRIC_ORDER: MetricKey[] = ['body', 'focus', 'social']

function KindBadge({ kind }: { kind: LibraryEntry['kind'] }) {
  const { label, icon: Icon } = KIND_LABEL[kind]
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="field-label">{label}</span>
    </div>
  )
}

function EntryCard({ entry }: { entry: LibraryEntry }) {
  return (
    // The id is the anchor a suggestion's "why?" links to.
    <div id={entry.id} className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-4">
      <div className="p-4 pb-3">
        <KindBadge kind={entry.kind} />
        <h3 className="text-base font-semibold text-foreground mt-2 leading-tight">{entry.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {entry.author} · {entry.year}
        </p>
      </div>

      <div className="px-4 pb-3">
        <p className="eyebrow mb-1">What it found</p>
        <p className="text-sm text-foreground/80 leading-relaxed">{entry.finding}</p>
      </div>

      <div className="px-4 pb-4">
        <p className="eyebrow mb-1">What we do about it</p>
        <p className="text-sm text-foreground/80 leading-relaxed">{entry.howWeUseIt}</p>
      </div>

      {entry.link && (
        <a
          href={entry.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border-t border-border py-3 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {/* Named, so nobody taps blind into a shop or a paywall */}
          Read it on {linkHost(entry.link)}
        </a>
      )}
    </div>
  )
}

function LibraryContent() {
  const { status } = useSession()
  const router = useRouter()
  const highlighted = useSearchParams().get('metric') as MetricKey | null

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Arriving from a metric's detail sheet, or from a scheduling suggestion
  // asking "why then?" — open on the thing that was clicked.
  useEffect(() => {
    if (status !== 'authenticated') return
    const anchor = window.location.hash.slice(1)
    const target = anchor
      ? document.getElementById(anchor)
      : highlighted
        ? document.getElementById(`metric-${highlighted}`)
        : null
    target?.scrollIntoView({ block: 'start' })
  }, [highlighted, status])

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
        <header className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <h1 className="page-title text-foreground">The Science</h1>
          <p className="text-sm text-muted-foreground">
            Why the three numbers are the three numbers
          </p>
        </header>

        <div className="rounded-xl bg-secondary/50 border border-border p-4 mb-8">
          <p className="text-sm text-foreground/80 leading-relaxed">
            Every target, weight and label in this app comes from somewhere. These are the
            sources, and what each one actually changed about how the app works.
          </p>
        </div>

        <section className="mb-8">
          <h2 className="eyebrow mb-3">Why log at all</h2>
          <div className="space-y-4">
            {foundationalEntries().map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        {METRIC_ORDER.map((metric) => {
          const entries = entriesForMetric(metric)
          if (entries.length === 0) return null
          return (
            <section key={metric} id={`metric-${metric}`} className="mb-8 scroll-mt-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: METRIC_HEX[metric] }}
                  aria-hidden="true"
                />
                <h2 className="eyebrow">Behind {METRIC_LABELS[metric]}</h2>
              </div>
              <div className="space-y-4">
                {entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          )
        })}

        <button
          onClick={() => router.push('/guide')}
          className="w-full rounded-xl border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors mb-6"
        >
          <p className="eyebrow mb-1">Your Ideal Day</p>
          <p className="text-sm text-muted-foreground">
            What this research adds up to, hour by hour
          </p>
        </button>

        <p className="text-center text-xs text-muted-foreground">
          {LIBRARY.length} sources. Think one of them is read wrong? Send feedback from
          Settings — the argument is the point.
        </p>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  )
}
