/**
 * Tests for Natural Language Time Parser
 *
 * Tests cover:
 * - Duration patterns (hours, minutes, combinations)
 * - Time patterns (12h, 24h, with/without meridiem)
 * - Range patterns (from-to, until, since)
 * - Edge cases and complex inputs
 * - Highlighting/segmentation for UI
 */

import {
  detectTimePatterns,
  hasTimePattern,
  parseTimeFromText,
  getHighlightedSegments,
  ParsedTime,
} from '@/lib/time-parser'

describe('Time Parser - Pattern Detection', () => {
  describe('Duration Patterns', () => {
    describe('Hours', () => {
      it('should detect "X hours"', () => {
        const detections = detectTimePatterns('worked for 2 hours')
        expect(detections).toHaveLength(1)
        expect(detections[0].type).toBe('duration')
        expect(detections[0].durationMinutes).toBe(120)
        expect(detections[0].matchedText).toContain('2 hours')
      })

      it('should detect "Xh" shorthand', () => {
        const detections = detectTimePatterns('coded 2h')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(120)
      })

      it('should detect "X hr"', () => {
        const detections = detectTimePatterns('meeting 1 hr')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(60)
      })

      it('should detect decimal hours "1.5 hours"', () => {
        const detections = detectTimePatterns('worked 1.5 hours')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(90)
      })

      it('should detect "2.5h"', () => {
        const detections = detectTimePatterns('coding 2.5h')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(150)
      })
    })

    describe('Minutes', () => {
      it('should detect "X minutes"', () => {
        const detections = detectTimePatterns('break for 30 minutes')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(30)
      })

      it('should detect "Xm" shorthand', () => {
        const detections = detectTimePatterns('task took 15m')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(15)
      })

      it('should detect "X min"', () => {
        const detections = detectTimePatterns('standup 15 min')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(15)
      })

      it('should detect "X mins"', () => {
        const detections = detectTimePatterns('coffee break 10 mins')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(10)
      })
    })

    describe('Special Durations', () => {
      it('should detect "half hour"', () => {
        const detections = detectTimePatterns('half hour meeting')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(30)
      })

      it('should detect "half an hour"', () => {
        const detections = detectTimePatterns('took half an hour')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(30)
      })

      it('should detect "quarter hour"', () => {
        const detections = detectTimePatterns('quarter hour break')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(15)
      })

      it('should detect "X and a half hours"', () => {
        const detections = detectTimePatterns('worked 2 and a half hours')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(150)
      })
    })

    describe('Approximate Durations', () => {
      it('should detect "about X hours"', () => {
        const detections = detectTimePatterns('worked about 2 hours')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(120)
      })

      it('should detect "around X minutes"', () => {
        const detections = detectTimePatterns('around 45 minutes')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(45)
      })

      it('should detect "~Xh"', () => {
        const detections = detectTimePatterns('coding ~2h')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(120)
      })

      it('should detect "approximately X hours"', () => {
        const detections = detectTimePatterns('approximately 3 hours')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(180)
      })
    })

    describe('"for X" Patterns', () => {
      it('should detect "for X hours"', () => {
        const detections = detectTimePatterns('coded for 3 hours')
        expect(detections).toHaveLength(1)
        expect(detections[0].matchedText).toBe('for 3 hours')
        expect(detections[0].durationMinutes).toBe(180)
      })

      it('should detect "for X minutes"', () => {
        const detections = detectTimePatterns('exercised for 45 minutes')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(45)
      })

      it('should detect "for Xh"', () => {
        const detections = detectTimePatterns('reading for 1h')
        expect(detections).toHaveLength(1)
        expect(detections[0].durationMinutes).toBe(60)
      })
    })
  })

  describe('Time Patterns', () => {
    describe('12-hour Format', () => {
      it('should detect "Xpm"', () => {
        const detections = detectTimePatterns('meeting at 2pm')
        expect(detections).toHaveLength(1)
        expect(detections[0].type).toBe('time')
        expect(detections[0].startTime).toBe('14:00')
      })

      it('should detect "Xam"', () => {
        const detections = detectTimePatterns('started at 9am')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('09:00')
      })

      it('should detect "X pm" with space', () => {
        const detections = detectTimePatterns('meeting at 12 pm')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('12:00')
      })

      it('should detect "X:XXpm"', () => {
        const detections = detectTimePatterns('call at 2:30pm')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('14:30')
      })

      it('should detect "X:XX am"', () => {
        const detections = detectTimePatterns('standup at 9:15 am')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('09:15')
      })

      it('should handle 12pm correctly (noon)', () => {
        const detections = detectTimePatterns('meeting at 12pm')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('12:00')
      })

      it('should handle 12am correctly (midnight)', () => {
        const detections = detectTimePatterns('finished at 12am')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('00:00')
      })
    })
  })

  describe('Range Patterns', () => {
    it('should detect "from X to Y"', () => {
      const detections = detectTimePatterns('worked from 9am to 5pm')
      expect(detections).toHaveLength(1)
      expect(detections[0].type).toBe('range')
      expect(detections[0].startTime).toBe('09:00')
      expect(detections[0].endTime).toBe('17:00')
    })

    it('should detect "X to Y" without "from"', () => {
      const detections = detectTimePatterns('meeting 2pm to 3pm')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('14:00')
      expect(detections[0].endTime).toBe('15:00')
    })

    it('should detect "X-Y" with dash', () => {
      const detections = detectTimePatterns('work 9am-12pm')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('09:00')
      expect(detections[0].endTime).toBe('12:00')
    })

    it('should detect "X – Y" with en-dash', () => {
      const detections = detectTimePatterns('call 2pm – 3pm')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('14:00')
      expect(detections[0].endTime).toBe('15:00')
    })

    it('should detect "until Xpm"', () => {
      const detections = detectTimePatterns('worked until 6pm')
      expect(detections).toHaveLength(1)
      expect(detections[0].endTime).toBe('18:00')
    })

    it('should detect "till Xpm"', () => {
      const detections = detectTimePatterns('coding till 5pm')
      expect(detections).toHaveLength(1)
      expect(detections[0].endTime).toBe('17:00')
    })

    it('should detect "since Xam"', () => {
      const detections = detectTimePatterns('working since 8am')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('08:00')
    })

    it('should detect "from Xam"', () => {
      const detections = detectTimePatterns('available from 10am')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('10:00')
    })

    it('should detect "starting at X"', () => {
      const detections = detectTimePatterns('meeting starting at 2pm')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('14:00')
    })

    describe('Bare Number Ranges (no am/pm)', () => {
      it('should detect "3 to 5" as 3pm-5pm', () => {
        const detections = detectTimePatterns('meeting 3 to 5')
        expect(detections).toHaveLength(1)
        expect(detections[0].type).toBe('range')
        expect(detections[0].startTime).toBe('15:00')
        expect(detections[0].endTime).toBe('17:00')
      })

      it('should detect "9-11" as 9am-11am (morning hours)', () => {
        const detections = detectTimePatterns('work 9-11')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('09:00')
        expect(detections[0].endTime).toBe('11:00')
      })

      it('should detect "1 to 3" as 1pm-3pm', () => {
        const detections = detectTimePatterns('meeting 1 to 3')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('13:00')
        expect(detections[0].endTime).toBe('15:00')
      })

      it('should detect "from 2 to 4" as 2pm-4pm', () => {
        const detections = detectTimePatterns('from 2 to 4')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('14:00')
        expect(detections[0].endTime).toBe('16:00')
      })

      it('should detect "4-6" as 4pm-6pm', () => {
        const detections = detectTimePatterns('gym 4-6')
        expect(detections).toHaveLength(1)
        expect(detections[0].startTime).toBe('16:00')
        expect(detections[0].endTime).toBe('18:00')
      })

      it('should still use explicit am/pm when provided', () => {
        const detections = detectTimePatterns('meeting 9am to 11')
        expect(detections).toHaveLength(1)
        // When one has am/pm, don't infer for the other
        expect(detections[0].startTime).toBe('09:00')
      })
    })
  })
})

