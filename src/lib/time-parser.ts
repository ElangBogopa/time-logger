/**
 * Natural Language Time Parser
 *
 * Parses natural language time expressions from activity text.
 * Supports durations, time ranges, and relative times.
 */

export interface ParsedTime {
  /** The detected time/duration text that was matched */
  matchedText: string
  /** Start index of the match in the original text */
  startIndex: number
  /** End index of the match in the original text */
  endIndex: number
  /** Type of time expression detected */
  type: 'duration' | 'time' | 'range'
  /** Parsed start time in HH:MM format (if applicable) */
  startTime?: string
  /** Parsed end time in HH:MM format (if applicable) */
  endTime?: string
  /** Duration in minutes (if applicable) */
  durationMinutes?: number
}

export interface ParseResult {
  /** The activity text with time expressions removed */
  cleanedActivity: string
  /** All detected time expressions */
  detections: ParsedTime[]
  /** Calculated start time */
  startTime: string | null
  /** Calculated end time */
  endTime: string | null
  /** Whether any time pattern was detected */
  hasTimePattern: boolean
}

/**
 * Parse hours like "2", "2.5", "1.5" to minutes
 */
function parseHoursToMinutes(hoursStr: string): number {
  const hours = parseFloat(hoursStr)
  return Math.round(hours * 60)
}

/**
 * Parse minutes like "30", "45" to number
 */
function parseMinutesToNumber(minsStr: string): number {
  return parseInt(minsStr, 10)
}

/**
 * Convert 12-hour time to 24-hour format
 */
function to24Hour(hour: number, isPM: boolean): number {
  if (isPM && hour !== 12) return hour + 12
  if (!isPM && hour === 12) return 0
  return hour
}

/**
 * Format time as HH:MM
 */
function formatTime(hours: number, minutes: number = 0): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Parse a time string like "2pm", "14:30", "2:30pm" to { hours, minutes }
 * @param inferPM - if true, infer PM for ambiguous times like "3" (assumes afternoon)
 */
function parseTimeString(timeStr: string, inferPM: boolean = false): { hours: number; minutes: number } | null {
  // Match "2pm", "2 pm", "2PM"
  const simpleMatch = timeStr.match(/^(\d{1,2})\s*(am|pm)$/i)
  if (simpleMatch) {
    const hour = parseInt(simpleMatch[1], 10)
    const isPM = simpleMatch[2].toLowerCase() === 'pm'
    return { hours: to24Hour(hour, isPM), minutes: 0 }
  }

  // Match "2:30pm", "2:30 pm", "14:30"
  const colonMatch = timeStr.match(/^(\d{1,2})[:\.](\d{2})\s*(am|pm)?$/i)
  if (colonMatch) {
    let hour = parseInt(colonMatch[1], 10)
    const minutes = parseInt(colonMatch[2], 10)
    if (colonMatch[3]) {
      const isPM = colonMatch[3].toLowerCase() === 'pm'
      hour = to24Hour(hour, isPM)
    }
    return { hours: hour, minutes }
  }

  // Match bare number "3", "10" - only if inferPM is enabled
  if (inferPM) {
    const bareMatch = timeStr.match(/^(\d{1,2})$/)
    if (bareMatch) {
      const hour = parseInt(bareMatch[1], 10)
      if (hour >= 1 && hour <= 12) {
        // Infer PM for typical work hours (1-7 -> PM, 8-12 ambiguous but lean PM for ranges)
        // This handles cases like "3 to 5" -> 3pm to 5pm
        const isPM = hour <= 7 // 1-7 are almost always PM in casual speech
        return { hours: to24Hour(hour, isPM), minutes: 0 }
      }
    }
  }

  return null
}

/**
 * Calculate end time given start time and duration in minutes
 */
function addMinutesToTime(startTime: string, minutes: number): string {
  const [hours, mins] = startTime.split(':').map(Number)
  const totalMins = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMins / 60) % 24
  const newMins = totalMins % 60
  return formatTime(newHours, newMins)
}

/**
 * Calculate start time given end time and duration in minutes
 */
function subtractMinutesFromTime(endTime: string, minutes: number): string {
  const [hours, mins] = endTime.split(':').map(Number)
  let totalMins = hours * 60 + mins - minutes
  if (totalMins < 0) totalMins += 24 * 60
  const newHours = Math.floor(totalMins / 60)
  const newMins = totalMins % 60
  return formatTime(newHours, newMins)
}

