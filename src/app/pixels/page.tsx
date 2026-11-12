'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SEQUENTIAL_CLASSES } from '@/lib/palette'
import { METRIC_LABELS } from '@/lib/metrics-calc'
import { buildPixelsGrid, columnForDate, WEEKDAYS } from '@/lib/pixels-grid'
import { getUserToday } from '@/lib/types'

// Cell geometry. 53 columns at this size is ~820px: the whole year at once on
// a laptop, a short sideways scroll on a phone, which is the trade the
// GitHub layout makes.
const CELL = 12
const GAP = 3

interface DayPixel {
  date: string
  metrics: { body: number; focus: number; social: number } | null
  /** How many of Body, Mind and Heart hit their target that day, 0–3. */
  onTarget: number
  entryCount: number
  totalMinutes: number
}

interface YearPixelsData {
  year: number
  pixels: DayPixel[]
}

/**
 * One hue, rising with how many of Body, Mind and Heart hit their target
 * that day. The grid used to colour by a score of its own — 20 + entryCount
 * × 10, plus 10 per session marked done — so it showed how diligently a day
 * was logged rather than how it went, and six short entries beat four hours
 * of deep work.
 */
function getDayColor(pixel: DayPixel | null): string {
  // Nothing logged and a logged day that met no target are different things,
  // and used to be the same grey square.
  if (!pixel || pixel.metrics === null) return SEQUENTIAL_CLASSES[0]
  return SEQUENTIAL_CLASSES[Math.min(3, pixel.onTarget) + 1]
}

