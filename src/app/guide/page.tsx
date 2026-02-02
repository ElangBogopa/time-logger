'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Brain,
  Clock,
  Dumbbell,
  Users,
  Gamepad2,
  BookOpen,
  UtensilsCrossed,
  Sun,
  Sunset,
  Moon,
  ExternalLink,
  Lightbulb,
  FlaskConical,
} from 'lucide-react'

// ── Time allocation data ──

interface TimeBlock {
  label: string
  percentage: [number, number] // min-max range
  hours: string
  icon: React.ElementType
  color: string
  barColor: string
  description: string
}

const TIME_BLOCKS: TimeBlock[] = [
  {
    label: 'Deep Work',
    percentage: [25, 30],
    hours: '4–5h',
    icon: Brain,
    color: 'text-blue-500',
    barColor: 'bg-blue-500',
    description: 'Focused, cognitively demanding work. Your real output happens here. Diminishing returns after ~5 hours.',
  },
  {
    label: 'Leisure & Rest',
    percentage: [18, 25],
    hours: '3–4h',
    icon: Gamepad2,
    color: 'text-purple-500',
    barColor: 'bg-purple-500',
    description: 'Active recovery is crucial. Aim for 70% active leisure (hobbies, reading) and 30% passive (TV, scrolling).',
  },
  {
    label: 'Shallow Work',
    percentage: [15, 20],
    hours: '2.5–3h',
    icon: Clock,
    color: 'text-slate-400',
    barColor: 'bg-slate-400',
    description: 'Email, meetings, admin tasks. Schedule during low-energy periods — don\'t waste peak hours on this.',
  },
  {
    label: 'Social & Connection',
    percentage: [12, 15],
    hours: '2–2.5h',
    icon: Users,
    color: 'text-rose-500',
    barColor: 'bg-rose-500',
    description: 'Harvard\'s 80-year study found relationships are the #1 predictor of happiness. Not optional.',
  },
  {
    label: 'Meals & Self-Care',
    percentage: [8, 12],
    hours: '1.5–2h',
    icon: UtensilsCrossed,
    color: 'text-amber-500',
    barColor: 'bg-amber-500',
    description: 'Mindful eating, grooming, hygiene. Often underestimated in time planning.',
  },
  {
    label: 'Exercise',
    percentage: [6, 8],
    hours: '1–1.5h',
    icon: Dumbbell,
    color: 'text-green-500',
    barColor: 'bg-green-500',
    description: 'WHO recommends 150+ min/week. Daily movement is critical for cognitive function.',
  },
  {
    label: 'Learning',
    percentage: [6, 10],
    hours: '1–1.5h',
    icon: BookOpen,
    color: 'text-cyan-500',
    barColor: 'bg-cyan-500',
    description: 'Courses, reading, skill building. Maintains cognitive flexibility and long-term growth.',
  },
]

// ── Optimal timing data ──

interface TimingBlock {
  time: string
  activity: string
  icon: React.ElementType
  iconColor: string
  reason: string
}

const MORNING_BLOCKS: TimingBlock[] = [
  { time: '6–7 AM', activity: 'Wake + Light Exposure', icon: Sun, iconColor: 'text-amber-400', reason: 'Resets circadian clock, boosts cortisol for alertness' },
  { time: '7–8 AM', activity: 'Exercise', icon: Dumbbell, iconColor: 'text-green-500', reason: 'Jumpstarts metabolism, enhances mood for entire day' },
  { time: '8–9 AM', activity: 'Breakfast + Planning', icon: UtensilsCrossed, iconColor: 'text-amber-500', reason: 'Fuel your brain, set priorities before reactive work pulls you in' },
  { time: '9–12 PM', activity: 'Deep Work Block 1', icon: Brain, iconColor: 'text-blue-500', reason: 'Peak cognitive hours. Cortisol + body temp rising = maximum focus' },
]

const AFTERNOON_BLOCKS: TimingBlock[] = [
  { time: '12–1 PM', activity: 'Lunch + Social', icon: Users, iconColor: 'text-rose-500', reason: 'Refuel and connect. Post-lunch dip is coming — don\'t fight it' },
  { time: '1–2 PM', activity: 'Shallow Work', icon: Clock, iconColor: 'text-slate-400', reason: 'Post-lunch dip. Handle emails, admin, low-stakes tasks' },
  { time: '2–4 PM', activity: 'Deep Work Block 2', icon: Brain, iconColor: 'text-blue-500', reason: 'Second cognitive peak. 90-min block + break + 90-min block' },
  { time: '4–5 PM', activity: 'Learning', icon: BookOpen, iconColor: 'text-cyan-500', reason: 'Still engaged but past peak intensity. Ideal for growth activities' },
]