describe('Time Parser - hasTimePattern', () => {
  it('should return true for text with duration', () => {
    expect(hasTimePattern('worked for 2 hours')).toBe(true)
    expect(hasTimePattern('30m break')).toBe(true)
    expect(hasTimePattern('1h coding')).toBe(true)
  })

  it('should return true for text with time', () => {
    expect(hasTimePattern('meeting at 2pm')).toBe(true)
    expect(hasTimePattern('started 9am')).toBe(true)
  })

  it('should return true for text with range', () => {
    expect(hasTimePattern('9am to 5pm')).toBe(true)
    expect(hasTimePattern('from 2pm to 3pm')).toBe(true)
  })

  it('should return false for text without time patterns', () => {
    expect(hasTimePattern('worked on project')).toBe(false)
    expect(hasTimePattern('meeting with team')).toBe(false)
    expect(hasTimePattern('coding')).toBe(false)
  })

  it('should return false for empty or very short text', () => {
    expect(hasTimePattern('')).toBe(false)
    expect(hasTimePattern('a')).toBe(false)
  })

  it('should handle edge cases', () => {
    // Numbers without time context should not match
    expect(hasTimePattern('worked on issue 123')).toBe(false)
    expect(hasTimePattern('version 2.0')).toBe(false)
  })
})

