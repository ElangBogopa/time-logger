/**
 * @jest-environment node
 *
 * Categoriser evaluation. Hits the real OpenAI API with the real production
 * prompt, so it is not part of `npm test` — run it with `npm run eval`.
 *
 * Reports per-group accuracy rather than one number, because the interesting
 * question is which kinds of activity it misreads, and prints every
 * disagreement so the expectations can be argued with.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import { CATEGORIES, TimeCategory } from '../../src/lib/types'
import { buildCategorizeSystemPrompt } from '../../src/lib/prompts'
import { buildDataset, Case } from './dataset'

const LIMIT = Number(process.env.EVAL_LIMIT || 1000)
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 8)

function loadEnv() {
  const file = path.join(process.cwd(), '.env.local')
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

interface Result extends Case {
  answer: string
  ok: boolean | null
  promptTokens: number
  completionTokens: number
}

async function run(): Promise<Result[]> {
  loadEnv()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const system = buildCategorizeSystemPrompt()
  const cases = buildDataset(LIMIT)
  const results: Result[] = new Array(cases.length)

  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= cases.length) return
      const c = cases[i]
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: c.text },
          ],
          temperature: 0,
          max_tokens: 20,
        })
        const raw = completion.choices[0]?.message?.content?.trim().toLowerCase() || ''
        // The route applies the same guard: anything unrecognised becomes other.
        const answer = (CATEGORIES as readonly string[]).includes(raw) ? raw : 'other'
        results[i] = {
          ...c,
          answer,
          ok: c.accept ? c.accept.includes(answer as TimeCategory) : null,
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
        }
      } catch (err) {
        results[i] = {
          ...c,
          answer: `ERROR: ${err instanceof Error ? err.message : 'unknown'}`,
          ok: false,
          promptTokens: 0,
          completionTokens: 0,
        }
      }
      if ((i + 1) % 100 === 0) process.stdout.write(`  …${i + 1}/${cases.length}\n`)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

const out = (line = '') => process.stdout.write(line + '\n')

function report(results: Result[]) {
  const scored = results.filter((r) => r.ok !== null)
  const correct = scored.filter((r) => r.ok).length

  out(`\n${'='.repeat(64)}`)
  out(`CATEGORISATION — ${results.length} entries`)
  out('='.repeat(64))
  out(`Scored: ${correct}/${scored.length} (${((correct / scored.length) * 100).toFixed(1)}%)`)

  const groups = Array.from(new Set(results.map((r) => r.group)))
  out('\nBy group:')
  for (const g of groups) {
    const rows = results.filter((r) => r.group === g)
    const s = rows.filter((r) => r.ok !== null)
    if (s.length === 0) {
      const dist = new Map<string, number>()
      for (const r of rows) dist.set(r.answer, (dist.get(r.answer) || 0) + 1)
      const top = [...dist.entries()].sort((a, b) => b[1] - a[1])
      out(`  ${g.padEnd(22)} (unscored, n=${rows.length}): ${top.map(([a, n]) => `${a} ${Math.round((n / rows.length) * 100)}%`).join(', ')}`)
    } else {
      const ok = s.filter((r) => r.ok).length
      const pct = ((ok / s.length) * 100).toFixed(0)
      const bar = '█'.repeat(Math.round((ok / s.length) * 20)).padEnd(20, '·')
      out(`  ${g.padEnd(22)} ${bar} ${pct}%  (${ok}/${s.length})`)
    }
  }

  const wrong = results.filter((r) => r.ok === false)
  if (wrong.length) {
    out(`\nDisagreements (${wrong.length}), de-duplicated:`)
    const seen = new Set<string>()
    for (const r of wrong) {
      const key = `${r.text.trim().toLowerCase()}→${r.answer}`
      if (seen.has(key)) continue
      seen.add(key)
      out(`  "${r.text.trim()}" → ${r.answer}  (wanted ${r.accept?.join(' or ')})`)
    }
  }

  const promptTokens = results.reduce((s, r) => s + r.promptTokens, 0)
  const completionTokens = results.reduce((s, r) => s + r.completionTokens, 0)
  // gpt-4o-mini list price at time of writing; treat as an estimate.
  const cost = (promptTokens / 1e6) * 0.15 + (completionTokens / 1e6) * 0.6
  out(`\nTokens: ${promptTokens} in, ${completionTokens} out — about $${cost.toFixed(4)}`)
}

it('categorises the dataset', async () => {
  const results = await run()
  report(results)
  expect(results.filter((r) => r.answer.startsWith('ERROR:')).length).toBe(0)
}, 1_800_000)
