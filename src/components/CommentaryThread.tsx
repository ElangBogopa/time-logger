'use client'

import { useCallback, useRef, useState } from 'react'
import { MessageCircle, Loader2, Send } from 'lucide-react'
import { csrfFetch } from '@/lib/api'

/**
 * Follow-up conversation on a piece of AI commentary.
 *
 * One component for every surface that generates commentary — the day review
 * and the session summary today, entries and the weekly review later. The
 * subject is just a key, so adding a surface is a prop, not a second copy of
 * this logic.
 *
 * Deliberately lazy: nothing is fetched until the thread is opened, so a
 * screen that nobody asks a question on costs no extra request.
 */

export type CommentarySubject = 'day' | 'session' | 'entry' | 'week'

interface Message {
  seq: number
  role: 'user' | 'assistant'
  content: string
}

interface CommentaryThreadProps {
  subjectType: CommentarySubject
  /** day/week: YYYY-MM-DD · session: YYYY-MM-DD:period · entry: uuid */
  subjectKey: string
  /** The commentary being replied to, snapshotted server-side on the first send. */
  commentary: string | null
  /** 'dark' for the session popup, which sits on a dark sheet. */
  tone?: 'card' | 'dark'
}

export default function CommentaryThread({
  subjectType,
  subjectKey,
  commentary,
  tone = 'card',
}: CommentaryThreadProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [atLimit, setAtLimit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  // One load per subject per mount. A failed load must not re-fire — that is
  // the shape of the flicker bug the day review had.
  const loadedFor = useRef<string | null>(null)

  const dark = tone === 'dark'

  const open = useCallback(async () => {
    setIsOpen(true)
    if (loadedFor.current === subjectKey) return
    loadedFor.current = subjectKey

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/commentary/thread?subject_type=${subjectType}&subject_key=${encodeURIComponent(subjectKey)}`
      )
      if (!res.ok) throw new Error('Could not load this conversation.')
      const data = await res.json()
      setMessages(data.messages || [])
      setAtLimit(Boolean(data.atLimit))
    } catch {
      setError('Could not load this conversation.')
    } finally {
      setIsLoading(false)
    }
  }, [subjectType, subjectKey])

  const send = useCallback(async () => {
    const message = draft.trim()
    if (!message || isSending || atLimit) return

    setIsSending(true)
    setError(null)
    try {
      const res = await csrfFetch('/api/commentary/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_type: subjectType,
          subject_key: subjectKey,
          subject_commentary: commentary,
          message,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 409) {
        setAtLimit(true)
        setError('This conversation has reached its limit.')
        return
      }
      if (!res.ok) throw new Error(data.error || 'Could not send that.')

      setMessages((prev) => [...prev, ...(data.messages || [])])
      setAtLimit(Boolean(data.atLimit))
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that.')
    } finally {
      setIsSending(false)
    }
  }, [draft, isSending, atLimit, subjectType, subjectKey, commentary])

  if (!commentary) return null

  if (!isOpen) {
    return (
      <button
        onClick={open}
        className={`mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs transition-colors ${
          dark ? 'text-zinc-400 hover:text-zinc-200' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Ask about this
      </button>
    )
  }

  return (
    <div className={`mt-3 space-y-3 border-t pt-3 ${dark ? 'border-zinc-700/50' : 'border-border'}`}>
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        messages.length > 0 && (
          <ol className="space-y-2">
            {messages.map((m) => (
              <li
                key={m.seq}
                className={
                  m.role === 'user'
                    ? `text-xs font-medium ${dark ? 'text-zinc-200' : 'text-foreground'}`
                    : `text-sm leading-relaxed ${dark ? 'text-zinc-300' : 'text-muted-foreground'}`
                }
              >
                {m.role === 'user' ? `You: ${m.content}` : m.content}
              </li>
            ))}
          </ol>
        )
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {atLimit ? (
        <p className={`text-xs ${dark ? 'text-zinc-500' : 'text-muted-foreground'}`}>
          That&rsquo;s as far as this conversation goes.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <label htmlFor={`ask-${subjectType}-${subjectKey}`} className="sr-only">
            Ask about this commentary
          </label>
          <input
            id={`ask-${subjectType}-${subjectKey}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Why do you say that?"
            maxLength={2000}
            disabled={isSending}
            className={`min-h-11 flex-1 rounded-lg border px-3 text-sm outline-none disabled:opacity-60 ${
              dark
                ? 'border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500'
                : 'border-border bg-background text-foreground placeholder:text-muted-foreground'
            }`}
          />
          <button
            onClick={send}
            disabled={isSending || draft.trim().length === 0}
            aria-label="Send question"
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
              dark ? 'bg-zinc-700 text-zinc-100' : 'bg-secondary text-foreground'
            }`}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  )
}
