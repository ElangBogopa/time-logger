import { useState, useRef, useEffect, useCallback } from 'react'
import { timeToMinutes, minutesToTime } from '@/lib/time-utils'
import { updateEntry } from '@/lib/api'
import { PlacedEntry } from './useTimelineData'
import { PIXELS_PER_MINUTE } from '@/components/timeline/constants'

export interface UseEntryAdjustmentParams {
  scrollContainerRef: React.RefObject<HTMLDivElement>
  startHour: number
  onEntryDeleted: () => void
  onShowToast?: (message: string) => void
  yToTime: (clientY: number) => string
  onEntryClick: (entry: PlacedEntry) => void
}

export interface UseEntryAdjustmentReturn {
  isEntryTouchActive: boolean
  isAdjustingEntry: boolean
  adjustPreview: {
    entryId: string
    startTime: string
    endTime: string
  } | null
  handleEntryMouseDown: (e: React.MouseEvent, entry: PlacedEntry) => void
  handleEntryTouchStart: (e: React.TouchEvent, entry: PlacedEntry) => void
}

type EntryDragType = 'move' | 'resize-top' | 'resize-bottom'

const ENTRY_EDGE_ZONE = 0.2 // 20% of entry height for resize zones
const ENTRY_HOLD_DELAY = 200 // ms - hold before moving entry (touch only)
const STILLNESS_CHECK_DELAY = 100 // ms - must be still this long before hold timer even starts
const SCROLL_CANCEL_THRESHOLD = 5 // pixels - ANY movement this much means user is scrolling
const DRAG_THRESHOLD = 20 // pixels - minimum drag distance to count as intentional drag

