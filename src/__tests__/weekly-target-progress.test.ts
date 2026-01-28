/**
 * Tests for calculateTargetProgress and getTargetFeedback
 */

import { calculateTargetProgress, getTargetFeedback } from '@/lib/types'

describe('calculateTargetProgress', () => {
  describe('at_least direction', () => {
    it('returns 0 when no progress', () => {
      expect(calculateTargetProgress(0, 900, 'at_least')).toBe(0)
    })

    it('returns 50 when halfway', () => {
      expect(calculateTargetProgress(450, 900, 'at_least')).toBe(50)
    })

    it('returns 100 when target met exactly', () => {
      expect(calculateTargetProgress(900, 900, 'at_least')).toBe(100)
    })

    it('caps at 100 when over target', () => {
      expect(calculateTargetProgress(1200, 900, 'at_least')).toBe(100)
    })

    it('rounds to nearest integer', () => {
      expect(calculateTargetProgress(100, 300, 'at_least')).toBe(33)
    })

    it('handles target of 0 (returns 0)', () => {
      expect(calculateTargetProgress(100, 0, 'at_least')).toBe(0)
    })
  })

  describe('at_most direction', () => {
    it('returns 100 when no usage', () => {
      expect(calculateTargetProgress(0, 600, 'at_most')).toBe(100)
    })

    it('returns 100 when under limit', () => {
      expect(calculateTargetProgress(300, 600, 'at_most')).toBe(100)
    })

    it('returns 100 when exactly at limit', () => {
      expect(calculateTargetProgress(600, 600, 'at_most')).toBe(100)
    })

    it('returns decreasing value when over limit', () => {
      // 1.5x over → 100 - 50 = 50%
      expect(calculateTargetProgress(900, 600, 'at_most')).toBe(50)
    })

    it('returns 0 when 2x over limit', () => {
      // 2x over → 100 - 100 = 0%
      expect(calculateTargetProgress(1200, 600, 'at_most')).toBe(0)
    })

    it('does not go below 0', () => {
      // 3x over → max(0, 100 - 200) = 0
      expect(calculateTargetProgress(1800, 600, 'at_most')).toBe(0)
    })

    it('handles target of 0 (returns 100)', () => {
      expect(calculateTargetProgress(0, 0, 'at_most')).toBe(100)
    })
  })
})

describe('getTargetFeedback', () => {
  describe('at_least direction', () => {
    it('returns success when target reached', () => {
      const result = getTargetFeedback(900, 900, 'at_least')
      expect(result.tone).toBe('success')
      expect(result.message).toBe('Target reached!')
    })

    it('returns success when over target', () => {
      const result = getTargetFeedback(1200, 900, 'at_least')
      expect(result.tone).toBe('success')
      expect(result.message).toBe('Target reached!')
    })

    it('returns neutral when almost there (75-99%)', () => {
      const result = getTargetFeedback(700, 900, 'at_least')
      expect(result.tone).toBe('neutral')
      expect(result.message).toBe('Almost there')
    })

    it('returns neutral when halfway (50-74%)', () => {
      const result = getTargetFeedback(500, 900, 'at_least')
      expect(result.tone).toBe('neutral')
      expect(result.message).toBe('Halfway')
    })

    it('returns warning when getting started (25-49%)', () => {
      const result = getTargetFeedback(300, 900, 'at_least')
      expect(result.tone).toBe('warning')
      expect(result.message).toBe('Getting started')
    })

    it('returns danger when needs attention (<25%)', () => {
      const result = getTargetFeedback(100, 900, 'at_least')
      expect(result.tone).toBe('danger')
      expect(result.message).toBe('Needs attention')
    })
  })

  describe('at_most direction', () => {
    it('returns success with no usage', () => {
      const result = getTargetFeedback(0, 600, 'at_most')
      expect(result.tone).toBe('success')
      expect(result.message).toBe('Perfect!')
    })

    it('returns success when well under limit (<50%)', () => {
      const result = getTargetFeedback(200, 600, 'at_most')
      expect(result.tone).toBe('success')
      expect(result.message).toBe('Great restraint')
    })

    it('returns neutral when within limit (50-100%)', () => {
      const result = getTargetFeedback(500, 600, 'at_most')
      expect(result.tone).toBe('neutral')
      expect(result.message).toBe('Within limit')
    })

    it('returns warning when slightly over (100-150%)', () => {
      const result = getTargetFeedback(800, 600, 'at_most')
      expect(result.tone).toBe('warning')
      expect(result.message).toBe('Slightly over')
    })

    it('returns danger when well over limit (>150%)', () => {
      const result = getTargetFeedback(1000, 600, 'at_most')
      expect(result.tone).toBe('danger')
      expect(result.message).toBe('Over limit')
    })
  })
})
