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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- responding to external connectivity state changes
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
          ? 'bg-[#B5A07A]/90 border border-[#B5A07A]'
          : queuedCount > 0
            ? 'bg-[#6B8CAE]/90 border border-[#6B8CAE]'
            : 'bg-[#7D9B8A]/90 border border-[#7D9B8A]'
        }
      `}>
        <div className="flex items-center gap-3">
          {isOffline ? (
            <>
              <WifiOff className="h-5 w-5 text-[#CBB894]" />
              <div>
                <p className="text-sm font-medium text-[#CBB894]">You&apos;re offline</p>
                <p className="text-xs text-[#CBB894]">Changes will sync when you&apos;re back online</p>
              </div>
            </>
          ) : queuedCount > 0 ? (
            <>
              <CloudOff className="h-5 w-5 text-[#93AEC9]" />
              <div>
                <p className="text-sm font-medium text-[#93AEC9]">
                  {isSyncing ? 'Syncing...' : `${queuedCount} action${queuedCount > 1 ? 's' : ''} pending`}
                </p>
                <p className="text-xs text-[#93AEC9]">
                  {isSyncing ? 'Please wait' : 'Tap to sync now'}
                </p>
              </div>
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5 text-[#9BB5A6]" />
              <p className="text-sm font-medium text-[#9BB5A6]">Back online</p>
            </>
          )}
        </div>

        {!isOffline && queuedCount > 0 && !isSyncing && (
          <button
            onClick={syncQueue}
            className="px-3 py-1.5 text-sm font-medium bg-[#6B8CAE] hover:bg-[#6B8CAE]
                       text-white rounded-md transition-colors"
          >
            Sync now
          </button>
        )}
      </div>
    </div>
  )
}
