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
