import type { MetricKey } from '@/lib/chart-colors'

export interface TrendDataPoint {
  date: string
  label: string
  value: number
  color?: string
}

export interface PersonalBest {
  value: number
  date: string
}

export interface VsLastWeek {
  change: number
  direction: 'up' | 'down' | 'same'
}

export interface MetricTrendData {
  current: number
  color: string
  label: string
  average: number
  trend: TrendDataPoint[]
  personalBest: PersonalBest | null
  vsLastWeek: VsLastWeek | null
  // Details varies by metric — typed loosely here, cast at usage site
  details: Record<string, unknown>
}

export interface TrendAPIResponse {
  focus: MetricTrendData
  balance: MetricTrendData
  rhythm: MetricTrendData
  nudge: string
  period: string
}

export type { MetricKey }
