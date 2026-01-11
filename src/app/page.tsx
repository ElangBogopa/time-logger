'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TimeEntry } from '@/lib/types'
import TimeEntryForm from '@/components/TimeEntryForm'
import TimeEntriesList from '@/components/TimeEntriesList'

export default function Home() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  const fetchEntries = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('date', today)
      .eq('user_id', 'default_user')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setEntries(data as TimeEntry[])
    }
    setIsLoading(false)
  }, [today])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Time Logger</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Track how you spend your time
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add Entry
          </h2>
          <TimeEntryForm onEntryAdded={fetchEntries} />
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Today&apos;s Entries
          </h2>
          <TimeEntriesList entries={entries} isLoading={isLoading} onEntryDeleted={fetchEntries} />
        </section>
      </div>
    </div>
  )
}
