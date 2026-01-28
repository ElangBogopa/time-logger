/**
 * Tests for weekly targets validation logic
 */

import { WEEKLY_TARGET_CONFIGS, MAX_WEEKLY_TARGETS, WeeklyTargetType } from '@/lib/types'

// Validation functions extracted from the route
function validateTargets(targets: unknown): { valid: boolean; error?: string } {
  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    return { valid: false, error: 'At least one target is required' }
  }

  if (targets.length > MAX_WEEKLY_TARGETS) {
    return { valid: false, error: `Maximum ${MAX_WEEKLY_TARGETS} targets allowed` }
  }

  const validTypes = Object.keys(WEEKLY_TARGET_CONFIGS) as WeeklyTargetType[]
  for (const t of targets) {
    if (!validTypes.includes(t.target_type)) {
      return { valid: false, error: `Invalid target type: ${t.target_type}` }
    }
    if (!t.weekly_target_minutes || t.weekly_target_minutes <= 0) {
      return { valid: false, error: `Invalid target minutes for ${t.target_type}` }
    }
  }

  return { valid: true }
}

describe('Targets Validation', () => {
  describe('validateTargets', () => {
    it('rejects null targets', () => {
      const result = validateTargets(null)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('At least one target is required')
    })

    it('rejects undefined targets', () => {
      const result = validateTargets(undefined)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('At least one target is required')
    })

    it('rejects non-array targets', () => {
      const result = validateTargets({ target_type: 'deep_focus' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('At least one target is required')
    })

    it('rejects empty array', () => {
      const result = validateTargets([])
      expect(result.valid).toBe(false)
      expect(result.error).toBe('At least one target is required')
    })

    it('rejects more than MAX_WEEKLY_TARGETS targets', () => {
      const targets = [
        { target_type: 'deep_focus', weekly_target_minutes: 900 },
        { target_type: 'exercise', weekly_target_minutes: 150 },
        { target_type: 'social_time', weekly_target_minutes: 600 },
        { target_type: 'recovery', weekly_target_minutes: 420 },
        { target_type: 'leisure', weekly_target_minutes: 600 },
        { target_type: 'meetings', weekly_target_minutes: 600 },
      ]
      const result = validateTargets(targets)
      expect(result.valid).toBe(false)
      expect(result.error).toBe(`Maximum ${MAX_WEEKLY_TARGETS} targets allowed`)
    })

    it('rejects invalid target type', () => {
      const result = validateTargets([
        { target_type: 'nonexistent', weekly_target_minutes: 100 },
      ])
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid target type: nonexistent')
    })

    it('rejects zero minutes', () => {
      const result = validateTargets([
        { target_type: 'deep_focus', weekly_target_minutes: 0 },
      ])
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid target minutes for deep_focus')
    })

    it('rejects negative minutes', () => {
      const result = validateTargets([
        { target_type: 'exercise', weekly_target_minutes: -100 },
      ])
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid target minutes for exercise')
    })

    it('accepts 1 valid target', () => {
      const result = validateTargets([
        { target_type: 'deep_focus', weekly_target_minutes: 900 },
      ])
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('accepts 3 valid targets', () => {
      const result = validateTargets([
        { target_type: 'deep_focus', weekly_target_minutes: 900 },
        { target_type: 'exercise', weekly_target_minutes: 150 },
        { target_type: 'social_time', weekly_target_minutes: 600 },
      ])
      expect(result.valid).toBe(true)
    })

    it('accepts 5 targets (maximum)', () => {
      const result = validateTargets([
        { target_type: 'deep_focus', weekly_target_minutes: 900 },
        { target_type: 'exercise', weekly_target_minutes: 150 },
        { target_type: 'social_time', weekly_target_minutes: 600 },
        { target_type: 'recovery', weekly_target_minutes: 420 },
        { target_type: 'leisure', weekly_target_minutes: 600 },
      ])
      expect(result.valid).toBe(true)
    })
  })
})

describe('Targets Data Transformation', () => {
  it('prepares targets for upsert with correct fields', () => {
    const userId = 'user-123'
    const targets = [
      { target_type: 'deep_focus' as WeeklyTargetType, weekly_target_minutes: 900 },
      { target_type: 'exercise' as WeeklyTargetType, weekly_target_minutes: 150 },
      { target_type: 'leisure' as WeeklyTargetType, weekly_target_minutes: 600 },
    ]

    const transformed = targets.map((t, index) => {
      const config = WEEKLY_TARGET_CONFIGS[t.target_type]
      return {
        user_id: userId,
        target_type: t.target_type,
        direction: config.direction,
        weekly_target_minutes: t.weekly_target_minutes,
        sort_order: index,
        active: true,
      }
    })

    expect(transformed).toHaveLength(3)

    // First target - deep_focus is at_least
    expect(transformed[0].user_id).toBe('user-123')
    expect(transformed[0].target_type).toBe('deep_focus')
    expect(transformed[0].direction).toBe('at_least')
    expect(transformed[0].weekly_target_minutes).toBe(900)
    expect(transformed[0].sort_order).toBe(0)
    expect(transformed[0].active).toBe(true)

    // Second target - exercise is at_least
    expect(transformed[1].direction).toBe('at_least')
    expect(transformed[1].weekly_target_minutes).toBe(150)

    // Third target - leisure is at_most
    expect(transformed[2].direction).toBe('at_most')
    expect(transformed[2].weekly_target_minutes).toBe(600)
  })

  it('assigns sort_order based on array index', () => {
    const targets = [
      { target_type: 'exercise' as WeeklyTargetType, weekly_target_minutes: 150 },
      { target_type: 'deep_focus' as WeeklyTargetType, weekly_target_minutes: 900 },
    ]

    const transformed = targets.map((t, index) => ({
      target_type: t.target_type,
      sort_order: index,
    }))

    expect(transformed[0].sort_order).toBe(0)
    expect(transformed[1].sort_order).toBe(1)
  })
})

describe('WEEKLY_TARGET_CONFIGS', () => {
  it('has exactly 6 target types', () => {
    expect(Object.keys(WEEKLY_TARGET_CONFIGS)).toHaveLength(6)
  })

  it('all at_least targets have correct direction', () => {
    const atLeastTypes: WeeklyTargetType[] = ['deep_focus', 'exercise', 'social_time', 'recovery']
    for (const type of atLeastTypes) {
      expect(WEEKLY_TARGET_CONFIGS[type].direction).toBe('at_least')
    }
  })

  it('all at_most targets have correct direction', () => {
    const atMostTypes: WeeklyTargetType[] = ['leisure', 'meetings']
    for (const type of atMostTypes) {
      expect(WEEKLY_TARGET_CONFIGS[type].direction).toBe('at_most')
    }
  })

  it('all configs have required fields', () => {
    for (const [, config] of Object.entries(WEEKLY_TARGET_CONFIGS)) {
      expect(config.label).toBeTruthy()
      expect(config.description).toBeTruthy()
      expect(config.direction).toMatch(/^(at_least|at_most)$/)
      expect(config.defaultMinutes).toBeGreaterThan(0)
      expect(config.minMinutes).toBeGreaterThanOrEqual(0)
      expect(config.maxMinutes).toBeGreaterThan(config.minMinutes)
      expect(config.categories.length).toBeGreaterThan(0)
      expect(config.color).toBeTruthy()
      expect(config.ringColor).toBeTruthy()
      expect(config.icon).toBeTruthy()
      expect(config.unit).toMatch(/^(hours|minutes)$/)
    }
  })

  it('MAX_WEEKLY_TARGETS is 5', () => {
    expect(MAX_WEEKLY_TARGETS).toBe(5)
  })
})