const EVENING_BLOCKS: TimingBlock[] = [
  { time: '5–6 PM', activity: 'Wrap-up + Exercise', icon: Dumbbell, iconColor: 'text-green-500', reason: 'Body temp peaks — best physical performance window. Or wind down work.' },
  { time: '7–9 PM', activity: 'Social + Connection', icon: Users, iconColor: 'text-rose-500', reason: 'Dinner, family, meaningful conversations. Relationships compound.' },
  { time: '9–10 PM', activity: 'Leisure', icon: Gamepad2, iconColor: 'text-purple-500', reason: 'Natural wind-down. Prefer active leisure (hobbies, reading) over scrolling.' },
  { time: '10 PM', activity: 'Sleep Prep', icon: Moon, iconColor: 'text-indigo-400', reason: 'No screens, dim lights. Your next day starts with tonight\'s sleep.' },
]

// ── Research citations ──

interface Citation {
  id: string
  title: string
  authors: string
  year: number
  finding: string
  link?: string
}

const CITATIONS: Citation[] = [
  {
    id: 'who-hours',
    title: 'Long working hours and health outcomes',
    authors: 'WHO/ILO Joint Estimates',
    year: 2021,
    finding: 'Working 55+ hours/week increases stroke risk by 35% and heart disease by 17%. Optimal knowledge work: 35–40 hours/week.',
    link: 'https://www.who.int/news/item/17-05-2021-long-working-hours-increasing-deaths-from-heart-disease-and-stroke-who-ilo',
  },
  {
    id: 'harvard-happiness',
    title: 'Harvard Study of Adult Development',
    authors: 'Waldinger, R. & Schulz, M.',
    year: 2023,
    finding: 'The longest study on happiness (80+ years) found that quality of relationships is the strongest predictor of well-being — stronger than wealth, fame, or career success.',
    link: 'https://www.amazon.com/Good-Life-Lessons-Scientific-Happiness/dp/198216669X',
  },
  {
    id: 'ultradian',
    title: 'Basic Rest-Activity Cycle (BRAC)',
    authors: 'Kleitman, N. & Rossi, E.',
    year: 1993,
    finding: 'The human body operates on 90–120 minute ultradian cycles. Working in 90-minute blocks with 15–20 min breaks aligns with natural attention rhythms and prevents cognitive fatigue.',
  },
  {
    id: 'deep-work',
    title: 'Deep Work: Rules for Focused Success',
    authors: 'Newport, C.',
    year: 2016,
    finding: 'Context switching reduces productivity by up to 40%. Scheduled deep work blocks prevent reactive, scattered patterns. Most people can sustain 4–5 hours of truly focused work per day.',
    link: 'https://www.amazon.com/Deep-Work-Focused-Success-Distracted/dp/1455586692',
  },
  {
    id: 'leisure-wellbeing',
    title: 'Leisure and Subjective Well-Being',
    authors: 'Sharif, M., Mogilner, C., & Hershfield, H.',
    year: 2021,
    finding: 'Having too little free time (<2 hours/day) is as harmful to well-being as having too much (>5 hours). The sweet spot is 2–5 hours, especially when spent on active pursuits.',
    link: 'https://doi.org/10.1037/pspp0000391',
  },
  {
    id: 'circadian',
    title: 'Physiology, Circadian Rhythm',
    authors: 'Reddy, S., Reddy, V., & Sharma, S.',
    year: 2023,
    finding: 'Circadian rhythms govern cognitive performance throughout the day. Cortisol peaks at 8–9 AM, body temperature rises through morning — aligning demanding tasks with these peaks maximizes output.',
  },
  {
    id: 'exercise-cognition',
    title: 'Exercise and Cognitive Performance',
    authors: 'Hillman, C., Erickson, K., & Kramer, A.',
    year: 2008,
    finding: 'Regular exercise improves executive function, memory, and attention. Even a single session of moderate exercise enhances cognitive performance for several hours.',
    link: 'https://doi.org/10.1038/nrn2298',
  },
]

