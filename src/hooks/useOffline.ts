'use client'

import { useState, useEffect, useCallback } from 'react'

interface QueuedAction {
  id: string
  url: string
  method: string
  body: string
  timestamp: number
}

const QUEUE_KEY = 'offline_action_queue'

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true)
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  // Initialize online status and load queue
  useEffect(() => {
    setIsOnline(navigator.onLine)

    // Load queued actions from localStorage
    const stored = localStorage.getItem(QUEUE_KEY)
    if (stored) {
      try {
        setQueuedActions(JSON.parse(stored))
      } catch {
        localStorage.removeItem(QUEUE_KEY)
      }
    }

    const handleOnline = () => {
      setIsOnline(true)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Sync queued actions when coming back online
  useEffect(() => {
    if (isOnline && queuedActions.length > 0 && !isSyncing) {
      syncQueue()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queuedActions))
  }, [queuedActions])

  const addToQueue = useCallback((action: Omit<QueuedAction, 'id' | 'timestamp'>) => {
    const newAction: QueuedAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    setQueuedActions(prev => [...prev, newAction])
    return newAction.id
  }, [])

  const removeFromQueue = useCallback((id: string) => {
    setQueuedActions(prev => prev.filter(a => a.id !== id))
  }, [])

  const syncQueue = useCallback(async () => {
    if (queuedActions.length === 0 || isSyncing) return

    setIsSyncing(true)
    const successfulIds: string[] = []

    for (const action of queuedActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: action.body,
        })

        if (response.ok) {
          successfulIds.push(action.id)
        }
      } catch {
        // Keep in queue for retry
        console.log(`[Offline] Failed to sync action ${action.id}, will retry later`)
      }
    }

    // Remove successful actions
    if (successfulIds.length > 0) {
      setQueuedActions(prev => prev.filter(a => !successfulIds.includes(a.id)))
    }

    setIsSyncing(false)
  }, [queuedActions, isSyncing])

  // Helper to make a request with offline fallback
  const fetchWithOffline = useCallback(async (
    url: string,
    options: RequestInit & { offlineAction?: boolean } = {}
  ): Promise<Response | null> => {
    const { offlineAction = true, ...fetchOptions } = options

    try {
      const response = await fetch(url, fetchOptions)
      return response
    } catch (error) {
      // If offline and this is a mutation, queue it
      if (!navigator.onLine && offlineAction && fetchOptions.method && fetchOptions.method !== 'GET') {
        addToQueue({
          url,
          method: fetchOptions.method,
          body: fetchOptions.body as string || '',
        })
        return null
      }
      throw error
    }
  }, [addToQueue])

  return {
    isOnline,
    isOffline: !isOnline,
    queuedActions,
    queuedCount: queuedActions.length,
    isSyncing,
    addToQueue,
    removeFromQueue,
    syncQueue,
    fetchWithOffline,
  }
}
