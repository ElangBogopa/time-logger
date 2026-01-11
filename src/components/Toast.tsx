'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  title: string
  message: string
  onClose: () => void
  duration?: number
}

export default function Toast({ title, message, onClose, duration = 5000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true))

    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(onClose, 300) // Wait for exit animation
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`transform transition-all duration-300 ease-out ${
          isVisible && !isLeaving
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-4 opacity-0 scale-95'
        }`}
      >
        <div className="relative w-80 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-[1px] shadow-2xl shadow-emerald-500/25">
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_ease-in-out_infinite]" />

          <div className="relative rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-4">
            {/* Success icon and title */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{title}</h3>
                  <button
                    onClick={handleClose}
                    className="ml-2 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Commentary message */}
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  {message}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-zinc-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
                style={{
                  animation: `shrink ${duration}ms linear forwards`,
                }}
              />
            </div>
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