export function useEntryAdjustment({
  scrollContainerRef,
  startHour,
  onEntryDeleted,
  onShowToast,
  yToTime,
  onEntryClick,
}: UseEntryAdjustmentParams): UseEntryAdjustmentReturn {
  // Entry adjustment state (move or resize existing entries)
  const [isEntryTouchActive, setIsEntryTouchActive] = useState(false) // Track when touching an entry
  const [isAdjustingEntry, setIsAdjustingEntry] = useState(false)
  const [adjustPreview, setAdjustPreview] = useState<{
    entryId: string
    startTime: string
    endTime: string
  } | null>(null)

  const entryAdjustRef = useRef<{
    entry: PlacedEntry
    dragType: EntryDragType
    originalStartMins: number
    originalEndMins: number
    startY: number
    startClientY: number
    hasMoved: boolean
    isStillnessConfirmed: boolean // Must hold still before any adjustment
    isHoldConfirmed: boolean // For touch move (middle drag)
  } | null>(null)
  const entryStillnessTimerRef = useRef<NodeJS.Timeout | null>(null)
  const entryHoldTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Detect which zone of an entry was clicked (top edge, bottom edge, or middle)
  const detectEntryDragType = useCallback((
    clientY: number,
    entryTop: number,
    entryHeight: number
  ): EntryDragType => {
    const relativeY = clientY - entryTop
    const topZone = entryHeight * ENTRY_EDGE_ZONE
    const bottomZone = entryHeight * (1 - ENTRY_EDGE_ZONE)

    if (relativeY <= topZone) return 'resize-top'
    if (relativeY >= bottomZone) return 'resize-bottom'
    return 'move'
  }, [])

  // ENTRY ADJUSTMENT: Mouse down handler
  const handleEntryMouseDown = useCallback((e: React.MouseEvent, entry: PlacedEntry) => {
    if (e.button !== 0) return // Only left click
    e.stopPropagation() // Don't trigger grid mousedown

    // Don't allow adjusting entries without times (estimated entries)
    if (entry.isEstimated) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const dragType = detectEntryDragType(e.clientY, rect.top, rect.height)

    const originalStartMins = timeToMinutes(entry.placedStartTime)
    const originalEndMins = timeToMinutes(entry.placedEndTime)

    entryAdjustRef.current = {
      entry,
      dragType,
      originalStartMins,
      originalEndMins,
      startY: e.clientY,
      startClientY: e.clientY,
      hasMoved: false,
      isStillnessConfirmed: true, // Mouse is precise, no stillness check needed
      isHoldConfirmed: dragType !== 'move' // Resize starts immediately, move needs to confirm
    }

    // For resize operations, start immediately
    if (dragType !== 'move') {
      setIsAdjustingEntry(true)
      setAdjustPreview({
        entryId: entry.id,
        startTime: entry.placedStartTime,
        endTime: entry.placedEndTime
      })
    }
    // For move, we'll wait for actual movement
  }, [detectEntryDragType])

  // ENTRY ADJUSTMENT: Touch start handler
  // Uses same two-phase approach as grid: stillness check, then hold timer
  const handleEntryTouchStart = useCallback((e: React.TouchEvent, entry: PlacedEntry) => {
    e.stopPropagation() // Don't trigger grid touchstart

    // Don't allow adjusting entries without times (estimated entries)
    if (entry.isEstimated) return

    const touch = e.touches[0]
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const dragType = detectEntryDragType(touch.clientY, rect.top, rect.height)

    const originalStartMins = timeToMinutes(entry.placedStartTime)
    const originalEndMins = timeToMinutes(entry.placedEndTime)

    entryAdjustRef.current = {
      entry,
      dragType,
      originalStartMins,
      originalEndMins,
      startY: touch.clientY,
      startClientY: touch.clientY,
      hasMoved: false,
      isStillnessConfirmed: false,
      isHoldConfirmed: false
    }

    // Mark entry touch as active so the useEffect adds listeners
    setIsEntryTouchActive(true)

    // Phase 1: Stillness check - must hold still before any adjustment
    // If user moves during this time, they're scrolling - let it happen
    entryStillnessTimerRef.current = setTimeout(() => {
      if (entryAdjustRef.current && !entryAdjustRef.current.hasMoved) {
        entryAdjustRef.current.isStillnessConfirmed = true

        // Phase 2: For resize (edges), confirm immediately after stillness
        // For move (middle), require additional hold time
        if (dragType !== 'move') {
          // Resize: ready to adjust after stillness confirmed
          entryAdjustRef.current.isHoldConfirmed = true
          setIsAdjustingEntry(true)
          setAdjustPreview({
            entryId: entry.id,
            startTime: entry.placedStartTime,
            endTime: entry.placedEndTime
          })
          if (navigator.vibrate) {
            navigator.vibrate(30)
          }
        } else {
          // Move: need additional hold time
          entryHoldTimerRef.current = setTimeout(() => {
            if (entryAdjustRef.current && !entryAdjustRef.current.hasMoved) {
              entryAdjustRef.current.isHoldConfirmed = true
              setIsAdjustingEntry(true)
              setAdjustPreview({
                entryId: entry.id,
                startTime: entry.placedStartTime,
                endTime: entry.placedEndTime
              })
              if (navigator.vibrate) {
                navigator.vibrate(50)
              }
            }
          }, ENTRY_HOLD_DELAY)
        }
      }
    }, STILLNESS_CHECK_DELAY)
  }, [detectEntryDragType])

  // ENTRY ADJUSTMENT: Update entry times in database
  const updateEntryTimes = useCallback(async (entryId: string, newStartTime: string, newEndTime: string) => {
    const startMins = timeToMinutes(newStartTime)
    const endMins = timeToMinutes(newEndTime)
    const newDuration = endMins - startMins

    if (newDuration < 5) return // Don't allow entries shorter than 5 minutes

    try {
      await updateEntry(entryId, {
        start_time: newStartTime,
        end_time: newEndTime,
        duration_minutes: newDuration
      })

      // Refresh entries silently - no toast for time adjustments
      onEntryDeleted()
    } catch (error) {
      console.error('Failed to update entry times:', error)
      onShowToast?.('Failed to update entry')
    }
  }, [onEntryDeleted, onShowToast])

  // ENTRY ADJUSTMENT: Mouse/touch move and up handlers
  useEffect(() => {
    // Only add listeners when entry touch is active
    if (!isEntryTouchActive && !isAdjustingEntry) return

    const handleAdjustMouseMove = (e: MouseEvent) => {
      if (!entryAdjustRef.current) return

      const { dragType, originalStartMins, originalEndMins, startClientY, isHoldConfirmed } = entryAdjustRef.current
      const deltaY = e.clientY - startClientY

      // Check if moved beyond threshold
      if (Math.abs(deltaY) > DRAG_THRESHOLD) {
        entryAdjustRef.current.hasMoved = true

        // For move operations, start adjusting on first significant movement
        if (dragType === 'move' && !isHoldConfirmed) {
          entryAdjustRef.current.isHoldConfirmed = true
          setIsAdjustingEntry(true)
        }
      }

      if (!entryAdjustRef.current.isHoldConfirmed) return

      let newStartMins = originalStartMins
      let newEndMins = originalEndMins
      const duration = originalEndMins - originalStartMins

      // For resize operations, use absolute cursor position for precise placement
      // This ensures dragging to a grid line puts the time exactly there
      const cursorTime = yToTime(e.clientY)
      const cursorMins = timeToMinutes(cursorTime)

      if (dragType === 'move') {
        // For move, calculate delta and apply to both start and end
        const deltaMinutes = Math.round((deltaY / PIXELS_PER_MINUTE) / 15) * 15
        newStartMins = Math.round((originalStartMins + deltaMinutes) / 15) * 15
        newEndMins = newStartMins + duration
        // Clamp to day bounds (0:00 to 24:00)
        if (newStartMins < 0) {
          newStartMins = 0
          newEndMins = duration
        }
        if (newEndMins > 24 * 60) {
          newEndMins = 24 * 60
          newStartMins = newEndMins - duration
        }
        if (newStartMins < 0) {
          newStartMins = 0
          newEndMins = Math.min(duration, 24 * 60)
        }
      } else if (dragType === 'resize-top') {
        // Use cursor position directly for the new start time
        newStartMins = cursorMins
        // Clamp: can't go past end time minus 15 min, can't go below 0
        newStartMins = Math.max(0, Math.min(newStartMins, originalEndMins - 15))
      } else if (dragType === 'resize-bottom') {
        // Use cursor position directly for the new end time
        newEndMins = cursorMins
        // If cursor is near bottom of timeline (past 23:30), snap to midnight (24:00)
        if (cursorMins >= 23 * 60 + 30) {
          newEndMins = 24 * 60 // Midnight = 24:00 = 1440 minutes
        }
        // Clamp: can't go before start time plus 15 min, can't exceed 24:00
        newEndMins = Math.min(24 * 60, Math.max(newEndMins, originalStartMins + 15))
      }

      setAdjustPreview({
        entryId: entryAdjustRef.current.entry.id,
        startTime: minutesToTime(newStartMins),
        endTime: minutesToTime(newEndMins)
      })
    }

    const handleAdjustMouseUp = () => {
      if (!entryAdjustRef.current) return

      const { entry, hasMoved, isHoldConfirmed } = entryAdjustRef.current

      // If user moved and confirmed, save the new times
      if (hasMoved && isHoldConfirmed && adjustPreview) {
        const { startTime, endTime } = adjustPreview
        // Only update if times actually changed
        if (startTime !== entry.placedStartTime || endTime !== entry.placedEndTime) {
          updateEntryTimes(entry.id, startTime, endTime)
        }
      } else if (!hasMoved) {
        // User just clicked - open edit modal
        onEntryClick(entry)
      }

      // Reset state
      entryAdjustRef.current = null
      setIsAdjustingEntry(false)
      setAdjustPreview(null)
    }

    const handleAdjustTouchMove = (e: TouchEvent) => {
      if (!entryAdjustRef.current) return

      const touch = e.touches[0]
      const { dragType, originalStartMins, originalEndMins, startClientY, isStillnessConfirmed, isHoldConfirmed } = entryAdjustRef.current
      const deltaY = touch.clientY - startClientY

      // Check if moved beyond scroll threshold - if so, user is scrolling
      if (Math.abs(deltaY) > SCROLL_CANCEL_THRESHOLD) {
        entryAdjustRef.current.hasMoved = true

        // If stillness wasn't confirmed yet, cancel everything - user is scrolling
        if (!isStillnessConfirmed) {
          if (entryStillnessTimerRef.current) {
            clearTimeout(entryStillnessTimerRef.current)
            entryStillnessTimerRef.current = null
          }
          if (entryHoldTimerRef.current) {
            clearTimeout(entryHoldTimerRef.current)
            entryHoldTimerRef.current = null
          }
          entryAdjustRef.current = null
          setIsEntryTouchActive(false)
          return // Let scroll happen
        }

        // If stillness confirmed but hold not confirmed, also cancel
        if (!isHoldConfirmed) {
          if (entryHoldTimerRef.current) {
            clearTimeout(entryHoldTimerRef.current)
            entryHoldTimerRef.current = null
          }
          entryAdjustRef.current = null
          setIsEntryTouchActive(false)
          setIsAdjustingEntry(false)
          return // Let scroll happen
        }
      }

      if (!isHoldConfirmed) return

      // Prevent scrolling during adjustment
      e.preventDefault()

      let newStartMins = originalStartMins
      let newEndMins = originalEndMins
      const duration = originalEndMins - originalStartMins

      // For resize operations, use absolute cursor position for precise placement
      const cursorTime = yToTime(touch.clientY)
      const cursorMins = timeToMinutes(cursorTime)

      if (dragType === 'move') {
        // For move, calculate delta and apply to both start and end
        const deltaMinutes = Math.round((deltaY / PIXELS_PER_MINUTE) / 15) * 15
        newStartMins = Math.round((originalStartMins + deltaMinutes) / 15) * 15
        newEndMins = newStartMins + duration
        if (newStartMins < 0) {
          newStartMins = 0
          newEndMins = duration
        }
        if (newEndMins > 24 * 60) {
          newEndMins = 24 * 60
          newStartMins = newEndMins - duration
        }
        if (newStartMins < 0) {
          newStartMins = 0
          newEndMins = Math.min(duration, 24 * 60)
        }
      } else if (dragType === 'resize-top') {
        // Use cursor position directly for the new start time
        newStartMins = cursorMins
        newStartMins = Math.max(0, Math.min(newStartMins, originalEndMins - 15))
      } else if (dragType === 'resize-bottom') {
        // Use cursor position directly for the new end time
        newEndMins = cursorMins
        // If cursor is near bottom of timeline (past 23:30), snap to midnight (24:00)
        if (cursorMins >= 23 * 60 + 30) {
          newEndMins = 24 * 60 // Midnight = 24:00 = 1440 minutes
        }
        newEndMins = Math.min(24 * 60, Math.max(newEndMins, originalStartMins + 15))
      }

      setAdjustPreview({
        entryId: entryAdjustRef.current.entry.id,
        startTime: minutesToTime(newStartMins),
        endTime: minutesToTime(newEndMins)
      })
    }

    const handleAdjustTouchEnd = () => {
      // Clear both timers
      if (entryStillnessTimerRef.current) {
        clearTimeout(entryStillnessTimerRef.current)
        entryStillnessTimerRef.current = null
      }
      if (entryHoldTimerRef.current) {
        clearTimeout(entryHoldTimerRef.current)
        entryHoldTimerRef.current = null
      }

      if (!entryAdjustRef.current) {
        setIsEntryTouchActive(false)
        return
      }

      const { entry, hasMoved, isHoldConfirmed } = entryAdjustRef.current

      // If user moved and confirmed, save the new times
      if (hasMoved && isHoldConfirmed && adjustPreview) {
        const { startTime, endTime } = adjustPreview
        if (startTime !== entry.placedStartTime || endTime !== entry.placedEndTime) {
          updateEntryTimes(entry.id, startTime, endTime)
        }
      } else if (!hasMoved && !isHoldConfirmed) {
        // User just tapped - open edit modal
        onEntryClick(entry)
      }

      // Reset state
      entryAdjustRef.current = null
      setIsEntryTouchActive(false)
      setIsAdjustingEntry(false)
      setAdjustPreview(null)
    }

    window.addEventListener('mousemove', handleAdjustMouseMove)
    window.addEventListener('mouseup', handleAdjustMouseUp)
    window.addEventListener('touchmove', handleAdjustTouchMove, { passive: false })
    window.addEventListener('touchend', handleAdjustTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleAdjustMouseMove)
      window.removeEventListener('mouseup', handleAdjustMouseUp)
      window.removeEventListener('touchmove', handleAdjustTouchMove)
      window.removeEventListener('touchend', handleAdjustTouchEnd)
    }
  }, [isEntryTouchActive, isAdjustingEntry, adjustPreview, updateEntryTimes, yToTime, onEntryClick])

  // Cleanup entry timers on unmount
  useEffect(() => {
    return () => {
      if (entryStillnessTimerRef.current) {
        clearTimeout(entryStillnessTimerRef.current)
      }
      if (entryHoldTimerRef.current) {
        clearTimeout(entryHoldTimerRef.current)
      }
    }
  }, [])

  // Cancel adjustment function
  const cancelAdjustment = useCallback(() => {
    // Clear entry adjustment state
    if (entryStillnessTimerRef.current) {
      clearTimeout(entryStillnessTimerRef.current)
      entryStillnessTimerRef.current = null
    }
    if (entryHoldTimerRef.current) {
      clearTimeout(entryHoldTimerRef.current)
      entryHoldTimerRef.current = null
    }
    entryAdjustRef.current = null
    setIsEntryTouchActive(false)
    setIsAdjustingEntry(false)
    setAdjustPreview(null)
  }, [])

  // Escape key to cancel adjustment
  useEffect(() => {
    if (!isAdjustingEntry) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelAdjustment()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAdjustingEntry, cancelAdjustment])

  return {
    isEntryTouchActive,
    isAdjustingEntry,
    adjustPreview,
    handleEntryMouseDown,
    handleEntryTouchStart,
  }
}