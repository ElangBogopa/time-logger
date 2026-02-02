'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Weekly targets page has been removed. Redirect to settings.
export default function IntentionsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/settings')
  }, [router])

  return null
}