describe('Time Parser - parseTimeFromText', () => {
  it('should return cleaned activity without time expressions', () => {
    const result = parseTimeFromText('worked on auth for 2 hours')
    expect(result.cleanedActivity).toBe('worked on auth')
    expect(result.hasTimePattern).toBe(true)
  })

  it('should extract start and end times from range', () => {
    const result = parseTimeFromText('meeting from 2pm to 3pm')
    expect(result.startTime).toBe('14:00')
    expect(result.endTime).toBe('15:00')
    expect(result.cleanedActivity).toBe('meeting')
  })

  it('should calculate times from duration when current time provided', () => {
    const result = parseTimeFromText('coded for 2 hours', '14:00')
    expect(result.startTime).toBe('12:00')
    expect(result.endTime).toBe('14:00')
  })

  it('should handle duration with start time', () => {
    const result = parseTimeFromText('worked from 9am for 3 hours')
    expect(result.startTime).toBe('09:00')
    expect(result.endTime).toBe('12:00')
  })

  it('should handle duration with end time (until)', () => {
    const result = parseTimeFromText('worked for 2 hours until 5pm')
    expect(result.startTime).toBe('15:00')
    expect(result.endTime).toBe('17:00')
  })

  it('should return original text when no patterns found', () => {
    const result = parseTimeFromText('worked on project')
    expect(result.cleanedActivity).toBe('worked on project')
    expect(result.hasTimePattern).toBe(false)
    expect(result.startTime).toBeNull()
    expect(result.endTime).toBeNull()
  })
})

describe('Time Parser - getHighlightedSegments', () => {
  it('should return single unhighlighted segment for no detections', () => {
    const segments = getHighlightedSegments('worked on project', [])
    expect(segments).toHaveLength(1)
    expect(segments[0].text).toBe('worked on project')
    expect(segments[0].isHighlighted).toBe(false)
  })

  it('should highlight duration in middle of text', () => {
    const text = 'worked for 2 hours on project'
    const detections = detectTimePatterns(text)
    const segments = getHighlightedSegments(text, detections)

    // Should have 3 segments: before, highlighted, after
    expect(segments.length).toBeGreaterThanOrEqual(2)

    const highlighted = segments.find(s => s.isHighlighted)
    expect(highlighted).toBeDefined()
    expect(highlighted?.text).toContain('2 hours')
  })

  it('should highlight time at end of text', () => {
    const text = 'meeting at 2pm'
    const detections = detectTimePatterns(text)
    const segments = getHighlightedSegments(text, detections)

    const highlighted = segments.find(s => s.isHighlighted)
    expect(highlighted).toBeDefined()
    expect(highlighted?.text).toContain('2pm')
  })

  it('should highlight range', () => {
    const text = 'worked from 9am to 5pm'
    const detections = detectTimePatterns(text)
    const segments = getHighlightedSegments(text, detections)

    const highlighted = segments.find(s => s.isHighlighted)
    expect(highlighted).toBeDefined()
    expect(highlighted?.text).toContain('9am')
    expect(highlighted?.text).toContain('5pm')
  })

  it('should include detection info in highlighted segments', () => {
    const text = 'coded for 2 hours'
    const detections = detectTimePatterns(text)
    const segments = getHighlightedSegments(text, detections)

    const highlighted = segments.find(s => s.isHighlighted)
    expect(highlighted?.detection).toBeDefined()
    expect(highlighted?.detection?.durationMinutes).toBe(120)
  })
})

