import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = { title: 'Terms — Better' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="11 November 2026">
      <section>
        <h2>What Better is</h2>
        <p>
          Better is a personal time log and planner. It reads your calendar, helps you plan around
          it, and records what you tell it you did. By signing in you agree to these terms.
        </p>
      </section>

      <section>
        <h2>Your account and your data</h2>
        <ul>
          <li>You sign in with a Google account, and you are responsible for keeping it secure.</li>
          <li>What you log is yours. Better stores it to provide the service and for nothing else.</li>
          <li>
            How it is stored and what is sent elsewhere is set out in the{' '}
            <Link href="/privacy" className="underline hover:no-underline">Privacy</Link> page.
          </li>
        </ul>
      </section>

      <section>
        <h2>The scores and the suggestions</h2>
        <p>
          Body, Mind and Heart, the commentary and the suggested times are computed from what you
          log, using published research that the app cites. They are a guide to how you spend your
          time. They are <strong>not medical, psychological or professional advice</strong>, and the
          categories and commentary are produced by an AI model that can be wrong.
        </p>
      </section>

      <section>
        <h2>Using it fairly</h2>
        <p>
          Do not try to access another person&rsquo;s data, disrupt the service, or use it to break
          the law.
        </p>
      </section>

      <section>
        <h2>No guarantees</h2>
        <p>
          Better is provided as it is. It may change, have faults, or stop being offered, and it
          comes with no warranty. To the extent the law allows, the people who make it are not
          liable for loss arising from its use.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If these terms change in a way that matters, the date at the top changes with them and the
          app will say so.
        </p>
      </section>
    </LegalPage>
  )
}
