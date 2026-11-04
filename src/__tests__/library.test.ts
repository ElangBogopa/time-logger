/**
 * @jest-environment node
 *
 * The research behind the metrics.
 *
 * The app had two research pages and they had already drifted: /library
 * ("The Science") listed one source, /guide listed seven, and neither knew
 * about the other. Both now read lib/library.ts. The test that matters is
 * the last one: every hero metric must have evidence behind it, because the
 * detail sheet now offers to show it.
 */

import { LIBRARY, entriesForMetric, foundationalEntries, linkHost } from '@/lib/library'
import { METRIC_LABELS } from '@/lib/metrics-calc'
import type { MetricKey } from '@/lib/chart-colors'

const METRICS = Object.keys(METRIC_LABELS) as MetricKey[]

it('gives every entry what a reader needs to judge it', () => {
  for (const entry of LIBRARY) {
    expect(entry.title.length).toBeGreaterThan(0)
    expect(entry.author.length).toBeGreaterThan(0)
    expect(entry.year).toBeGreaterThan(1900)
    // A finding the reader can check, and what the app did about it. The
    // second is the part no competitor writes down.
    expect(entry.finding.length).toBeGreaterThan(40)
    expect(entry.howWeUseIt.length).toBeGreaterThan(40)
  }
})

it('uses real metric keys for its tags', () => {
  for (const entry of LIBRARY) {
    for (const metric of entry.metrics) expect(METRICS).toContain(metric)
  }
})

it('has no duplicate ids', () => {
  const ids = LIBRARY.map((entry) => entry.id)
  expect(new Set(ids).size).toBe(ids.length)
})

it('separates the foundational entries from the per-metric ones', () => {
  expect(foundationalEntries().length).toBeGreaterThan(0)
  for (const entry of foundationalEntries()) expect(entry.metrics).toEqual([])

  const tagged = LIBRARY.filter((entry) => entry.metrics.length > 0)
  expect(tagged.length + foundationalEntries().length).toBe(LIBRARY.length)
})

it('backs every hero metric with at least one source', () => {
  // The detail sheet shows a "Why this is measured" block per metric and
  // links into the library. A metric with nothing behind it would render
  // nothing there — and would be a metric with nothing behind it.
  for (const metric of METRICS) {
    expect(entriesForMetric(metric).length).toBeGreaterThan(0)
  }
})

it('links out wherever a source can be read', () => {
  // Not every source is online (the BRAC paper is not), but a link that
  // exists must be a real URL.
  for (const entry of LIBRARY) {
    if (entry.link) expect(entry.link).toMatch(/^https:\/\//)
  }
})

describe('where the links go', () => {
  // Someone who has just read a paragraph about a study wants the study,
  // not a checkout. Books used to link to Amazon product pages.
  it('never sends anyone to a shop', () => {
    for (const entry of LIBRARY) {
      if (!entry.link) continue
      expect(entry.link).not.toMatch(/amazon\.|\/dp\/|bookshop\.org|barnesandnoble/)
    }
  })

  it('sends research to its DOI, or to whoever conducted it', () => {
    // Never to a book about the study: the Harvard entry pointed at The Good
    // Life, which is Waldinger's account of the work rather than the work.
    const allowed = ['doi.org', 'who.int', 'adultdevelopmentstudy.org']
    for (const entry of LIBRARY) {
      if (!entry.link || entry.kind === 'book') continue
      expect(allowed).toContain(linkHost(entry.link))
    }
  })

  it('sends books to Open Library', () => {
    // Non-commercial, no region lock, no affiliate code, and it points
    // onward to borrowing or buying wherever the reader is.
    for (const entry of LIBRARY) {
      if (!entry.link || entry.kind !== 'book') continue
      expect(linkHost(entry.link)).toBe('openlibrary.org')
      expect(entry.link).toMatch(/openlibrary\.org\/works\/OL\d+W$/)
    }
  })

  it('names the destination so nobody taps blind', () => {
    expect(linkHost('https://www.who.int/news/item/x')).toBe('who.int')
    expect(linkHost('https://doi.org/10.1038/nrn2298')).toBe('doi.org')
    expect(linkHost('not a url')).toBe('the source')
  })
})