function getDayLabel(pixel: DayPixel | null): string {
  if (!pixel || pixel.metrics === null) return 'Nothing logged'
  if (pixel.onTarget === 0) return 'No targets met'
  if (pixel.onTarget === 3) return 'All three on target'
  return `${pixel.onTarget} of 3 on target`
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function YearInPixelsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [pixelsData, setPixelsData] = useState<YearPixelsData | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayPixel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchPixels = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/year-pixels?year=${year}`)
      if (!response.ok) throw new Error('Failed to fetch pixels data')
      const data: YearPixelsData = await response.json()
      setPixelsData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [year])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPixels()
    }
  }, [status, fetchPixels])

  // One column per week, seven rows for the days — see lib/pixels-grid.ts.
  const today = getUserToday()
  const grid = useMemo(
    () => (pixelsData ? buildPixelsGrid(year, today) : null),
    [pixelsData, year, today]
  )

  const pixelsByDate = useMemo(() => {
    const map = new Map<string, DayPixel>()
    for (const pixel of pixelsData?.pixels ?? []) map.set(pixel.date, pixel)
    return map
  }, [pixelsData])

  // Open on the current week rather than on January.
  const scrollerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!grid || !scrollerRef.current) return
    const column = columnForDate(grid, today)
    if (column < 0) return
    const scroller = scrollerRef.current
    const target = (column + 1) * (CELL + GAP) - scroller.clientWidth / 2
    scroller.scrollLeft = Math.max(0, target)
  }, [grid, today])

  // Calculate stats
  const stats = pixelsData ? (() => {
    const daysWithData = pixelsData.pixels.filter(p => p.metrics !== null)
    const allThree = daysWithData.filter(p => p.onTarget === 3).length
    const someTargets = daysWithData.filter(p => p.onTarget > 0 && p.onTarget < 3).length
    const noTargets = daysWithData.filter(p => p.onTarget === 0).length

    return { total: daysWithData.length, allThree, someTargets, noTargets }
  })() : null

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="page-title text-foreground">Year in Pixels</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Every day of the year, one square
              </p>
            </div>
          </div>
        </header>

        {/* Year Navigation */}
        <div className="mb-6 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setYear(y => y - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-xl font-bold text-foreground tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setYear(y => y + 1)}
            disabled={year >= new Date().getFullYear()}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-[#A8706A] bg-[#A8706A] p-6 text-center dark:border-[#A8706A] dark:bg-[#A8706A]/20">
            <p className="text-[#A8706A] dark:text-[#C79089]">{error}</p>
            <Button variant="outline" onClick={fetchPixels} className="mt-4">
              Try again
            </Button>
          </div>
        ) : grid ? (
          <>
            {/* Stats Summary */}
            {stats && stats.total > 0 && (
              <div className="mb-6 grid grid-cols-4 gap-2">
                {[
                  { value: stats.total, label: 'Days logged', color: 'text-foreground' },
                  { value: stats.allThree, label: 'All three', color: 'text-foreground' },
                  { value: stats.someTargets, label: 'One or two', color: 'text-muted-foreground' },
                  { value: stats.noTargets, label: 'None met', color: 'text-muted-foreground' },
                ].map(({ value, label, color }) => (
                  <div key={label} className="rounded-lg bg-secondary px-1.5 py-3 text-center">
                    <p className={`metric-number ${color}`}>{value}</p>
                    {/* Two short lines, not one clipped one: "DAYS LOGGED"
                        ran out of the tile at phone width. */}
                    <p className="field-label mt-1 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* The grid: one column per week, one row per weekday. The
                weekday gutter sits outside the scroller, so only the weeks
                move sideways on a phone. */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex">
                <div
                  className="grid shrink-0 pr-2"
                  style={{ gap: `${GAP}px`, gridTemplateRows: `auto repeat(7, ${CELL}px)` }}
                >
                  <span aria-hidden="true" />
                  {WEEKDAYS.map((day, row) => (
                    <span
                      key={day}
                      className="text-xs leading-none text-muted-foreground self-center"
                      style={{ gridRow: row + 2 }}
                    >
                      {/* every other day, so the labels do not crowd 12px rows */}
                      {row % 2 === 0 ? day : ''}
                    </span>
                  ))}
                </div>

                <div ref={scrollerRef} className="overflow-x-auto">
                  <div
                    className="grid w-max"
                    style={{
                      gap: `${GAP}px`,
                      gridTemplateColumns: `repeat(${grid.weeks.length}, ${CELL}px)`,
                      gridTemplateRows: `auto repeat(7, ${CELL}px)`,
                    }}
                  >
                    {/* Month labels, each above the first week of its month */}
                    {grid.monthLabels.map(({ label, column }, i) => {
                      const next = grid.monthLabels[i + 1]?.column ?? grid.weeks.length
                      return (
                        <span
                          key={label}
                          className="text-xs leading-none text-muted-foreground"
                          style={{ gridRow: 1, gridColumn: `${column + 1} / span ${next - column}` }}
                        >
                          {label}
                        </span>
                      )
                    })}

                    {grid.weeks.map((week, weekIndex) =>
                      week.map((date, dayIndex) => {
                        const position = { gridRow: dayIndex + 2, gridColumn: weekIndex + 1 }
                        if (!date) {
                          return <span key={`${weekIndex}-${dayIndex}`} style={position} />
                        }
                        const pixel = pixelsByDate.get(date) ?? {
                          date,
                          metrics: null,
                          onTarget: 0,
                          entryCount: 0,
                          totalMinutes: 0,
                        }
                        return (
                          <button
                            key={date}
                            onClick={() => setSelectedDay(pixel)}
                            style={position}
                            title={`${formatDate(date)} — ${getDayLabel(pixel)}`}
                            className={`rounded-[2px] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${getDayColor(pixel)} ${
                              date === today ? 'ring-1 ring-foreground/50' : ''
                            }`}
                            aria-label={`${date}: ${getDayLabel(pixel)}`}
                          />
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-end gap-4 text-xs text-muted-foreground">
              {[
                { swatch: SEQUENTIAL_CLASSES[0], label: 'Not logged' },
                { swatch: SEQUENTIAL_CLASSES[1], label: 'None' },
                { swatch: SEQUENTIAL_CLASSES[2], label: '1' },
                { swatch: SEQUENTIAL_CLASSES[3], label: '2' },
                { swatch: SEQUENTIAL_CLASSES[4], label: '3 on target' },
              ].map(({ swatch, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className={`inline-block h-3 w-3 rounded-[2px] ${swatch}`} />
                  {label}
                </span>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDay ? formatDate(selectedDay.date) : ''}
            </DialogTitle>
            <DialogDescription>
              {selectedDay ? getDayLabel(selectedDay) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-4">
              {/* The three scores themselves, rather than one number
                  standing in for them */}
              {selectedDay.metrics && (
                <div className="grid grid-cols-3 gap-2">
                  {(['body', 'focus', 'social'] as const).map((metric) => (
                    <div key={metric} className="rounded-lg bg-secondary p-3 text-center">
                      <p className="metric-number text-foreground">{selectedDay.metrics![metric]}</p>
                      <p className="field-label mt-1">{METRIC_LABELS[metric]}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Entries */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Entries Logged</span>
                <span className="font-medium text-foreground">{selectedDay.entryCount}</span>
              </div>

              {/* Total Time */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Time Tracked</span>
                <span className="font-medium text-foreground">
                  {selectedDay.totalMinutes > 0 ? formatMinutes(selectedDay.totalMinutes) : '—'}
                </span>
              </div>

              {/* Link to day review */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedDay(null)
                  router.push(`/?date=${selectedDay.date}`)
                }}
              >
                View Full Day
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
