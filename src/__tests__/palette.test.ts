/**
 * @jest-environment node
 *
 * The palette's Tailwind classes have to be written out as literals, because
 * Tailwind v4 scans source text for class names and emits no CSS for a class
 * assembled at runtime. That means the hex appears twice — once as a value,
 * once inside a class string — so these tests check the two never drift, and
 * that every aggregated category has an entry at all. The old TimelineEntry
 * copy of this map was typed `Record<string, …>` and silently lost `faith`.
 */

import { AGGREGATED_HEX, AGGREGATED_CLASSES, METRIC_HEX, STATUS_HEX, STATUS_CLASSES, SEQUENTIAL_CLASSES } from '@/lib/palette'
import { ENERGY_VIEW } from '@/lib/types'
import type { AggregatedCategory } from '@/lib/types'

const BUCKETS = Object.keys(ENERGY_VIEW) as AggregatedCategory[]

it('covers every aggregated category', () => {
  expect(Object.keys(AGGREGATED_HEX).sort()).toEqual([...BUCKETS].sort())
  expect(Object.keys(AGGREGATED_CLASSES).sort()).toEqual([...BUCKETS].sort())
})

it('writes the same hex in the classes as in the values', () => {
  for (const bucket of BUCKETS) {
    const hex = AGGREGATED_HEX[bucket]
    const classes = AGGREGATED_CLASSES[bucket]
    expect(classes.bg).toBe(`bg-[${hex}]`)
    expect(classes.text).toBe(`text-[${hex}]`)
    expect(classes.border).toBe(`border-[${hex}]`)
    expect(classes.tint).toBe(`bg-[${hex}]/15`)
  }
})

it('gives each status class set the hex it is named for', () => {
  for (const status of ['green', 'yellow', 'red'] as const) {
    const hex = STATUS_HEX[status]
    expect(STATUS_CLASSES[status].tint).toBe(`bg-[${hex}]/10`)
    expect(STATUS_CLASSES[status].tintStrong).toBe(`bg-[${hex}]/20`)
    expect(STATUS_CLASSES[status].borderStrong).toBe(`border-[${hex}]/40`)
    expect(STATUS_CLASSES[status].border).toBe(`border-[${hex}]/25`)
    expect(STATUS_CLASSES[status].iconBg).toBe(`bg-[${hex}]/15`)
    expect(STATUS_CLASSES[status].icon).toBe(`text-[${hex}]`)
    expect(STATUS_CLASSES[status].solid).toBe(`bg-[${hex}]`)
    expect(STATUS_CLASSES[status].stroke).toBe(`stroke-[${hex}]`)
  }
})

it('colours each metric as the bucket it is computed from', () => {
  // A ring should be the colour of the timeline blocks that filled it.
  expect(METRIC_HEX.body).toBe(AGGREGATED_HEX.body)
  expect(METRIC_HEX.focus).toBe(AGGREGATED_HEX.focus)
  expect(METRIC_HEX.social).toBe(AGGREGATED_HEX.connection)
})

it('keeps every colour muted', () => {
  // CLAUDE.md: "Muted palette: Slate/zinc tones, no bright neons." A bright
  // Tailwind 500 such as #22c55e scores ~0.75 here; the muted family sits
  // around 0.2. This is the guard that stopped the second palette growing.
  const saturation = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return max === 0 ? 0 : (max - min) / max
  }

  for (const hex of [...Object.values(AGGREGATED_HEX), ...Object.values(STATUS_HEX), ...Object.values(METRIC_HEX)]) {
    expect(saturation(hex)).toBeLessThan(0.45)
  }
})

it('ramps the year grid in one hue, from empty to full', () => {
  // A heatmap wants one colour getting stronger, not three categories: a
  // day with one target met is not "bad", it is less than a day with three.
  // Five steps: nothing logged, then none / one / two / three on target.
  // The first two were one square until a screenshot showed a logged day
  // that met no target looking exactly like a day off.
  expect(SEQUENTIAL_CLASSES).toHaveLength(5)
  for (const step of SEQUENTIAL_CLASSES.slice(1)) {
    expect(step).toContain(AGGREGATED_HEX.body)
  }
  expect(SEQUENTIAL_CLASSES[0]).not.toContain('#')
})
