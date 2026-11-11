'use client'

import { Check } from 'lucide-react'
import { TimeCategory, CATEGORY_LABELS, ENERGY_VIEW, getAggregatedCategory } from '@/lib/types'
import { AGGREGATED_CLASSES } from '@/lib/palette'

/**
 * Every category, as chips, so a wrong one can be put right.
 *
 * The categoriser is a model and it is sometimes wrong — "Pricing review"
 * came back as deep work — and until this existed there was no way to say
 * so: the only route to a different category was rewording the activity and
 * hoping. Body, Mind and Heart are computed from categories, so a category
 * that cannot be corrected is a score that cannot be trusted.
 *
 * Chips are ordered and tinted by bucket, so the colour tells you which of
 * the rings a choice will feed.
 */
const ORDERED: TimeCategory[] = Object.values(ENERGY_VIEW).flatMap((group) => group.categories)

interface CategoryPickerProps {
  value: TimeCategory | null
  onChange: (category: TimeCategory) => void
  disabled?: boolean
}

export default function CategoryPicker({ value, onChange, disabled = false }: CategoryPickerProps) {
  return (
    <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
      {ORDERED.map((category) => {
        const classes = AGGREGATED_CLASSES[getAggregatedCategory(category)]
        const selected = category === value
        return (
          <button
            key={category}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(category)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 ${classes.tint} ${classes.text} ${
              selected ? `${classes.border} ring-1 ring-foreground/30` : 'border-transparent'
            }`}
          >
            {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            {CATEGORY_LABELS[category]}
          </button>
        )
      })}
    </div>
  )
}
