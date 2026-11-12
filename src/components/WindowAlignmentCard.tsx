'use client'

import { formatDuration } from '@/lib/time-utils'
import { AGGREGATED_HEX } from '@/lib/palette'
import { alignmentShare, type AlignmentFact } from '@/lib/window-alignment'

/**
 * Whether the day put things where they go best.
 *
 * Time, with a bar to read it by — "1h 30m of 2h" — and no number out of a
 * hundred. It is the answer to a question this person is actually asking,
 * and it is not a grade: the note underneath says so, because someone whose
 * best hours are not the textbook's should not be told they are doing it
 * wrong.
 */
export default function WindowAlignmentCard({
  facts,
  heading = 'In your windows',
  lead,
}: {
  facts: AlignmentFact[]
  heading?: string
  /** One sentence above the rows, where a screen wants to lead with it. */
  lead?: string
}) {
  if (facts.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label={heading}>
      <h3 className="eyebrow">{heading}</h3>
      {lead && <p className="mt-1 text-sm text-muted-foreground">{lead}</p>}

      <ul className="mt-3 space-y-3">
        {facts.map((fact) => {
          const share = alignmentShare(fact)
          return (
            <li key={fact.key}>
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{fact.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{formatDuration(fact.inWindowMinutes)}</span> of{' '}
                  {formatDuration(fact.totalMinutes)}
                </span>
              </p>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                role="img"
                aria-label={`${share} percent of ${fact.label.toLowerCase()} inside your windows`}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${share}%`, backgroundColor: AGGREGATED_HEX[fact.bucket] }}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        How much of each fell in the hours that suit it. A guide, not a mark: if your best hours are
        elsewhere, your own log is the better authority.
      </p>
    </section>
  )
}
