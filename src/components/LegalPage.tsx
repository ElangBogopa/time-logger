import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * The frame for the two plain-language pages the sign-in screen points to.
 * It said "you agree to our Terms of Service and Privacy Policy" for a long
 * time before either existed.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-lg px-5 pt-6 pb-24">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Better
      </Link>
      <h1 className="page-title mt-2">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated {updated}</p>
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_p+p]:mt-2 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:space-y-1.5">
        {children}
      </div>
    </main>
  )
}
