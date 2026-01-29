'use client'

interface ChartTooltipPayload {
  value: number
  name: string
  color: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string
  formatter?: (value: number) => string
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 shadow-lg">
      {label && (
        <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="text-[13px] font-semibold text-foreground">
          {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}