// Pattern definitions with named groups for easier extraction
const PATTERNS = {
  // Duration patterns
  durationHours: /(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|h)\b/gi,
  durationMinutes: /(\d+)\s*(?:min|mins|minute|minutes|m)\b/gi,
  durationHoursAndMinutes: /(\d+)\s*(?:hr|hour|hours|h)\s*(?:and\s*)?(\d+)\s*(?:min|mins|minute|minutes|m)/gi,
  durationHalfHour: /(?:half\s*(?:an?\s*)?hour|30\s*min(?:ute)?s?)/gi,
  durationQuarterHour: /(?:quarter\s*(?:of\s*)?(?:an?\s*)?hour|15\s*min(?:ute)?s?)/gi,
  durationAndAHalf: /(\d+)\s*(?:and\s*a\s*half|\.5)\s*(?:hr|hour|hours|h)/gi,
  durationApprox: /(?:about|around|approximately|~|approx\.?)\s*(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|h|min|mins|minute|minutes|m)/gi,

  // Time patterns
  timeWithMeridiem: /\b(\d{1,2})\s*(am|pm)\b/gi,
  timeWithColonAndMeridiem: /\b(\d{1,2})[:\.](\d{2})\s*(am|pm)\b/gi,
  timeWithColon: /\b(\d{1,2})[:\.](\d{2})\b/g,

  // Range patterns
  rangeFromTo: /(?:from\s+)?(\d{1,2}(?:[:\.]?\d{2})?\s*(?:am|pm)?)\s*(?:to|-|–|until|till)\s*(\d{1,2}(?:[:\.]?\d{2})?\s*(?:am|pm)?)/gi,
  rangeUntil: /(?:until|till|to)\s+(\d{1,2}(?:[:\.]?\d{2})?\s*(?:am|pm)?)/gi,
  rangeSince: /(?:since|from|starting\s*(?:at)?)\s+(\d{1,2}(?:[:\.]?\d{2})?\s*(?:am|pm)?)/gi,

  // Special patterns
  forDuration: /\bfor\s+(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|h|min|mins|minute|minutes|m)/gi,
}

/**
 * Detect all time patterns in the given text
 */
