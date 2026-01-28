'use client'

import { useEffect, useState, useCallback } from 'react'
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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-zinc-300 dark:bg-zinc-800'
  if (score >= 70) return 'bg-emerald-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-400'
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

  // Build the grid: 12 months × up to 31 days
  const buildGrid = useCallback(() => {
    if (!pixelsData) return null

    // Create a map for quick lookup
    const pixelMap = new Map<string, DayPixel>()
    for (const p of pixelsData.pixels) {
      pixelMap.set(p.date, p)
    }

    const grid: (DayPixel | null)[][] = []

    // For each day (1-31), create a row with 12 columns (months)
    for (let day = 1; day <= 31; day++) {
      const row: (DayPixel | null)[] = []
      for (let month = 0; month < 12; month++) {
        // Check if this day exists in this month
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        if (day > daysInMonth) {
          row.push(null) // Day doesn't exist for this month
        } else {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const pixel = pixelMap.get(dateStr)

          // Check if date is in the future
          const dateObj = new Date(dateStr + 'T00:00:00')
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          if (dateObj > today) {
            row.push(null) // Future date
          } else {
            row.push(pixel || { date: dateStr, score: null, entryCount: 0, totalMinutes: 0 })
          }
        }
      }
      grid.push(row)
    }

    return grid
  }, [pixelsData, year])

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

  const grid = buildGrid()

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
              <h1 className="text-2xl font-bold text-foreground">Year in Pixels</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Every day, one colored dot
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
                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 text-center">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.avgScore}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Avg Score</p>
                </div>
                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{stats.greatDays}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Great</p>
                </div>
                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{stats.okayDays}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Okay</p>
                </div>
                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{stats.roughDays}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Rough</p>
                </div>
              </div>
            )}

            {/* Pixel Grid */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: '320px' }}>
                <thead>
                  <tr>
                    <th className="w-8 text-[10px] text-zinc-500 font-normal text-left pr-1"></th>
                    {MONTH_LABELS.map((label) => (
                      <th
                        key={label}
                        className="text-[10px] text-zinc-500 font-normal text-center px-0"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row, dayIndex) => (
                    <tr key={dayIndex}>
                      <td className="text-[10px] text-zinc-500 text-right pr-1 py-0">
                        {dayIndex + 1}
                      </td>
                      {row.map((pixel, monthIndex) => (
                        <td key={monthIndex} className="text-center p-0">
                          {pixel ? (
                            <button
                              onClick={() => setSelectedDay(pixel)}
                              className={`inline-block w-[14px] h-[14px] rounded-[3px] m-[1px] transition-transform hover:scale-150 ${getScoreColor(pixel.score)}`}
                              aria-label={`${pixel.date}: ${getScoreLabel(pixel.score)}`}
                            />
                          ) : (
                            <span className="inline-block w-[14px] h-[14px] m-[1px]" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-zinc-300 dark:bg-zinc-800" />
                <span className="text-xs text-zinc-500">No data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-400" />
                <span className="text-xs text-zinc-500">&lt;40</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-500" />
                <span className="text-xs text-zinc-500">40-69</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
                <span className="text-xs text-zinc-500">70+</span>
              </div>
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
