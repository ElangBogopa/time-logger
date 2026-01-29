'use client'

interface PeriodToggleProps {
  value: '7d' | '30d'
  onChange: (period: '7d' | '30d') => void
}

/**
 * 7D / 30D toggle with radio group semantics.
 * Minimum 44px touch targets per WCAG 2.5.5.
 * aria-current on active button per a11y spec W5.
 */
export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg bg-secondary p-0.5 gap-0.5"
      role="radiogroup"
      aria-label="Chart time period"
    >
      {(['7d', '30d'] as const).map((period) => {
        const isActive = value === period
        return (
          <button
            key={period}
            role="radio"
            aria-checked={isActive}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onChange(period)}
            className={`
              px-4 py-2.5 min-h-[44px] flex items-center justify-center
              text-[11px] font-medium rounded-md transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-1 focus-visible:ring-offset-background
              ${isActive
                ? 'bg-foreground/10 text-foreground ring-1 ring-foreground/20'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            {period === '7d' ? '7D' : '30D'}
          </button>
        )
      })}
    </div>
  )
}
