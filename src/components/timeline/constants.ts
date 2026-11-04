import { TimeCategory, AggregatedCategory, CATEGORY_LABELS, getAggregatedCategory } from '@/lib/types'
import { AGGREGATED_CLASSES } from '@/lib/palette'

// Timeline layout constants
// 0.75 px/min = 45px/hour → ~13 hours visible on a 600px screen (matches Google/Apple Calendar density)
export const PIXELS_PER_MINUTE = 0.75
export const HOUR_HEIGHT = 60 * PIXELS_PER_MINUTE // 45px per hour
// Tall enough for one line of text: a 15-minute block is 11px at this
// scale, and a label in 11px of box is a sliver, not a label.
export const MIN_BLOCK_HEIGHT = 28

// Interaction thresholds
export const DRAG_THRESHOLD = 20 // pixels - minimum drag distance to count as intentional drag (after hold confirmed)
export const SCROLL_CANCEL_THRESHOLD = 5 // pixels - ANY movement this much means user is scrolling
export const STILLNESS_CHECK_DELAY = 100 // ms - must be still this long before hold timer even starts
export const TOUCH_HOLD_DELAY = 400 // ms - after stillness confirmed, hold this long to create entry
export const GHOST_TAP_THRESHOLD = 150 // ms - release before this = tap to confirm
export const ENTRY_EDGE_ZONE = 0.2 // 20% of entry height for resize zones
export const ENTRY_HOLD_DELAY = 200 // ms - hold before moving entry (touch only)

/**
 * Border and tint classes for each bucket, from the one palette. The hexes
 * used to be written out here, again in TimelineEntry.tsx and again in the
 * day review; the TimelineEntry copy was typed `Record<string, …>` and so
 * never noticed that `faith` was missing.
 *
 * bgLight and bgDark held the same colour ('bg-[#X]/15 dark:bg-[#X]/15'), so
 * there is now one tint.
 */
export const AGGREGATED_COLORS = Object.fromEntries(
  Object.entries(AGGREGATED_CLASSES).map(([bucket, classes]) => [
    bucket,
    { border: classes.border, tint: classes.tint },
  ])
) as Record<AggregatedCategory, { border: string; tint: string }>

// Helper function to get category colors
export function getCategoryColors(category: TimeCategory): { bg: string; border: string; text: string } {
  const colors = AGGREGATED_COLORS[getAggregatedCategory(category)]
  return {
    bg: colors.tint,
    border: colors.border,
    text: 'text-zinc-800 dark:text-zinc-200',
  }
}

// Computed category colors record
export const CATEGORY_COLORS: Record<TimeCategory, { bg: string; border: string; text: string }> = Object.fromEntries(
  (Object.keys(CATEGORY_LABELS) as TimeCategory[]).map(cat => [cat, getCategoryColors(cat)])
) as Record<TimeCategory, { bg: string; border: string; text: string }>