import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = { title: 'Privacy — Better' }

/**
 * Written from what the code does, section by section. If the app starts
 * storing or sending something new, this page is part of that change.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="12 November 2026">
      <section>
        <h2>The short version</h2>
        <p>
          Better keeps what you log so it can show it back to you. It reads your Google Calendar and
          never writes to it. It has no adverts and no analytics trackers, and it does not sell or
          share your data.
        </p>
      </section>

      <section>
        <h2>What Better stores</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, your email address and your Google account ID,
            from signing in with Google.
          </li>
          <li>
            <strong>What you log:</strong> each activity, its times, any notes you add, the category
            it was given, and the commentary written about it — including replies you send to that
            commentary.
          </li>
          <li>
            <strong>What you plan:</strong> your goals, the tasks you set for a day and the times you
            give them.
          </li>
          <li>
            <strong>Around the log:</strong> which sessions you wrapped up, mood check-ins, saved day
            reviews, and any feedback you send.
          </li>
        </ul>
      </section>

      <section>
        <h2>Google Calendar and Tasks</h2>
        <p>
          Better asks Google for <strong>read-only</strong> access to your calendar events and your
          tasks. It cannot create, change or delete anything in your Google account.
        </p>
        <p>
          Calendar events are fetched to be shown alongside your day. An event is only stored by
          Better if you confirm it, at which point it becomes one of your own entries. Your Google
          access is held in your encrypted sign-in cookie rather than copied into the database.
        </p>
      </section>

      <section>
        <h2>What is sent to an AI provider</h2>
        <p>
          To categorise an activity and to write commentary, Better sends text to OpenAI&rsquo;s API:
          the activity you typed and any notes on it, and for reviews a summary of the day or week
          (such as hours per category). Your name and email address are not included.
        </p>
      </section>

      <section>
        <h2>Where it lives and who can see it</h2>
        <ul>
          <li>The database is hosted by Supabase and the app by Vercel.</li>
          <li>Error reports go to Sentry so that crashes can be fixed.</li>
          <li>
            Your entries are not end-to-end encrypted. The person who runs Better can technically
            access the database. They are not read as a matter of course, and they are never shared
            or sold.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Two, both needed for the app to work: one keeps you signed in, and one protects the forms
          you submit. Your browser also caches some of your own data on your device so screens load
          without a spinner. There are no advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>Leaving</h2>
        <p>
          <strong>More → Export your data</strong> gives you a copy of what Better holds about you:
          everything as one file, or your log alone as a spreadsheet.
        </p>
        <p>
          <strong>More → Delete account</strong> removes your account and everything in it from
          Better&rsquo;s database, there and then, and ends Better&rsquo;s access to your Google
          account. It cannot be undone. Backups kept by the database host may hold a copy for a
          short time after that, until they expire.
        </p>
        <p>
          You can also remove Better&rsquo;s access to your Google account yourself at any time, from
          your Google account&rsquo;s security settings.
        </p>
      </section>

      <section>
        <p>
          See also the <Link href="/terms" className="underline hover:no-underline">Terms</Link>.
        </p>
      </section>
    </LegalPage>
  )
}
