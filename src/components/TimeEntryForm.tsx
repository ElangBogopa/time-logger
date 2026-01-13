'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getLocalDateString } from '@/lib/types'
import TimeRangePicker from './TimeRangePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface TimeEntryFormProps {
  onEntryAdded: () => void
  onShowToast: (message: string) => void
  userId: string
  selectedDate?: string
}

export default function TimeEntryForm({ onEntryAdded, onShowToast, userId, selectedDate }: TimeEntryFormProps) {
  const [date, setDate] = useState(selectedDate || getLocalDateString())
  const [activity, setActivity] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [duration, setDuration] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Get category from OpenAI
      const categoryResponse = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity }),
      })

      if (!categoryResponse.ok) {
        throw new Error('Failed to categorize activity')
      }

      const { category } = await categoryResponse.json()

      // Save to Supabase and get the new entry
      const newEntry = {
        user_id: userId,
        date,
        activity,
        category,
        duration_minutes: parseInt(duration, 10),
        start_time: startTime || null,
        end_time: endTime || null,
        description: description || null,
      }

      const { data: insertedEntry, error: insertError } = await supabase
        .from('time_entries')
        .insert(newEntry)
        .select()
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      // Fetch all entries for the day to provide context for commentary
      const { data: dayEntries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('date', date)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      // Generate commentary
      let generatedCommentary: string | null = null
      try {
        const commentaryResponse = await fetch('/api/commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry: insertedEntry,
            dayEntries: dayEntries || [],
          }),
        })

        if (commentaryResponse.ok) {
          const { commentary } = await commentaryResponse.json()
          generatedCommentary = commentary

          // Update the entry with the commentary
          await supabase
            .from('time_entries')
            .update({ commentary })
            .eq('id', insertedEntry.id)
        } else {
          generatedCommentary = null
        }
      } catch {
        // Commentary generation failed, but entry was saved - continue
        generatedCommentary = null
      }

      // Reset form
      setActivity('')
      setStartTime('')
      setEndTime('')
      setDuration('')
      setDescription('')

      // Show different toast based on whether commentary generated
      if (generatedCommentary) {
        onShowToast(generatedCommentary)
      } else {
        onShowToast('Entry logged! (AI commentary unavailable)')
      }

      onEntryAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label>Time Range</Label>
          <TimeRangePicker
            startTime={startTime}
            endTime={endTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            onDurationChange={(minutes) => setDuration(String(minutes))}
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="activity">Activity</Label>
          <Input
            id="activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            required
            placeholder="e.g., Writing code for auth feature, Team standup, Reading documentation..."
          />
          <p className="text-xs text-muted-foreground">
            Category will be auto-assigned based on your activity
          </p>
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="description">
            Notes <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any additional details..."
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Categorizing & Saving...
          </>
        ) : (
          'Add Entry'
        )}
      </Button>
    </form>
  )
}
