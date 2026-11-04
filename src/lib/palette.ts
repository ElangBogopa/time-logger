/**
 * The palette. Every colour the app paints data with is defined here once.
 *
 * Before this file there were two palettes. Categories used a muted family
 * (slate blue, sage, dusty amber…) and the dashboard rings, the weekly bars
 * and the session cards used saturated Tailwind 500s — green-500, blue-500,
 * amber-500 — with a glow. CLAUDE.md asks for "slate/zinc tones, no bright
 * neons", so the muted family is the one that stays, and the metrics now take
 * their colour from the bucket they are computed from:
 *
 *   Body  ← the body bucket       (sage)
 *   Mind  ← the focus bucket      (slate blue)
 *   Heart ← the connection bucket (muted rose)
 *
 * so a ring is the same colour as the timeline blocks that filled it.
 *
 * The aggregated colours also existed in four places — timeline/constants.ts,
 * timeline/TimelineEntry.tsx, DayReviewContent.tsx and here in spirit — and
 * the TimelineEntry copy was typed `Record<string, …>`, so it silently lost
 * `faith` when that category was added and rendered those entries with
 * undefined classes.
 */

import type { AggregatedCategory } from './types'

/** Source of truth for the aggregated (energy view) colours. */
export const AGGREGATED_HEX = {
  focus: '#6B8CAE', // slate blue
  ops: '#8B8680', // warm grey
  body: '#7D9B8A', // sage
  recovery: '#B5A07A', // dusty amber
  connection: '#A0848E', // muted rose
  faith: '#8A7CA8', // muted violet
  escape: '#7A7D82', // cool grey
} as const satisfies Record<AggregatedCategory, string>

/**
 * The same colours as Tailwind classes. These have to be written out as
 * literals: Tailwind v4 scans source text for class names, so a class built
 * from AGGREGATED_HEX at runtime produces no CSS. `palette.test.ts` checks
 * every literal here still matches its hex above.
 */
export const AGGREGATED_CLASSES = {
  focus: { bg: 'bg-[#6B8CAE]', text: 'text-[#6B8CAE]', border: 'border-[#6B8CAE]', tint: 'bg-[#6B8CAE]/15' },
  ops: { bg: 'bg-[#8B8680]', text: 'text-[#8B8680]', border: 'border-[#8B8680]', tint: 'bg-[#8B8680]/15' },
  body: { bg: 'bg-[#7D9B8A]', text: 'text-[#7D9B8A]', border: 'border-[#7D9B8A]', tint: 'bg-[#7D9B8A]/15' },
  recovery: { bg: 'bg-[#B5A07A]', text: 'text-[#B5A07A]', border: 'border-[#B5A07A]', tint: 'bg-[#B5A07A]/15' },
  connection: { bg: 'bg-[#A0848E]', text: 'text-[#A0848E]', border: 'border-[#A0848E]', tint: 'bg-[#A0848E]/15' },
  faith: { bg: 'bg-[#8A7CA8]', text: 'text-[#8A7CA8]', border: 'border-[#8A7CA8]', tint: 'bg-[#8A7CA8]/15' },
  escape: { bg: 'bg-[#7A7D82]', text: 'text-[#7A7D82]', border: 'border-[#7A7D82]', tint: 'bg-[#7A7D82]/15' },
} as const satisfies Record<AggregatedCategory, { bg: string; text: string; border: string; tint: string }>

/**
 * The three sessions, in palette hues: dusty amber for the morning, slate
 * blue for the afternoon, muted violet for the evening. They were
 * amber→orange, blue→cyan→teal and indigo→purple→pink gradients, which made
 * the session page and its summary popup the loudest screens in the app.
 */
export const PERIOD_CLASSES = {
  morning: { icon: 'text-[#B5A07A]', tint: 'bg-[#B5A07A]/15', border: 'border-[#B5A07A]/30' },
  afternoon: { icon: 'text-[#6B8CAE]', tint: 'bg-[#6B8CAE]/15', border: 'border-[#6B8CAE]/30' },
  evening: { icon: 'text-[#8A7CA8]', tint: 'bg-[#8A7CA8]/15', border: 'border-[#8A7CA8]/30' },
} as const

/** Fill colour for each hero metric — the bucket it is computed from. */
export const METRIC_HEX = {
  body: AGGREGATED_HEX.body,
  focus: AGGREGATED_HEX.focus,
  social: AGGREGATED_HEX.connection,
} as const

/**
 * Lighter variants for text and for numerals inside a ring. The metric sheets
 * and cards are dark surfaces (zinc-800/900); these clear 4.5:1 there, as the
 * 400-level colours they replace were chosen to.
 */
export const METRIC_TEXT_HEX = {
  body: '#9BB5A6',
  focus: '#93AEC9',
  social: '#C0A3AC',
} as const

/** Status colours, in the same family: sage, dusty amber, muted clay. */
export const STATUS_HEX = {
  green: AGGREGATED_HEX.body,
  yellow: AGGREGATED_HEX.recovery,
  red: '#A8706A',
} as const

export const STATUS_TEXT_HEX = {
  green: '#9BB5A6',
  yellow: '#CBB894',
  red: '#C79089',
} as const

/** Status as Tailwind classes, for tinted rows and cards. Literals, as above. */
/**
 * `tint` and `border` are for a panel that is already set apart by something
 * else — a heading, an icon, a position. `tintStrong` and `borderStrong` are
 * for a row whose whole state is the colour: a muted hue at 10% over the card
 * lands on rgb(34,37,38) against a neutral row's rgb(32,32,35), which is not
 * a difference anyone can see. At 20% it is.
 */
export const STATUS_CLASSES = {
  green: { tint: 'bg-[#7D9B8A]/10', tintStrong: 'bg-[#7D9B8A]/20', border: 'border-[#7D9B8A]/25', borderStrong: 'border-[#7D9B8A]/40', iconBg: 'bg-[#7D9B8A]/15', icon: 'text-[#7D9B8A]', text: 'text-[#9BB5A6]', solid: 'bg-[#7D9B8A]', stroke: 'stroke-[#7D9B8A]' },
  yellow: { tint: 'bg-[#B5A07A]/10', tintStrong: 'bg-[#B5A07A]/20', border: 'border-[#B5A07A]/25', borderStrong: 'border-[#B5A07A]/40', iconBg: 'bg-[#B5A07A]/15', icon: 'text-[#B5A07A]', text: 'text-[#CBB894]', solid: 'bg-[#B5A07A]', stroke: 'stroke-[#B5A07A]' },
  red: { tint: 'bg-[#A8706A]/10', tintStrong: 'bg-[#A8706A]/20', border: 'border-[#A8706A]/25', borderStrong: 'border-[#A8706A]/40', iconBg: 'bg-[#A8706A]/15', icon: 'text-[#A8706A]', text: 'text-[#C79089]', solid: 'bg-[#A8706A]', stroke: 'stroke-[#A8706A]' },
} as const
