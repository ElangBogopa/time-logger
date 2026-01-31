import { TimeCategory } from '@/lib/types'

// Timeline layout constants
// 0.75 px/min = 45px/hour → ~13 hours visible on a 600px screen (matches Google/Apple Calendar density)
export const PIXELS_PER_MINUTE = 0.75
export const HOUR_HEIGHT = 60 * PIXELS_PER_MINUTE // 45px per hour
export const MIN_BLOCK_HEIGHT = 20 // Minimum height for very short entries

// Interaction thresholds
export const DRAG_THRESHOLD = 20 // pixels - minimum drag distance to count as intentional drag (after hold confirmed)
export const SCROLL_CANCEL_THRESHOLD = 5 // pixels - ANY movement this much means user is scrolling
export const STILLNESS_CHECK_DELAY = 100 // ms - must be still this long before hold timer even starts
export const TOUCH_HOLD_DELAY = 400 // ms - after stillness confirmed, hold this long to create entry
export const GHOST_TAP_THRESHOLD = 150 // ms - release before this = tap to confirm
export const ENTRY_EDGE_ZONE = 0.2 // 20% of entry height for resize zones
export const ENTRY_HOLD_DELAY = 200 // ms - hold before moving entry (touch only)

// Aggregated color palette — 6 muted colors mapped to energy categories
export const AGGREGATED_COLORS: Record<string, { border: string; bgLight: string; bgDark: string }> = {
  focus:      { border: 'border-[#6B8CAE]', bgLight: 'bg-[#6B8CAE]/15', bgDark: 'dark:bg-[#6B8CAE]/15' },      // Slate blue
  ops:        { border: 'border-[#8B8680]', bgLight: 'bg-[#8B8680]/15', bgDark: 'dark:bg-[#8B8680]/15' },        // Warm gray
  body:       { border: 'border-[#7D9B8A]', bgLight: 'bg-[#7D9B8A]/15', bgDark: 'dark:bg-[#7D9B8A]/15' },       // Sage green
  recovery:   { border: 'border-[#B5A07A]', bgLight: 'bg-[#B5A07A]/15', bgDark: 'dark:bg-[#B5A07A]/15' },   // Dusty amber
  connection: { border: 'border-[#A0848E]', bgLight: 'bg-[#A0848E]/15', bgDark: 'dark:bg-[#A0848E]/15' }, // Muted rose
  escape:     { border: 'border-[#7A7D82]', bgLight: 'bg-[#7A7D82]/15', bgDark: 'dark:bg-[#7A7D82]/15' },     // Cool gray
}

// Map each TimeCategory → aggregated category (mirrors ENERGY_VIEW from types.ts)
export const CATEGORY_TO_AGGREGATED: Record<TimeCategory, string> = {
  deep_work: 'focus',
  learning: 'focus',
  creating: 'focus',
  shallow_work: 'ops',
  meetings: 'ops',
  admin: 'ops',
  errands: 'ops',
  chores: 'ops',
  commute: 'ops',
  exercise: 'body',
  movement: 'body',
  meals: 'body',
  sleep: 'body',
  rest: 'recovery',
  self_care: 'recovery',
  social: 'connection',
  calls: 'connection',
  entertainment: 'escape',
  other: 'escape',
}

// Helper function to get category colors
function getCategoryColors(category: TimeCategory): { bg: string; border: string; text: string } {
  const agg = CATEGORY_TO_AGGREGATED[category] || 'escape'
  const colors = AGGREGATED_COLORS[agg]
  return {
    bg: `${colors.bgLight} ${colors.bgDark}`,
    border: colors.border,
    text: 'text-zinc-800 dark:text-zinc-200',
  }
}

// Computed category colors record
export const CATEGORY_COLORS: Record<TimeCategory, { bg: string; border: string; text: string }> = Object.fromEntries(
  (Object.keys(CATEGORY_TO_AGGREGATED) as TimeCategory[]).map(cat => [cat, getCategoryColors(cat)])
) as Record<TimeCategory, { bg: string; border: string; text: string }>