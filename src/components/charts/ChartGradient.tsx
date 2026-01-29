/**
 * SVG linearGradient helper for area chart fills.
 * Renders a top-to-bottom fade from color to transparent.
 * Must be placed inside a <defs> block within an SVG or Recharts chart.
 */
export function ChartGradient({
  id,
  color,
  topOpacity = 0.25,
}: {
  id: string
  color: string
  topOpacity?: number
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={topOpacity} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}
