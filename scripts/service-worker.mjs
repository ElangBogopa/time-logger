// The service worker in public/ is written by next-pwa on every build and is
// not tracked by git, so a deploy has one only if its build wrote it.
//
//   clean — before a build: remove the generated files, so a workbox or
//           swe-worker file under an old hash is not left behind and served.
//   check — after a build: fail if sw.js, or the custom-sw.js it imports,
//           is missing. Reminders and the offline cache depend on both.
//
// Only the generated names are touched; public/custom-sw.js is ours.
import { readdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC = join(process.cwd(), 'public')
const GENERATED = /^(sw\.js|workbox-[\w-]+\.js|swe-worker-[\w-]+\.js)(\.map)?$/

const mode = process.argv[2]

if (mode === 'clean') {
  for (const name of readdirSync(PUBLIC)) {
    if (GENERATED.test(name)) rmSync(join(PUBLIC, name))
  }
} else if (mode === 'check') {
  const problems = []
  const sw = join(PUBLIC, 'sw.js')
  if (!existsSync(sw)) {
    problems.push('public/sw.js was not written by the build')
  } else if (!readFileSync(sw, 'utf8').includes('custom-sw.js')) {
    problems.push('public/sw.js does not import /custom-sw.js (push handling)')
  }
  if (!existsSync(join(PUBLIC, 'custom-sw.js'))) {
    problems.push('public/custom-sw.js is missing')
  }
  if (problems.length) {
    console.error('\nService worker check FAILED:\n  - ' + problems.join('\n  - '))
    console.error('Reminders and the offline cache would not work in this build.\n')
    process.exit(1)
  }
  console.log('Service worker check passed: public/sw.js imports /custom-sw.js.')
} else {
  console.error('usage: node scripts/service-worker.mjs clean|check')
  process.exit(2)
}
