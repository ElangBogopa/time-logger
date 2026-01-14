'use client'

import { IntentionType, INTENTION_LABELS, INTENTION_DESCRIPTIONS } from '@/lib/types'
import { Check, Target, Brain, Scale, Dumbbell, Heart, Users, BookOpen, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const INTENTION_ICONS: Record<IntentionType, React.ReactNode> = {
  deep_work: <Brain className="h-6 w-6" />,
  less_distraction: <Target className="h-6 w-6" />,
  work_life_balance: <Scale className="h-6 w-6" />,
  exercise: <Dumbbell className="h-6 w-6" />,
  self_care: <Heart className="h-6 w-6" />,
  relationships: <Users className="h-6 w-6" />,
  learning: <BookOpen className="h-6 w-6" />,
  custom: <Sparkles className="h-6 w-6" />,
}

interface IntentionCardProps {
  type: IntentionType
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  customText?: string
  onCustomTextChange?: (text: string) => void
}

export default function IntentionCard({
  type,
  selected,
  onSelect,
  disabled = false,
  customText,
  onCustomTextChange,
}: IntentionCardProps) {
  const label = INTENTION_LABELS[type]
  const description = INTENTION_DESCRIPTIONS[type]
  const icon = INTENTION_ICONS[type]

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled && !selected}
      className={cn(
        'relative flex w-full flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600',
        disabled && !selected && 'cursor-not-allowed opacity-50'
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          'absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
          selected
            ? 'border-primary bg-primary text-white'
            : 'border-zinc-300 dark:border-zinc-600'
        )}
      >
        {selected && <Check className="h-4 w-4" />}
      </div>

      {/* Icon */}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-lg',
          selected
            ? 'bg-primary/10 text-primary'
            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
        )}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="pr-8">
        <h3 className={cn(
          'font-semibold',
          selected ? 'text-primary' : 'text-zinc-900 dark:text-zinc-100'
        )}>
          {label}
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>

      {/* Custom text input for custom type */}
      {type === 'custom' && selected && onCustomTextChange && (
        <input
          type="text"
          value={customText || ''}
          onChange={(e) => onCustomTextChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Describe your goal..."
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder:text-zinc-500"
        />
      )}
    </button>
  )
}
