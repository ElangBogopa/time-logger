'use client'

import { useRouter } from 'next/navigation'
import { ExternalLink, BookOpen } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { LIBRARY, linkHost } from '@/lib/library'

/**
 * The research behind one suggestion, shown where the suggestion is.
 *
 * "why?" used to navigate to the Library. That answered the question and
 * threw away what prompted it: the planner came back on today with the
 * proposals gone. A reason that costs you your place is a reason nobody
 * reads twice.
 */
interface SourceSheetProps {
  /** A `LIBRARY` entry id, or null when closed. */
  sourceId: string | null
  onClose: () => void
}

export default function SourceSheet({ sourceId, onClose }: SourceSheetProps) {
  const router = useRouter()
  const entry = sourceId ? LIBRARY.find((item) => item.id === sourceId) : null

  return (
    <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
      {entry && (
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <p className="eyebrow text-left">{entry.kind}</p>
            <DialogTitle className="text-left">{entry.title}</DialogTitle>
            <DialogDescription className="text-left">
              {entry.author} · {entry.year}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="field-label mb-1">What it found</p>
              <p className="text-sm text-foreground">{entry.finding}</p>
            </div>
            <div>
              <p className="field-label mb-1">What we do about it</p>
              <p className="text-sm text-muted-foreground">{entry.howWeUseIt}</p>
            </div>

            <div className="flex flex-col gap-1 border-t border-border pt-3">
              {entry.link && (
                <a
                  href={entry.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Read it on {linkHost(entry.link)}
                </a>
              )}
              <button
                onClick={() => router.push(`/library#${entry.id}`)}
                className="flex min-h-11 items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                See every source in The Science
              </button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
