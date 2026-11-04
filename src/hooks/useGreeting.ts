'use client'

import { useState } from 'react'
import { TimePeriod, getCurrentPeriod } from '@/lib/types'
import { getRandomQuote } from '@/lib/quotes'

interface GreetingData {
  text: string
}

interface UseGreetingReturn {
  greeting: GreetingData
  quotes: Record<TimePeriod, string>
  currentPeriod: TimePeriod
}

function getTimeOfDayGreeting(name?: string, hour?: number | null): GreetingData {
  const h = hour ?? 12 // Default to noon for server render
  const nameGreeting = name ? `, ${name}` : ''

  // Handle late-night hours (24-27 = midnight to 3am, still evening)
  // The emoji that used to come with each greeting is gone: GreetingHeader
  // draws the matching lucide icon from currentPeriod instead.
  if (h >= 24) {
    return { text: `Good evening${nameGreeting}` }
  } else if (h < 12) {
    return { text: `Good morning${nameGreeting}` }
  } else if (h < 18) {
    return { text: `Good afternoon${nameGreeting}` }
  } else {
    return { text: `Good evening${nameGreeting}` }
  }
}

export function useGreeting(userName?: string, currentHour: number | null = null): UseGreetingReturn {
  const currentPeriod = currentHour !== null ? getCurrentPeriod(currentHour) : 'morning'
  const greeting = getTimeOfDayGreeting(userName, currentHour)

  // Get quotes for each period (stable per day)
  const [quotes] = useState<Record<TimePeriod, string>>(() => ({
    morning: typeof window !== 'undefined' ? getRandomQuote('morning') : '',
    afternoon: typeof window !== 'undefined' ? getRandomQuote('afternoon') : '',
    evening: typeof window !== 'undefined' ? getRandomQuote('evening') : '',
  }))

  return {
    greeting,
    quotes,
    currentPeriod,
  }
}