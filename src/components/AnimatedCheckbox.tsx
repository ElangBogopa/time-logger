'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'

interface AnimatedCheckboxProps {
  completed: boolean
  onToggle?: () => void
  size?: 'sm' | 'md'
  readOnly?: boolean
}

/**
 * Satisfying animated checkbox for task completion.
 * - Scale bounce on check
 * - Green fill with ring pulse
 * - Smooth transitions
 */
export default function AnimatedCheckbox({ completed, onToggle, size = 'md', readOnly = false }: AnimatedCheckboxProps) {
  const [justCompleted, setJustCompleted] = useState(false)
  const [wasCompleted, setWasCompleted] = useState(completed)

  useEffect(() => {
    if (completed && !wasCompleted) {
      setJustCompleted(true)
      const timer = setTimeout(() => setJustCompleted(false), 1000)
      return () => clearTimeout(timer)
    }
    setWasCompleted(completed)
  }, [completed, wasCompleted])

  const sizeClasses = size === 'sm'
    ? 'h-4 w-4 border-[1.5px]'
    : 'h-5 w-5 border-2'

  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'

  return (
    <button
      onClick={readOnly ? undefined : onToggle}
      disabled={readOnly}
      className={`relative flex shrink-0 items-center justify-center rounded-full transition-all duration-200 ${sizeClasses} ${
        completed
          ? 'border-green-500 bg-green-500 scale-100'
          : 'border-zinc-300 dark:border-zinc-600 hover:border-green-400 active:scale-90'
      } ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
        justCompleted ? 'animate-checkbox-pop' : ''
      }`}
      aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
    >
      {completed && (
        <Check className={`${iconSize} text-white ${justCompleted ? 'animate-check-draw' : ''}`} strokeWidth={3} />
      )}
      {/* Success ring pulse */}
      {justCompleted && (
        <span className="absolute inset-0 rounded-full animate-ring-pulse border-2 border-green-500" />
      )}
    </button>
  )
}
