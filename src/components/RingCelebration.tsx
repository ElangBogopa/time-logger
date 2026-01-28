'use client'

import { useEffect, useState } from 'react'

interface RingCelebrationProps {
  celebration: { label: string; icon: string } | null
  onDone: () => void
}

// CSS-only confetti particles
function ConfettiParticle({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * 360
  const distance = 60 + Math.random() * 40
  const size = 4 + Math.random() * 4
  const duration = 0.8 + Math.random() * 0.4
  const delay = Math.random() * 0.2
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
  const color = colors[index % colors.length]
  const isRound = index % 3 === 0

  return (
    <div
      className="absolute"
      style={{
        width: isRound ? size : size * 0.6,
        height: isRound ? size : size * 1.5,
        backgroundColor: color,
        borderRadius: isRound ? '50%' : '2px',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        animation: `confetti-burst ${duration}s ease-out ${delay}s forwards`,
        ['--confetti-x' as string]: `${Math.cos((angle * Math.PI) / 180) * distance}px`,
        ['--confetti-y' as string]: `${Math.sin((angle * Math.PI) / 180) * distance - 20}px`,
        ['--confetti-rotate' as string]: `${Math.random() * 360}deg`,
        opacity: 0,
      }}
    />
  )
}

// Sparkle star
function Sparkle({ index }: { index: number }) {
  const angles = [0, 72, 144, 216, 288]
  const angle = angles[index % 5]
  const distance = 30 + index * 15
  const delay = index * 0.1
  const size = 6 + Math.random() * 6

  return (
    <div
      className="absolute text-yellow-400"
      style={{
        left: '50%',
        top: '50%',
        fontSize: size,
        transform: 'translate(-50%, -50%)',
        animation: `sparkle-pop 0.6s ease-out ${delay}s forwards`,
        ['--sparkle-x' as string]: `${Math.cos((angle * Math.PI) / 180) * distance}px`,
        ['--sparkle-y' as string]: `${Math.sin((angle * Math.PI) / 180) * distance - 10}px`,
        opacity: 0,
      }}
    >
      ✦
    </div>
  )
}

export default function RingCelebration({ celebration, onDone }: RingCelebrationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (celebration) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onDone, 300) // Wait for fade out
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [celebration, onDone])

  if (!celebration && !visible) return null

  return (
    <>
      {/* CSS Keyframes */}
      <style jsx global>{`
        @keyframes confetti-burst {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(
              calc(-50% + var(--confetti-x)),
              calc(-50% + var(--confetti-y))
            ) scale(1) rotate(var(--confetti-rotate));
          }
        }

        @keyframes sparkle-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0);
          }
          40% {
            opacity: 1;
            transform: translate(
              calc(-50% + var(--sparkle-x) * 0.6),
              calc(-50% + var(--sparkle-y) * 0.6)
            ) scale(1.3);
          }
          100% {
            opacity: 0;
            transform: translate(
              calc(-50% + var(--sparkle-x)),
              calc(-50% + var(--sparkle-y))
            ) scale(0.5);
          }
        }

        @keyframes celebration-toast-in {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes celebration-toast-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
        }

        @keyframes ring-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.3;
          }
        }
      `}</style>

      {/* Toast notification */}
      <div
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        style={{
          animation: visible
            ? 'celebration-toast-in 0.4s ease-out forwards'
            : 'celebration-toast-out 0.3s ease-in forwards',
        }}
      >
        <div className="relative">
          {/* Confetti particles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <ConfettiParticle key={i} index={i} total={20} />
          ))}

          {/* Sparkles */}
          {Array.from({ length: 5 }).map((_, i) => (
            <Sparkle key={i} index={i} />
          ))}

          {/* Toast card */}
          <div className="relative bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 rounded-2xl px-5 py-3 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-3">
              {/* Pulsing ring indicator */}
              <div className="relative flex items-center justify-center w-10 h-10">
                <div
                  className="absolute inset-0 rounded-full bg-green-500/20"
                  style={{ animation: 'ring-pulse 1.5s ease-in-out infinite' }}
                />
                <span className="text-xl z-10">{celebration?.icon || '🎉'}</span>
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  🎉 {celebration?.label} goal complete!
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Daily target reached
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