describe('Time Parser - Edge Cases', () => {
  it('should not match random numbers', () => {
    expect(detectTimePatterns('issue #123')).toHaveLength(0)
    expect(detectTimePatterns('version 2.0.1')).toHaveLength(0)
    expect(detectTimePatterns('room 404')).toHaveLength(0)
  })

  it('should handle multiple patterns in one text', () => {
    // This might detect multiple things, but shouldn't crash
    const text = 'meeting from 2pm for 1 hour'
    const detections = detectTimePatterns(text)
    expect(detections.length).toBeGreaterThan(0)
  })

  it('should handle text with no spaces around time', () => {
    const detections = detectTimePatterns('meeting2pm')
    // May or may not detect - just shouldn't crash
    expect(Array.isArray(detections)).toBe(true)
  })

  it('should be case insensitive', () => {
    expect(detectTimePatterns('2PM')[0]?.startTime).toBe('14:00')
    expect(detectTimePatterns('2Am')[0]?.startTime).toBe('02:00')
    expect(detectTimePatterns('2 HOURS')[0]?.durationMinutes).toBe(120)
  })

  it('should handle whitespace variations', () => {
    expect(detectTimePatterns('2  hours')[0]?.durationMinutes).toBe(120)
    expect(detectTimePatterns('2\thours')).toHaveLength(1)
  })
})

describe('Time Parser - Real World Examples', () => {
  const examples = [
    { input: 'coded for 2 hours', expectedDuration: 120 },
    { input: 'meeting with John 2pm to 3pm', expectedStart: '14:00', expectedEnd: '15:00' },
    { input: '1h standup', expectedDuration: 60 },
    { input: 'coffee break half hour', expectedDuration: 30 },
    { input: 'worked on auth feature from 9am until 12pm', expectedStart: '09:00', expectedEnd: '12:00' },
    { input: 'quick 15m call', expectedDuration: 15 },
    { input: 'deep work session ~3h', expectedDuration: 180 },
    { input: 'worked about 2 and a half hours', expectedDuration: 150 },
  ]

  examples.forEach(({ input, expectedDuration, expectedStart, expectedEnd }) => {
    it(`should parse "${input}"`, () => {
      const result = parseTimeFromText(input, '17:00')

      if (expectedDuration) {
        expect(result.detections[0]?.durationMinutes).toBe(expectedDuration)
      }
      if (expectedStart) {
        expect(result.startTime).toBe(expectedStart)
      }
      if (expectedEnd) {
        expect(result.endTime).toBe(expectedEnd)
      }
      expect(result.hasTimePattern).toBe(true)
    })
  })
})

describe('Time Parser - Time of Day Keywords', () => {
  describe('Noon/Midday', () => {
    it('should detect "noon" as 12:00', () => {
      const detections = detectTimePatterns('meeting at noon')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('12:00')
    })

    it('should detect standalone "noon"', () => {
      const detections = detectTimePatterns('noon call')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('12:00')
    })

    it('should detect "midday" as 12:00', () => {
      const detections = detectTimePatterns('midday break')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('12:00')
    })

    it('should detect "at midday"', () => {
      const detections = detectTimePatterns('meeting at midday')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('12:00')
    })
  })

  describe('Midnight', () => {
    it('should detect "midnight" as 00:00', () => {
      const detections = detectTimePatterns('finished at midnight')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('00:00')
    })

    it('should detect standalone "midnight"', () => {
      const detections = detectTimePatterns('midnight snack')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('00:00')
    })
  })

  describe('Morning/Afternoon/Evening', () => {
    it('should detect "this morning" as 09:00', () => {
      const detections = detectTimePatterns('worked this morning')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('09:00')
    })

    it('should detect standalone "morning" as 09:00', () => {
      const detections = detectTimePatterns('morning standup')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('09:00')
    })

    it('should detect "this afternoon" as 14:00', () => {
      const detections = detectTimePatterns('meeting this afternoon')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('14:00')
    })

    it('should detect standalone "afternoon" as 14:00', () => {
      const detections = detectTimePatterns('afternoon focus time')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('14:00')
    })

    it('should detect "this evening" as 18:00', () => {
      const detections = detectTimePatterns('gym this evening')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('18:00')
    })

    it('should detect standalone "evening" as 18:00', () => {
      const detections = detectTimePatterns('evening walk')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('18:00')
    })

    it('should NOT detect "good morning" as time', () => {
      const detections = detectTimePatterns('good morning team')
      expect(detections).toHaveLength(0)
    })
  })
})

