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
import { STATUS_CLASSES } from '@/lib/palette'
import { buildPixelsGrid, columnForDate, WEEKDAYS } from '@/lib/pixels-grid'
import { getUserToday } from '@/lib/types'

// Cell geometry. 53 columns at this size is ~820px: the whole year at once on
// a laptop, a short sideways scroll on a phone, which is the trade the
// GitHub layout makes.
const CELL = 12
const GAP = 3

interface DayPixel {
  date: string
  score: number | null
  entryCount: number
  totalMinutes: number
}

interface YearPixelsData {
  year: number
  pixels: DayPixel[]
}

// Thresholds are the grid's own (70/40 on the day-summary score, which is a
// different scale from the hero metrics); only the colours changed, from
// emerald/amber/red-500 to the palette's sage, dusty amber and muted clay.
const NO_DATA_CLASS = 'bg-zinc-200 dark:bg-zinc-700/50'

function getScoreColor(score: number | null): string {
  if (score === null) return NO_DATA_CLASS
  if (score >= 70) return STATUS_CLASSES.green.solid
  if (score >= 40) return STATUS_CLASSES.yellow.solid
  return STATUS_CLASSES.red.solid
}

function getScoreLabel(score: number | null): string {
  if (score === null) return 'No data'
  if (score >= 70) return 'Great day'
  if (score >= 40) return 'Okay day'
  return 'Rough day'
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
    const daysWithData = pixelsData.pixels.filter(p => p.score !== null)
    const greatDays = daysWithData.filter(p => p.score! >= 70).length
    const okayDays = daysWithData.filter(p => p.score! >= 40 && p.score! < 70).length
    const roughDays = daysWithData.filter(p => p.score! < 40).length
    const avgScore = daysWithData.length > 0
      ? Math.round(daysWithData.reduce((sum, p) => sum + p.score!, 0) / daysWithData.length)
      : 0

    return { total: daysWithData.length, greatDays, okayDays, roughDays, avgScore }
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
      <div className="mx-auto max-w-2xl px-4 py-6 lg:max-w-4xl">
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
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" onClick={fetchPixels} className="mt-4">
              Try again
            </Button>
          </div>
        ) : grid ? (
          <>
            {/* Stats Summary */}
            {stats && stats.total > 0 && (
              <div className="mb-6 grid grid-cols-4 gap-3">
                {[
                  { value: stats.avgScore, label: 'Average', color: 'text-foreground' },
                  { value: stats.greatDays, label: 'Great', color: STATUS_CLASSES.green.icon },
                  { value: stats.okayDays, label: 'Okay', color: STATUS_CLASSES.yellow.icon },
                  { value: stats.roughDays, label: 'Rough', color: STATUS_CLASSES.red.icon },
                ].map(({ value, label, color }) => (
                  <div key={label} className="rounded-lg bg-secondary p-3 text-center">
                    <p className={`metric-number ${color}`}>{value}</p>
                    <p className="field-label mt-1 whitespace-nowrap">{label}</p>
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
                      className="text-[10px] leading-none text-muted-foreground self-center"
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
                          className="text-[10px] leading-none text-muted-foreground"
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
                          score: null,
                          entryCount: 0,
                          totalMinutes: 0,
                        }
                        return (
                          <button
                            key={date}
                            onClick={() => setSelectedDay(pixel)}
                            style={position}
                            title={`${formatDate(date)} — ${getScoreLabel(pixel.score)}`}
                            className={`rounded-[2px] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${getScoreColor(pixel.score)} ${
                              date === today ? 'ring-1 ring-foreground/50' : ''
                            }`}
                            aria-label={`${date}: ${getScoreLabel(pixel.score)}`}
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
                { swatch: NO_DATA_CLASS, label: 'No data' },
                { swatch: STATUS_CLASSES.red.solid, label: 'Under 40' },
                { swatch: STATUS_CLASSES.yellow.solid, label: '40–69' },
                { swatch: STATUS_CLASSES.green.solid, label: '70+' },
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedDay ? formatDate(selectedDay.date) : ''}
            </DialogTitle>
            <DialogDescription>
              {selectedDay ? getScoreLabel(selectedDay.score) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-4">
              {/* Score */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Day Score</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-4 w-4 rounded-full ${getScoreColor(selectedDay.score)}`}
                  />
                  <span className="text-lg font-bold text-foreground">
                    {selectedDay.score !== null ? selectedDay.score : '—'}
                  </span>
                </div>
              </div>

              {/* Entries */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Entries Logged</span>
                <span className="font-medium text-foreground">{selectedDay.entryCount}</span>
              </div>

              {/* Total Time */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Time Tracked</span>
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
