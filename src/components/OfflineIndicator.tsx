'use client'

import { useOffline } from '@/hooks/useOffline'
import { WifiOff, CloudOff, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

export function OfflineIndicator() {
  const { isOffline, queuedCount, isSyncing, syncQueue } = useOffline()
  const [showBanner, setShowBanner] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  // Show banner when going offline or when coming back online with queued actions
  useEffect(() => {
    if (isOffline) {
      setShowBanner(true)
      setWasOffline(true)
    } else if (wasOffline) {
      // Just came back online
      if (queuedCount > 0) {
        setShowBanner(true)
      } else {
        // Hide after a brief "Back online" message
        setTimeout(() => setShowBanner(false), 2000)
      }
      setWasOffline(false)
    }
  }, [isOffline, wasOffline, queuedCount])

  // Hide banner when queue is empty and online
  useEffect(() => {
    if (!isOffline && queuedCount === 0 && !isSyncing) {
      const timer = setTimeout(() => setShowBanner(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isOffline, queuedCount, isSyncing])

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className={`
        rounded-lg px-4 py-3 shadow-lg flex items-center justify-between
        ${isOffline
          ? 'bg-amber-900/90 border border-amber-700'
          : queuedCount > 0
            ? 'bg-blue-900/90 border border-blue-700'
            : 'bg-green-900/90 border border-green-700'
        }
      `}>
        <div className="flex items-center gap-3">
          {isOffline ? (
            <>
              <WifiOff className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-100">You&apos;re offline</p>
                <p className="text-xs text-amber-300">Changes will sync when you&apos;re back online</p>
              </div>
            </>
          ) : queuedCount > 0 ? (
            <>
              <CloudOff className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium text-blue-100">
                  {isSyncing ? 'Syncing...' : `${queuedCount} action${queuedCount > 1 ? 's' : ''} pending`}
                </p>
                <p className="text-xs text-blue-300">
                  {isSyncing ? 'Please wait' : 'Tap to sync now'}
                </p>
              </div>
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5 text-green-400" />
              <p className="text-sm font-medium text-green-100">Back online</p>
            </>
          )}
        </div>

        {!isOffline && queuedCount > 0 && !isSyncing && (
          <button
            onClick={syncQueue}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500
                       text-white rounded-md transition-colors"
          >
            Sync now
          </button>
        )}
      </div>
    </div>
  )
}