export function detectTimePatterns(text: string): ParsedTime[] {
  const detections: ParsedTime[] = []
  const usedRanges: Array<[number, number]> = []

  // Helper to check if a range overlaps with existing detections
  const isOverlapping = (start: number, end: number): boolean => {
    return usedRanges.some(([s, e]) => !(end <= s || start >= e))
  }

  // Helper to add a detection if not overlapping
  const addDetection = (detection: ParsedTime) => {
    if (!isOverlapping(detection.startIndex, detection.endIndex)) {
      detections.push(detection)
      usedRanges.push([detection.startIndex, detection.endIndex])
    }
  }

  // Check for time ranges first (highest priority)
  let match: RegExpExecArray | null

  // ===== RELATIVE EXPRESSIONS (highest priority) =====
  // "last hour", "past hour"
  const lastHourRegex = /\b(?:last|past)\s+hour\b/gi
  while ((match = lastHourRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: 60,
    })
  }

  // "last X hours", "past X hours"
  const lastXHoursRegex = /\b(?:last|past)\s+(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|h)\b/gi
  while ((match = lastXHoursRegex.exec(text)) !== null) {
    const hours = parseFloat(match[1])
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: Math.round(hours * 60),
    })
  }

  // "last X minutes", "past X minutes"
  const lastXMinsRegex = /\b(?:last|past)\s+(\d+)\s*(?:min|mins|minute|minutes|m)\b/gi
  while ((match = lastXMinsRegex.exec(text)) !== null) {
    const mins = parseInt(match[1], 10)
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: mins,
    })
  }

  // ===== TIME OF DAY KEYWORDS =====
  // "at noon", "at midday"
  const atNoonRegex = /\b(?:at\s+)?(?:noon|midday)\b/gi
  while ((match = atNoonRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'time',
      startTime: '12:00',
    })
  }

  // "at midnight"
  const atMidnightRegex = /\b(?:at\s+)?midnight\b/gi
  while ((match = atMidnightRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'time',
      startTime: '00:00',
    })
  }

  // "this morning" -> 09:00
  const thisMorningRegex = /\b(?:this\s+)?morning\b/gi
  while ((match = thisMorningRegex.exec(text)) !== null) {
    // Only match if it's "this morning" or standalone "morning" at word boundary
    // Don't match "good morning" patterns
    const beforeText = text.slice(0, match.index).toLowerCase()
    if (beforeText.endsWith('good ')) continue

    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'time',
      startTime: '09:00',
    })
  }

  // "this afternoon" -> 14:00
  const thisAfternoonRegex = /\b(?:this\s+)?afternoon\b/gi
  while ((match = thisAfternoonRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'time',
      startTime: '14:00',
    })
  }

  // "this evening" -> 18:00
  const thisEveningRegex = /\b(?:this\s+)?evening\b/gi
  while ((match = thisEveningRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'time',
      startTime: '18:00',
    })
  }

  // ===== "AT" PATTERNS =====
  // "at 3" (bare number with "at" prefix) -> infer PM for 1-7, AM for 8-11, noon for 12
  const atBareNumberRegex = /\bat\s+(\d{1,2})\b(?!\s*(?:am|pm|:|\.|\d))/gi
  while ((match = atBareNumberRegex.exec(text)) !== null) {
    const hour = parseInt(match[1], 10)
    if (hour >= 1 && hour <= 12) {
      let finalHour: number
      if (hour === 12) {
        // 12 = noon
        finalHour = 12
      } else if (hour <= 7) {
        // 1-7 -> PM (afternoon hours)
        finalHour = hour + 12
      } else {
        // 8-11 -> AM (morning hours)
        finalHour = hour
      }
      addDetection({
        matchedText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        type: 'time',
        startTime: formatTime(finalHour, 0),
      })
    }
  }

  // ===== ACTIVITY-BASED TIME INFERENCE =====
  // "lunch" -> 12:00-13:00
  const lunchRegex = /\blunch\b/gi
  while ((match = lunchRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'range',
      startTime: '12:00',
      endTime: '13:00',
    })
  }

  // "breakfast" -> 07:00-08:00
  const breakfastRegex = /\bbreakfast\b/gi
  while ((match = breakfastRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'range',
      startTime: '07:00',
      endTime: '08:00',
    })
  }

  // "dinner" -> 18:00-19:00
  const dinnerRegex = /\bdinner\b/gi
  while ((match = dinnerRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'range',
      startTime: '18:00',
      endTime: '19:00',
    })
  }

  // ===== DURATION MODIFIERS =====
  // "quick" -> 15 minutes (only when followed by activity-like words)
  const quickRegex = /\bquick\s+(?:call|meeting|chat|sync|standup|break|check|review)\b/gi
  while ((match = quickRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: 15,
    })
  }

  // "brief" -> 15 minutes
  const briefRegex = /\bbrief\s+(?:call|meeting|chat|sync|standup|break|check|review)\b/gi
  while ((match = briefRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: 15,
    })
  }

  // ===== EXISTING PATTERNS =====
  // "from X to Y", "X-Y", "X to Y" - supports bare numbers like "3 to 5"
  const rangeRegex = /(?:from\s+)?(\d{1,2}(?:[:\.]?\d{2})?\s*(?:am|pm)?)\s*(?:to|-|–|until|till)\s*(\d{1,2}(?:[:\.]?\d{2})?\s*(?:am|pm)?)/gi
  while ((match = rangeRegex.exec(text)) !== null) {
    const time1 = match[1].trim()
    const time2 = match[2].trim()

    // Check if either time has explicit am/pm
    const hasExplicitMeridiem = /am|pm/i.test(time1) || /am|pm/i.test(time2)

    // If no explicit am/pm, infer PM for typical work hour patterns
    const startParsed = parseTimeString(time1, !hasExplicitMeridiem)
    const endParsed = parseTimeString(time2, !hasExplicitMeridiem)

    if (startParsed && endParsed) {
      addDetection({
        matchedText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        type: 'range',
        startTime: formatTime(startParsed.hours, startParsed.minutes),
        endTime: formatTime(endParsed.hours, endParsed.minutes),
      })
    }
  }

  // "for X hours/minutes" patterns
  const forDurationRegex = /\bfor\s+(\d+(?:\.\d+)?)\s*(hr|hour|hours|h|min|mins|minute|minutes|m)\b/gi
  while ((match = forDurationRegex.exec(text)) !== null) {
    const value = parseFloat(match[1])
    const unit = match[2].toLowerCase()
    const isHours = unit.startsWith('h')
    const minutes = isHours ? Math.round(value * 60) : value

    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: minutes,
    })
  }

  // "X and a half hours"
  const andAHalfRegex = /(\d+)\s*(?:and\s*a\s*half)\s*(?:hr|hour|hours|h)/gi
  while ((match = andAHalfRegex.exec(text)) !== null) {
    const hours = parseInt(match[1], 10)
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: hours * 60 + 30,
    })
  }

  // "half hour", "half an hour"
  const halfHourRegex = /\bhalf\s*(?:an?\s*)?hour\b/gi
  while ((match = halfHourRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: 30,
    })
  }

  // "quarter hour"
  const quarterHourRegex = /\bquarter\s*(?:of\s*)?(?:an?\s*)?hour\b/gi
  while ((match = quarterHourRegex.exec(text)) !== null) {
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: 15,
    })
  }

  // "about/around/~X hours/minutes"
  const approxRegex = /(?:about|around|approximately|~|approx\.?)\s*(\d+(?:\.\d+)?)\s*(hr|hour|hours|h|min|mins|minute|minutes|m)\b/gi
  while ((match = approxRegex.exec(text)) !== null) {
    const value = parseFloat(match[1])
    const unit = match[2].toLowerCase()
    const isHours = unit.startsWith('h')
    const minutes = isHours ? Math.round(value * 60) : value

    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: minutes,
    })
  }

  // Plain duration: "2 hours", "30 minutes", "2h", "30m" (but not already matched)
  const plainHoursRegex = /\b(\d+(?:\.\d+)?)\s*(hr|hour|hours|h)\b/gi
  while ((match = plainHoursRegex.exec(text)) !== null) {
    const hours = parseFloat(match[1])
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: Math.round(hours * 60),
    })
  }

  const plainMinutesRegex = /\b(\d+)\s*(min|mins|minute|minutes|m)\b/gi
  while ((match = plainMinutesRegex.exec(text)) !== null) {
    const minutes = parseInt(match[1], 10)
    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'duration',
      durationMinutes: minutes,
    })
  }

  // "until/till X" (only time, end time)
  const untilRegex = /\b(?:until|till)\s+(\d{1,2}(?:[:\.]?\d{2})?\s*(?:am|pm)?)\b/gi
  while ((match = untilRegex.exec(text)) !== null) {
    const timeParsed = parseTimeString(match[1].trim())
    if (timeParsed) {
      addDetection({
        matchedText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        type: 'time',
        endTime: formatTime(timeParsed.hours, timeParsed.minutes),
      })
    }
  }

  // "since/from X" (only time, start time)
  const sinceRegex = /\b(?:since|from|starting(?:\s*at)?)\s+(\d{1,2}(?:[:\.]?\d{2})?\s*(?:am|pm)?)\b/gi
  while ((match = sinceRegex.exec(text)) !== null) {
    const timeParsed = parseTimeString(match[1].trim())
    if (timeParsed) {
      addDetection({
        matchedText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        type: 'time',
        startTime: formatTime(timeParsed.hours, timeParsed.minutes),
      })
    }
  }

  // Standalone time with meridiem: "2pm", "10am" (lower priority)
  const standaloneTimeRegex = /\b(\d{1,2})[:\.]?(\d{2})?\s*(am|pm)\b/gi
  while ((match = standaloneTimeRegex.exec(text)) !== null) {
    const hour = parseInt(match[1], 10)
    const minutes = match[2] ? parseInt(match[2], 10) : 0
    const isPM = match[3].toLowerCase() === 'pm'

    addDetection({
      matchedText: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      type: 'time',
      startTime: formatTime(to24Hour(hour, isPM), minutes),
    })
  }

  // Sort by position in text
  detections.sort((a, b) => a.startIndex - b.startIndex)

  return detections
}

