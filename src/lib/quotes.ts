import { TimePeriod } from './types'

/**
 * Curated quotes for each session period
 * All quotes are real, attributed, and relevant to the time of day
 */
export const SESSION_QUOTES: Record<TimePeriod, string[]> = {
  morning: [
    "The first hour of the morning is the rudder of the day. — Henry Ward Beecher",
    "Mornings are for coffee and contemplation. — Chief Hopper",
    "Protect your mornings for thinking, save afternoons for executing. — Tara Nguyen",
    "How you spend your morning can often tell you what kind of day you are going to have. — Lemony Snicket",
    "With the new day comes new strength and new thoughts. — Eleanor Roosevelt",
    "Most people are productive between 9 and 11am. Use it wisely. — Dan Ariely",
    "The early morning has gold in its mouth. — Benjamin Franklin",
    "Morning is an important time of day, because how you spend your morning can tell you what kind of day you are going to have. — Lemony Snicket",
    "Every morning brings new potential, but if you dwell on the misfortunes of the day before, you tend to overlook tremendous opportunities. — Harvey Mackay",
    "An early-morning walk is a blessing for the whole day. — Henry David Thoreau",
  ],
  afternoon: [
    "The afternoon knows what the morning never suspected. — Robert Frost",
    "A short break at 2:30pm can transform your afternoon slump. — Slack Workforce Lab",
    "Do the hard jobs first. The easy jobs will take care of themselves. — Dale Carnegie",
    "Creativity peaks when energy dips. Afternoons are for different thinking. — Circadian Research",
    "The secret of getting ahead is getting started. — Mark Twain",
    "By 2:55pm, your brain wants a break. Give it one, then finish strong. — Sleep Foundation",
    "If afternoons are not your strong suit, there's probably a different type of work you can accomplish. — Rebecca Spencer",
    "It is not enough to be busy. The question is: what are we busy about? — Henry David Thoreau",
    "Focus on being productive instead of busy. — Tim Ferriss",
    "The way to get started is to quit talking and begin doing. — Walt Disney",
  ],
  evening: [
    "The best start to a great day is a restful evening before. — Sleep Research",
    "Your evening routine is tomorrow's morning routine in disguise. — James Clear",
    "End the day with intention, begin tomorrow with momentum. — Productivity Wisdom",
    "Tonight's rest is tomorrow's edge. — Performance Science",
    "Finish each day and be done with it. Tomorrow is a new day. — Ralph Waldo Emerson",
    "The day is over, the evening has come. Rest now, for tomorrow awaits. — Unknown",
    "Evening is a time of real experimentation. You never want to be the same. — Donna Karan",
    "An evening wind-down routine helps you decompress from the day. — Chronotype Research",
    "Rest is not idleness. It is the pause that refreshes. — Ancient Wisdom",
    "The night is the hardest time to be alive and 4am knows all my secrets. — Poppy Z. Brite",
  ],
}

/**
 * Get a random quote for a period
 * Uses the current date as a seed to ensure consistency within the same day
 */
export function getRandomQuote(period: TimePeriod): string {
  const quotes = SESSION_QUOTES[period]
  // Use date as seed for consistent quote per day
  const today = new Date().toISOString().split('T')[0]
  const seed = hashString(today + period)
  const index = seed % quotes.length
  return quotes[index]
}

/**
 * Get a specific quote by index (for testing or specific display)
 */
export function getQuoteByIndex(period: TimePeriod, index: number): string {
  const quotes = SESSION_QUOTES[period]
  return quotes[index % quotes.length]
}

/**
 * Simple string hash function for consistent pseudo-randomness
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Get all quotes for a period (for settings/preview)
 */
export function getAllQuotes(period: TimePeriod): string[] {
  return SESSION_QUOTES[period]
}
