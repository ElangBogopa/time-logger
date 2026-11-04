'use client'

import React from 'react'
import { timeToMinutes } from '@/lib/time-utils'
import { Check, ArrowRight } from 'lucide-react'
import type { PlanOutcome } from '@/lib/plan-adherence'

export interface CommittedTask {
  id: string
  title: string
  date: string
  committed_start: string
  committed_end: string
  completed: boolean
}

interface TimelineCommittedProps {
  task: CommittedTask
  startHour: number
  /**
   * What became of this plan, once the day has reached it. The block is a
   * promise until then and a record afterwards, and it should not look the
   * same in both states.
   */
  outcome?: PlanOutcome
}

import { PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT } from './constants'

// Warm taupe palette — distinct from calendar ghosts (zinc) and entries (category colors)
// Neutral, non-bright, earthy tone
const COMMITTED_COLORS = {
  border: 'border-[#8B7E74]',
  bg: 'bg-[#8B7E74]/12 dark:bg-[#8B7E74]/10',
  bgDone: 'bg-[#8B7E74]/20 dark:bg-[#8B7E74]/15',
  text: 'text-[#8B7E74] dark:text-[#A89F96]',
  textDone: 'text-[#8B7E74]/50 dark:text-[#A89F96]/50',
}

export default function TimelineCommitted({ task, startHour, outcome }: TimelineCommittedProps) {
  const startMinutes = timeToMinutes(task.committed_start)
  const endMinutes = timeToMinutes(task.committed_end)
  const durationMinutes = endMinutes - startMinutes
  const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE
  const height = Math.max(durationMinutes * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
  const isShort = height < 50

  return (
    <div
      data-committed-block
      className={`absolute overflow-hidden rounded-xl border-2 transition-all ${
        task.completed
          ? `${COMMITTED_COLORS.bgDone} ${COMMITTED_COLORS.border}/30`
          : `${COMMITTED_COLORS.bg} ${COMMITTED_COLORS.border}/40`
      } ${outcome === 'missed' ? 'border-dashed opacity-60' : ''}`}
      style={{
        top,
        height,
        left: '4px',
        right: '4px',
      }}
    >
      <div className={`flex h-full flex-col justify-center px-2.5 py-1 ${
        task.completed ? COMMITTED_COLORS.textDone : COMMITTED_COLORS.text
      }`}>
        {isShort ? (
          <div className="flex items-center gap-1.5">
            {task.completed && <Check className="h-3 w-3 shrink-0" />}
            <span className={`truncate text-xs font-medium ${task.completed ? 'opacity-60' : ''}`}>
              {task.title}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              {task.completed && <Check className="h-3 w-3 shrink-0" />}
              <span className={`truncate text-xs font-medium ${task.completed ? 'opacity-60' : ''}`}>
                {task.title}
              </span>
            </div>
            <span className="text-[10px] opacity-70 mt-0.5 flex items-center gap-1">
              {task.committed_start.slice(0,5)} – {task.committed_end.slice(0,5)}
              {outcome === 'moved' && (
                <>
                  <ArrowRight className="h-2.5 w-2.5" />
                  done later
                </>
              )}
              {outcome === 'missed' && <>· not logged</>}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