describe('Time Parser - Activity-Based Time Inference', () => {
  describe('Meals', () => {
    it('should detect "lunch" as 12:00-13:00', () => {
      const detections = detectTimePatterns('lunch with team')
      expect(detections).toHaveLength(1)
      expect(detections[0].type).toBe('range')
      expect(detections[0].startTime).toBe('12:00')
      expect(detections[0].endTime).toBe('13:00')
    })

    it('should detect "breakfast" as 07:00-08:00', () => {
      const detections = detectTimePatterns('breakfast meeting')
      expect(detections).toHaveLength(1)
      expect(detections[0].type).toBe('range')
      expect(detections[0].startTime).toBe('07:00')
      expect(detections[0].endTime).toBe('08:00')
    })

    it('should detect "dinner" as 18:00-19:00', () => {
      const detections = detectTimePatterns('dinner with family')
      expect(detections).toHaveLength(1)
      expect(detections[0].type).toBe('range')
      expect(detections[0].startTime).toBe('18:00')
      expect(detections[0].endTime).toBe('19:00')
    })
  })
})

describe('Time Parser - Duration Modifiers', () => {
  describe('Quick/Brief', () => {
    it('should detect "quick call" as 15 minutes', () => {
      const detections = detectTimePatterns('quick call with John')
      expect(detections).toHaveLength(1)
      expect(detections[0].type).toBe('duration')
      expect(detections[0].durationMinutes).toBe(15)
    })

    it('should detect "quick meeting" as 15 minutes', () => {
      const detections = detectTimePatterns('quick meeting')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(15)
    })

    it('should detect "quick sync" as 15 minutes', () => {
      const detections = detectTimePatterns('quick sync')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(15)
    })

    it('should detect "quick standup" as 15 minutes', () => {
      const detections = detectTimePatterns('quick standup')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(15)
    })

    it('should detect "brief call" as 15 minutes', () => {
      const detections = detectTimePatterns('brief call')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(15)
    })

    it('should detect "brief meeting" as 15 minutes', () => {
      const detections = detectTimePatterns('brief meeting')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(15)
    })

    it('should detect "quick check" as 15 minutes', () => {
      const detections = detectTimePatterns('quick check on PR')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(15)
    })

    it('should detect "quick review" as 15 minutes', () => {
      const detections = detectTimePatterns('quick review')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(15)
    })

    it('should NOT detect "quick" without activity word', () => {
      const detections = detectTimePatterns('quick')
      expect(detections).toHaveLength(0)
    })
  })
})

