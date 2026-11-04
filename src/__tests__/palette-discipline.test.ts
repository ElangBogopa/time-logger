/**
 * @jest-environment node
 *
 * One palette, enforced.
 *
 * CLAUDE.md asks for "slate/zinc tones, no bright neons", and the app kept
 * growing them anyway — 201 saturated Tailwind utilities across 18 files,
 * doing three different jobs under one name: encoding data, signalling
 * success or failure, and decorating a settings row with a colour that meant
 * nothing at all.
 *
 * The rule this pins is the one Whoop's interface follows: a neutral canvas,
 * and colour only where it carries information. Tailwind's saturated scales
 * are not available; the muted hues in lib/palette.ts are.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const HUES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const PROPS = ['bg', 'text', 'border', 'from', 'to', 'via', 'stroke', 'fill', 'ring']
const SATURATED = new RegExp(`\\b(${PROPS.join('|')})-(${HUES.join('|')})-\\d{2,3}\\b`, 'g')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return name === '__tests__' ? [] : sourceFiles(path)
    }
    return /\.tsx?$/.test(path) ? [path] : []
  })
}

it('uses no saturated Tailwind colours anywhere in the app', () => {
  const offenders: string[] = []

  for (const file of sourceFiles('src')) {
    const matches = readFileSync(file, 'utf-8').match(SATURATED)
    if (matches) offenders.push(`${file}: ${[...new Set(matches)].join(', ')}`)
  }

  // Reach for lib/palette.ts instead: AGGREGATED_CLASSES for a category,
  // STATUS_CLASSES for good/warn/bad, METRIC_HEX for a hero metric. If a
  // colour is decoration rather than information, it should be
  // text-muted-foreground or bg-secondary.
  expect(offenders).toEqual([])
})

it('scans a meaningful number of files, so the check cannot pass by accident', () => {
  expect(sourceFiles('src').length).toBeGreaterThan(100)
})

it('writes no saturated hex literals outside the palette either', () => {
  // ActivityList carried a sixth copy of the aggregated colours as raw hex
  // — '#3b82f6', '#22c55e' — which is how it survived the sweep that
  // removed the utility classes.
  const BANNED = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#06b6d4', '#10b981']
  const offenders: string[] = []

  for (const file of sourceFiles('src')) {
    if (file.endsWith('palette.ts')) continue
    const text = readFileSync(file, 'utf-8').toLowerCase()
    const found = BANNED.filter((hex) => text.includes(hex))
    if (found.length) offenders.push(`${file}: ${found.join(', ')}`)
  }

  expect(offenders).toEqual([])
})