/**
 * Check if text contains any time-related patterns
 */
export function hasTimePattern(text: string): boolean {
  if (!text || text.trim().length < 2) return false
  return detectTimePatterns(text).length > 0
}

/**
 * Infer a default duration based on activity keywords
 * Returns duration in minutes
 */
function inferDefaultDuration(text: string): number {
  const lowerText = text.toLowerCase()

  // Quick activities (15 min)
  // Standups, check-ins, quick ceremonies
  if (/\b(standup|stand-up|daily|huddle|check-in|checkin|scrum|debrief|recap|catchup|catch-up)\b/.test(lowerText)) {
    return 15
  }

  // Short activities (30 min)
  // Calls, quick syncs, reviews
  if (/\b(call|chat|sync|1:1|one-on-one|coffee|break|phone|video|demo|walkthrough|review|feedback|pairing|pair\s*programming)\b/.test(lowerText)) {
    return 30
  }

  // Medium-short activities (45 min)
  // Interviews, planning, brainstorms
  if (/\b(interview|screening|planning|sprint|grooming|refinement|brainstorm|brainstorming|retro|retrospective)\b/.test(lowerText)) {
    return 45
  }

  // Extended activities (1.5 hours / 90 min)
  // Classes, lectures, training
  if (/\b(lecture|class|seminar|training|course|lesson|tutorial)\b/.test(lowerText)) {
    return 90
  }

  // Long activities (2 hours)
  // Deep work, focused sessions, creative work
  if (/\b(workshop|deep\s*work|focus\s*time|focus\s*session|coding|programming|development|study|studying|learning|writing|drafting|research|analysis|design|prototyping|exam|test|assessment|project|building|creating)\b/.test(lowerText)) {
    return 120
  }

  // Very long activities (3 hours)
  // Offsites, extended workshops
  if (/\b(offsite|bootcamp|hackathon|marathon)\b/.test(lowerText)) {
    return 180
  }

  // Standard activities (1 hour) - default
  // Meetings, presentations, discussions
  // Also catches: meeting, presentation, webinar, onboarding, orientation, discussion
  return 60
}

