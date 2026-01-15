/**
 * Tests for intentions validation logic
 */

// Validation functions extracted from the route
function validateIntentions(intentions: unknown): { valid: boolean; error?: string } {
  if (!intentions || !Array.isArray(intentions) || intentions.length === 0) {
    return { valid: false, error: 'At least one intention is required' }
  }

  if (intentions.length > 3) {
    return { valid: false, error: 'Maximum 3 intentions allowed' }
  }

  return { valid: true }
}

describe('Intentions Validation', () => {
  describe('validateIntentions', () => {
    it('rejects null intentions', () => {
      const result = validateIntentions(null)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('At least one intention is required')
    })

    it('rejects undefined intentions', () => {
      const result = validateIntentions(undefined)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('At least one intention is required')
    })

    it('rejects non-array intentions', () => {
      const result = validateIntentions({ intention_type: 'deep_work' })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('At least one intention is required')
    })

    it('rejects empty array', () => {
      const result = validateIntentions([])
      expect(result.valid).toBe(false)
      expect(result.error).toBe('At least one intention is required')
    })

    it('rejects more than 3 intentions', () => {
      const result = validateIntentions([
        { intention_type: 'deep_work', priority: 1 },
        { intention_type: 'exercise', priority: 2 },
        { intention_type: 'learning', priority: 3 },
        { intention_type: 'self_care', priority: 4 },
      ])
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Maximum 3 intentions allowed')
    })

    it('accepts 1 intention', () => {
      const result = validateIntentions([
        { intention_type: 'deep_work', priority: 1 },
      ])
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('accepts 2 intentions', () => {
      const result = validateIntentions([
        { intention_type: 'deep_work', priority: 1 },
        { intention_type: 'exercise', priority: 2 },
      ])
      expect(result.valid).toBe(true)
    })

    it('accepts 3 intentions (maximum)', () => {
      const result = validateIntentions([
        { intention_type: 'deep_work', priority: 1 },
        { intention_type: 'exercise', priority: 2 },
        { intention_type: 'learning', priority: 3 },
      ])
      expect(result.valid).toBe(true)
    })
  })
})

describe('Intentions Data Transformation', () => {
  it('prepares intentions for insert with defaults', () => {
    const userId = 'user-123'
    const intentions = [
      { intention_type: 'deep_work' as const, custom_text: null, weekly_target_minutes: null, priority: 1 },
      { intention_type: 'exercise' as const, custom_text: null, weekly_target_minutes: 300, priority: 2 },
      { intention_type: 'custom' as const, custom_text: 'Read more', weekly_target_minutes: null, priority: 3 },
    ]

    const transformed = intentions.map((intention, index) => ({
      user_id: userId,
      intention_type: intention.intention_type,
      custom_text: intention.intention_type === 'custom' ? intention.custom_text : null,
      weekly_target_minutes: intention.weekly_target_minutes || null,
      priority: intention.priority || index + 1,
      active: true,
    }))

    expect(transformed).toHaveLength(3)

    // First intention
    expect(transformed[0].user_id).toBe('user-123')
    expect(transformed[0].intention_type).toBe('deep_work')
    expect(transformed[0].custom_text).toBeNull() // Not custom, so null
    expect(transformed[0].active).toBe(true)

    // Second intention with weekly target
    expect(transformed[1].weekly_target_minutes).toBe(300)

    // Third intention (custom with custom_text)
    expect(transformed[2].intention_type).toBe('custom')
    expect(transformed[2].custom_text).toBe('Read more')
  })

  it('ignores custom_text for non-custom intentions', () => {
    const userId = 'user-123'
    const intentions = [
      { intention_type: 'deep_work' as const, custom_text: 'Should be ignored', priority: 1 },
    ]

    const transformed = intentions.map((intention) => ({
      user_id: userId,
      intention_type: intention.intention_type,
      custom_text: intention.intention_type === 'custom' ? intention.custom_text : null,
      priority: intention.priority,
      active: true,
    }))

    expect(transformed[0].custom_text).toBeNull()
  })
})
