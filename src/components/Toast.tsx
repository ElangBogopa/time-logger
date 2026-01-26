'use client'

import { useCallback, useEffect, useState } from 'react'

interface ToastProps {
  title: string
  message: string
  onClose: () => void
  duration?: number
}

export default function Toast({ title, message, onClose, duration = 10000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const handleClose = useCallback(() => {
    setIsLeaving(true)
    setTimeout(onClose, 400) // Wait for exit animation
  }, [onClose])

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true))

    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, handleClose])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-400 ${
          isVisible && !isLeaving ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative transform transition-all duration-400 ease-out ${
          isVisible && !isLeaving
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-8 opacity-0 scale-90'
        }`}
      >
        {/* Celebration particles */}
        <div className="pointer-events-none absolute -inset-8 overflow-hidden">
          <div className="absolute left-1/4 top-0 h-2 w-2 animate-bounce rounded-full bg-amber-400 opacity-80" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
          <div className="absolute right-1/4 top-2 h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 opacity-80" style={{ animationDelay: '150ms', animationDuration: '1.2s' }} />
          <div className="absolute left-1/3 top-4 h-1 w-1 animate-bounce rounded-full bg-blue-400 opacity-80" style={{ animationDelay: '300ms', animationDuration: '0.9s' }} />
          <div className="absolute right-1/3 top-1 h-2 w-2 animate-bounce rounded-full bg-pink-400 opacity-80" style={{ animationDelay: '200ms', animationDuration: '1.1s' }} />
        </div>

        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-[2px] shadow-2xl shadow-emerald-500/30">
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_ease-in-out_infinite]" />

          <div className="relative rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-6">
            {/* Success icon */}
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/40">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Title */}
            <h3 className="mb-3 text-center text-xl font-bold text-white">{title}</h3>

            {/* Commentary message */}
            <div className="rounded-xl bg-zinc-800/50 p-4">
              <p className="text-center text-sm leading-relaxed text-zinc-300">
                &ldquo;{message}&rdquo;
              </p>
            </div>

            {/* Progress bar */}
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400"
                style={{
                  animation: `shrink ${duration}ms linear forwards`,
                }}
              />
            </div>

            {/* Dismiss button */}
            <button
              onClick={handleClose}
              className="mt-4 w-full rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}