/**
 * Parse time expressions from text and return structured result
 */
export function parseTimeFromText(
  text: string,
  currentTime?: string
): ParseResult {
  const detections = detectTimePatterns(text)

  if (detections.length === 0) {
    return {
      cleanedActivity: text,
      detections: [],
      startTime: null,
      endTime: null,
      hasTimePattern: false,
    }
  }

  // Remove detected patterns from text to get clean activity
  let cleanedActivity = text
  // Process in reverse order to maintain correct indices
  const sortedDetections = [...detections].sort((a, b) => b.startIndex - a.startIndex)
  for (const detection of sortedDetections) {
    cleanedActivity =
      cleanedActivity.slice(0, detection.startIndex) +
      cleanedActivity.slice(detection.endIndex)
  }
  // Clean up extra spaces
  cleanedActivity = cleanedActivity.replace(/\s+/g, ' ').trim()

  // Calculate final start and end times
  let startTime: string | null = null
  let endTime: string | null = null
  let totalDuration = 0

  for (const detection of detections) {
    if (detection.type === 'range') {
      startTime = detection.startTime || startTime
      endTime = detection.endTime || endTime
    } else if (detection.type === 'time') {
      if (detection.startTime) startTime = detection.startTime
      if (detection.endTime) endTime = detection.endTime
    } else if (detection.type === 'duration') {
      totalDuration += detection.durationMinutes || 0
    }
  }

  // If we have duration but no times, calculate based on current time
  if (totalDuration > 0 && !startTime && !endTime && currentTime) {
    // Assume duration ends at current time
    endTime = currentTime
    startTime = subtractMinutesFromTime(currentTime, totalDuration)
  } else if (totalDuration > 0 && startTime && !endTime) {
    // Have start time and duration, calculate end
    endTime = addMinutesToTime(startTime, totalDuration)
  } else if (totalDuration > 0 && !startTime && endTime) {
    // Have end time and duration, calculate start
    startTime = subtractMinutesFromTime(endTime, totalDuration)
  }

  // If we have start time but no end time and no duration, infer default duration
  if (startTime && !endTime && totalDuration === 0) {
    const defaultDuration = inferDefaultDuration(text)
    endTime = addMinutesToTime(startTime, defaultDuration)
  }

  return {
    cleanedActivity,
    detections,
    startTime,
    endTime,
    hasTimePattern: true,
  }
}

/**
 * Get highlighted segments for rendering
 * Returns an array of { text, isHighlighted } segments
 */
export function getHighlightedSegments(
  text: string,
  detections: ParsedTime[]
): Array<{ text: string; isHighlighted: boolean; detection?: ParsedTime }> {
  if (detections.length === 0) {
    return [{ text, isHighlighted: false }]
  }

  const segments: Array<{ text: string; isHighlighted: boolean; detection?: ParsedTime }> = []
  let lastEnd = 0

  // Sort by start index
  const sorted = [...detections].sort((a, b) => a.startIndex - b.startIndex)

  for (const detection of sorted) {
    // Add non-highlighted text before this detection
    if (detection.startIndex > lastEnd) {
      segments.push({
        text: text.slice(lastEnd, detection.startIndex),
        isHighlighted: false,
      })
    }

    // Add highlighted text
    segments.push({
      text: text.slice(detection.startIndex, detection.endIndex),
      isHighlighted: true,
      detection,
    })

    lastEnd = detection.endIndex
  }

  // Add remaining text after last detection
  if (lastEnd < text.length) {
    segments.push({
      text: text.slice(lastEnd),
      isHighlighted: false,
    })
  }

  return segments
}