// ── Components ──

function AllocationBar({ block }: { block: TimeBlock }) {
  const Icon = block.icon
  const avgPct = (block.percentage[0] + block.percentage[1]) / 2

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 ${block.color}`} />
          <span className="text-sm font-medium text-foreground">{block.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{block.hours}</span>
          <span className="text-xs text-muted-foreground">({block.percentage[0]}–{block.percentage[1]}%)</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${block.barColor} transition-all duration-700`}
          style={{ width: `${avgPct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{block.description}</p>
    </div>
  )
}

function ScheduleSection({ title, icon: Icon, iconColor, blocks }: {
  title: string
  icon: React.ElementType
  iconColor: string
  blocks: TimingBlock[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-0 rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {blocks.map((block) => {
          const BlockIcon = block.icon
          return (
            <div key={block.time} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5">
                <BlockIcon className={`h-4 w-4 ${block.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{block.time}</span>
                  <span className="text-sm font-medium text-foreground">{block.activity}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{block.reason}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CitationCard({ citation }: { citation: Citation }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-foreground leading-tight">{citation.title}</p>
        {citation.link && (
          <a href={citation.link} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
          </a>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">{citation.authors} · {citation.year}</p>
      <p className="text-xs text-foreground/70 leading-relaxed">{citation.finding}</p>
    </div>
  )
}

// ── Page ──

export default function GuidePage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Lightbulb className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Your Ideal Day</h1>
              <p className="text-sm text-muted-foreground">Science-backed daily planning guide</p>
            </div>
          </div>
        </header>

        {/* Intro */}
        <div className="rounded-xl bg-secondary/50 border border-border p-4 mb-8">
          <p className="text-sm text-foreground/80 leading-relaxed">
            How should you actually spend your time? Not based on hustle culture or guesswork — based on
            peer-reviewed research in circadian biology, cognitive science, and well-being studies.
            Here&apos;s what the science says about structuring your 16 waking hours.
          </p>
        </div>

        {/* Section 1: Time Allocation */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-foreground mb-1">How to Split Your Time</h2>
          <p className="text-xs text-muted-foreground mb-5">Based on a 16-hour waking day (8 hours sleep)</p>
          <div className="space-y-5">
            {TIME_BLOCKS.map((block) => (
              <AllocationBar key={block.label} block={block} />
            ))}
          </div>
        </section>

        {/* Key insight callout */}
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4 mb-10">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">The 90-Minute Rule</p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                Your brain runs on 90-minute ultradian cycles. Work in 90-minute focused blocks, then take a
                15–20 minute break. This isn&apos;t productivity advice — it&apos;s biology. Two solid 90-minute
                deep work blocks per day beats 8 hours of scattered multitasking.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: When to Do What */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-foreground mb-1">When to Do What</h2>
          <p className="text-xs text-muted-foreground mb-5">Aligned with your circadian rhythm and energy cycles</p>

          <div className="space-y-6">
            <ScheduleSection title="Morning" icon={Sun} iconColor="text-amber-400" blocks={MORNING_BLOCKS} />
            <ScheduleSection title="Afternoon" icon={Sunset} iconColor="text-orange-500" blocks={AFTERNOON_BLOCKS} />
            <ScheduleSection title="Evening" icon={Moon} iconColor="text-indigo-400" blocks={EVENING_BLOCKS} />
          </div>
        </section>

        {/* Leisure insight callout */}
        <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4 mb-10">
          <div className="flex items-start gap-3">
            <Gamepad2 className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Leisure Isn&apos;t Lazy</p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                Research shows 2–5 hours of daily leisure is optimal for well-being. Less than 2 hours leads to
                burnout. More than 5 hours gives diminishing returns. The key is active leisure — hobbies,
                socializing, creating — not just passive scrolling. Schedule your fun like you schedule your work.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: The Research */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-bold text-foreground">The Research</h2>
          </div>
          <div className="space-y-3">
            {CITATIONS.map((citation) => (
              <CitationCard key={citation.id} citation={citation} />
            ))}
          </div>
        </section>

        {/* Footer note */}
        <div className="text-center mt-8 mb-4">
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-xs mx-auto">
            These are research-backed guidelines, not rigid rules.
            Adapt to your chronotype, life phase, and goals.
            The best schedule is the one you actually follow.
          </p>
        </div>
      </div>
    </div>
  )
}