describe('Time Parser - Relative Expressions', () => {
  describe('Last/Past Hour', () => {
    it('should detect "last hour" as 60 minutes', () => {
      const detections = detectTimePatterns('worked last hour')
      expect(detections).toHaveLength(1)
      expect(detections[0].type).toBe('duration')
      expect(detections[0].durationMinutes).toBe(60)
    })

    it('should detect "past hour" as 60 minutes', () => {
      const detections = detectTimePatterns('coded for the past hour')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(60)
    })
  })

  describe('Last/Past X Hours', () => {
    it('should detect "last 2 hours" as 120 minutes', () => {
      const detections = detectTimePatterns('worked last 2 hours')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(120)
    })

    it('should detect "past 3 hours" as 180 minutes', () => {
      const detections = detectTimePatterns('past 3 hours of coding')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(180)
    })

    it('should detect "last 1.5 hours" as 90 minutes', () => {
      const detections = detectTimePatterns('last 1.5 hours')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(90)
    })

    it('should detect "past 2h" as 120 minutes', () => {
      const detections = detectTimePatterns('past 2h')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(120)
    })
  })

  describe('Last/Past X Minutes', () => {
    it('should detect "last 30 minutes" as 30 minutes', () => {
      const detections = detectTimePatterns('last 30 minutes')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(30)
    })

    it('should detect "past 45 mins" as 45 minutes', () => {
      const detections = detectTimePatterns('past 45 mins')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(45)
    })

    it('should detect "last 15m" as 15 minutes', () => {
      const detections = detectTimePatterns('last 15m')
      expect(detections).toHaveLength(1)
      expect(detections[0].durationMinutes).toBe(15)
    })
  })
})

describe('Time Parser - "At" Patterns', () => {
  describe('At + Bare Number', () => {
    it('should detect "at 3" as 15:00 (3pm)', () => {
      const detections = detectTimePatterns('meeting at 3')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('15:00')
    })

    it('should detect "at 5" as 17:00 (5pm)', () => {
      const detections = detectTimePatterns('call at 5')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('17:00')
    })

    it('should detect "at 9" as 09:00 (9am for 8-12)', () => {
      const detections = detectTimePatterns('standup at 9')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('09:00')
    })

    it('should detect "at 10" as 10:00', () => {
      const detections = detectTimePatterns('meeting at 10')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('10:00')
    })

    it('should detect "at 12" as 12:00', () => {
      const detections = detectTimePatterns('meeting at 12')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('12:00')
    })

    it('should NOT interfere with "at 3pm" (explicit meridiem)', () => {
      const detections = detectTimePatterns('meeting at 3pm')
      expect(detections).toHaveLength(1)
      expect(detections[0].startTime).toBe('15:00')
    })
  })
})

describe('Time Parser - Combined New Patterns', () => {
  it('should parse "quick call at noon"', () => {
    const result = parseTimeFromText('quick call at noon', '14:00')
    expect(result.hasTimePattern).toBe(true)
    // Should have both quick call (duration) and noon (time)
    expect(result.detections.length).toBeGreaterThanOrEqual(1)
  })

  it('should parse "lunch meeting"', () => {
    const result = parseTimeFromText('lunch meeting', '14:00')
    expect(result.startTime).toBe('12:00')
    expect(result.endTime).toBe('13:00')
  })

  it('should parse "breakfast with client"', () => {
    const result = parseTimeFromText('breakfast with client', '09:00')
    expect(result.startTime).toBe('07:00')
    expect(result.endTime).toBe('08:00')
  })

  it('should parse "worked the past 2 hours"', () => {
    const result = parseTimeFromText('worked the past 2 hours', '16:00')
    expect(result.hasTimePattern).toBe(true)
    expect(result.startTime).toBe('14:00')
    expect(result.endTime).toBe('16:00')
  })

  it('should parse "quick sync this afternoon"', () => {
    const result = parseTimeFromText('quick sync this afternoon', '15:00')
    expect(result.hasTimePattern).toBe(true)
  })

  it('should parse "dinner with family"', () => {
    const result = parseTimeFromText('dinner with family', '20:00')
    expect(result.startTime).toBe('18:00')
    expect(result.endTime).toBe('19:00')
  })

  it('should parse "brief meeting at 3"', () => {
    const result = parseTimeFromText('brief meeting at 3', '14:00')
    expect(result.hasTimePattern).toBe(true)
  })

  it('should parse "last 30 minutes of coding"', () => {
    const result = parseTimeFromText('last 30 minutes of coding', '17:00')
    expect(result.startTime).toBe('16:30')
    expect(result.endTime).toBe('17:00')
  })

  it('should parse "morning standup"', () => {
    const result = parseTimeFromText('morning standup', '10:00')
    expect(result.startTime).toBe('09:00')
  })

  it('should parse "evening workout"', () => {
    const result = parseTimeFromText('evening workout', '20:00')
    expect(result.startTime).toBe('18:00')
  })
})
