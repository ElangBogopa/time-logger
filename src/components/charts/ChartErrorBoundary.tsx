'use client'

import React from 'react'

interface ChartErrorBoundaryProps {
  /** Fallback value to display when chart crashes (e.g. the metric number) */
  fallbackValue?: string | number
  /** Optional label for the metric */
  fallbackLabel?: string
  /** Chart dimensions to maintain layout */
  height?: number
  children: React.ReactNode
}

interface ChartErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for chart components.
 * Catches Recharts rendering errors and shows a graceful fallback
 * with the metric value (if provided) and a subtle "Chart unavailable" note.
 *
 * Must be a class component per React limitation.
 */
export class ChartErrorBoundary extends React.Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ChartErrorBoundary] Chart rendering failed:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const { fallbackValue, fallbackLabel, height } = this.props
      return (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ minHeight: height ?? 120 }}
          role="img"
          aria-label={
            fallbackValue != null
              ? `${fallbackLabel ?? 'Metric'}: ${fallbackValue}. Chart unavailable.`
              : 'Chart unavailable.'
          }
        >
          {fallbackValue != null && (
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {fallbackValue}
            </span>
          )}
          {fallbackLabel && (
            <span className="text-xs text-muted-foreground mt-1">{fallbackLabel}</span>
          )}
          <span className="text-[11px] text-muted-foreground/60 mt-2">
            Chart unavailable
          </span>
        </div>
      )
    }

    return this.props.children
  }
}
