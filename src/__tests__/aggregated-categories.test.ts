import {
  TimeCategory,
  AggregatedCategory,
  ENERGY_VIEW,
  AGGREGATED_CATEGORY_LABELS,
  AGGREGATED_CATEGORY_COLORS,
  getAggregatedCategory,
  aggregateByView,
  CATEGORY_LABELS,
  INTENTION_CATEGORY_MAP,
  IntentionType,
} from '@/lib/types'

describe('ENERGY_VIEW configuration', () => {
  it('has all 6 aggregated categories', () => {
    const expectedCategories: AggregatedCategory[] = [
      'focus',
      'ops',
      'body',
      'recovery',
      'connection',
      'escape',
    ]

    expectedCategories.forEach(cat => {
      expect(ENERGY_VIEW[cat]).toBeDefined()
      expect(ENERGY_VIEW[cat].label).toBeTruthy()
      expect(ENERGY_VIEW[cat].color).toBeTruthy()
      expect(ENERGY_VIEW[cat].categories).toBeInstanceOf(Array)
      expect(ENERGY_VIEW[cat].categories.length).toBeGreaterThan(0)
    })
  })

  it('maps focus to deep_work, learning, creating', () => {
    expect(ENERGY_VIEW.focus.categories).toContain('deep_work')
    expect(ENERGY_VIEW.focus.categories).toContain('learning')
    expect(ENERGY_VIEW.focus.categories).toContain('creating')
    expect(ENERGY_VIEW.focus.label).toBe('Focus')
  })

  it('maps ops to shallow_work, meetings, admin, errands, chores, commute', () => {
    expect(ENERGY_VIEW.ops.categories).toContain('shallow_work')
    expect(ENERGY_VIEW.ops.categories).toContain('meetings')
    expect(ENERGY_VIEW.ops.categories).toContain('admin')
    expect(ENERGY_VIEW.ops.categories).toContain('errands')
    expect(ENERGY_VIEW.ops.categories).toContain('chores')
    expect(ENERGY_VIEW.ops.categories).toContain('commute')
    expect(ENERGY_VIEW.ops.label).toBe('Ops')
  })

  it('maps body to exercise, movement, meals, sleep', () => {
    expect(ENERGY_VIEW.body.categories).toContain('exercise')
    expect(ENERGY_VIEW.body.categories).toContain('movement')
    expect(ENERGY_VIEW.body.categories).toContain('meals')
    expect(ENERGY_VIEW.body.categories).toContain('sleep')
    expect(ENERGY_VIEW.body.label).toBe('Body')
  })

  it('maps recovery to rest, self_care', () => {
    expect(ENERGY_VIEW.recovery.categories).toContain('rest')
    expect(ENERGY_VIEW.recovery.categories).toContain('self_care')
    expect(ENERGY_VIEW.recovery.label).toBe('Recovery')
  })

  it('maps connection to social, calls', () => {
    expect(ENERGY_VIEW.connection.categories).toContain('social')
    expect(ENERGY_VIEW.connection.categories).toContain('calls')
    expect(ENERGY_VIEW.connection.label).toBe('Connection')
  })

  it('maps escape to entertainment, other', () => {
    expect(ENERGY_VIEW.escape.categories).toContain('entertainment')
    expect(ENERGY_VIEW.escape.categories).toContain('other')
    expect(ENERGY_VIEW.escape.label).toBe('Escape')
  })

  it('covers all 19 granular categories exactly once', () => {
    const allCategories = Object.keys(CATEGORY_LABELS) as TimeCategory[]
    const mappedCategories: TimeCategory[] = []

    for (const group of Object.values(ENERGY_VIEW)) {
      mappedCategories.push(...group.categories)
    }

    // Check each granular category is mapped
    allCategories.forEach(cat => {
      expect(mappedCategories).toContain(cat)
    })

    // Check no duplicates
    const uniqueCategories = new Set(mappedCategories)
    expect(uniqueCategories.size).toBe(mappedCategories.length)

    // Check total count
    expect(mappedCategories.length).toBe(allCategories.length)
  })
})

describe('AGGREGATED_CATEGORY_LABELS', () => {
  it('has labels for all 6 categories', () => {
    expect(AGGREGATED_CATEGORY_LABELS.focus).toBe('Focus')
    expect(AGGREGATED_CATEGORY_LABELS.ops).toBe('Ops')
    expect(AGGREGATED_CATEGORY_LABELS.body).toBe('Body')
    expect(AGGREGATED_CATEGORY_LABELS.recovery).toBe('Recovery')
    expect(AGGREGATED_CATEGORY_LABELS.connection).toBe('Connection')
    expect(AGGREGATED_CATEGORY_LABELS.escape).toBe('Escape')
  })
})

describe('AGGREGATED_CATEGORY_COLORS', () => {
  it('has colors for all 6 categories', () => {
    const categories: AggregatedCategory[] = ['focus', 'ops', 'body', 'recovery', 'connection', 'escape']

    categories.forEach(cat => {
      expect(AGGREGATED_CATEGORY_COLORS[cat]).toMatch(/^bg-/)
    })
  })

  it('uses distinct colors for each category', () => {
    expect(AGGREGATED_CATEGORY_COLORS.focus).toBe('bg-blue-500')
    expect(AGGREGATED_CATEGORY_COLORS.ops).toBe('bg-slate-500')
    expect(AGGREGATED_CATEGORY_COLORS.body).toBe('bg-green-500')
    expect(AGGREGATED_CATEGORY_COLORS.recovery).toBe('bg-amber-500')
    expect(AGGREGATED_CATEGORY_COLORS.connection).toBe('bg-pink-500')
    expect(AGGREGATED_CATEGORY_COLORS.escape).toBe('bg-zinc-500')
  })
})

describe('getAggregatedCategory', () => {
  it('returns focus for deep_work', () => {
    expect(getAggregatedCategory('deep_work')).toBe('focus')
  })

  it('returns focus for learning', () => {
    expect(getAggregatedCategory('learning')).toBe('focus')
  })

  it('returns focus for creating', () => {
    expect(getAggregatedCategory('creating')).toBe('focus')
  })

  it('returns ops for shallow_work', () => {
    expect(getAggregatedCategory('shallow_work')).toBe('ops')
  })

  it('returns ops for meetings', () => {
    expect(getAggregatedCategory('meetings')).toBe('ops')
  })

  it('returns ops for admin', () => {
    expect(getAggregatedCategory('admin')).toBe('ops')
  })

  it('returns ops for errands', () => {
    expect(getAggregatedCategory('errands')).toBe('ops')
  })

  it('returns ops for chores', () => {
    expect(getAggregatedCategory('chores')).toBe('ops')
  })

  it('returns ops for commute', () => {
    expect(getAggregatedCategory('commute')).toBe('ops')
  })

  it('returns body for exercise', () => {
    expect(getAggregatedCategory('exercise')).toBe('body')
  })

  it('returns body for movement', () => {
    expect(getAggregatedCategory('movement')).toBe('body')
  })

  it('returns body for meals', () => {
    expect(getAggregatedCategory('meals')).toBe('body')
  })

  it('returns body for sleep', () => {
    expect(getAggregatedCategory('sleep')).toBe('body')
  })

  it('returns recovery for rest', () => {
    expect(getAggregatedCategory('rest')).toBe('recovery')
  })

  it('returns recovery for self_care', () => {
    expect(getAggregatedCategory('self_care')).toBe('recovery')
  })

  it('returns connection for social', () => {
    expect(getAggregatedCategory('social')).toBe('connection')
  })

  it('returns connection for calls', () => {
    expect(getAggregatedCategory('calls')).toBe('connection')
  })

  it('returns escape for entertainment', () => {
    expect(getAggregatedCategory('entertainment')).toBe('escape')
  })

  it('returns escape for other', () => {
    expect(getAggregatedCategory('other')).toBe('escape')
  })
})

describe('aggregateByView', () => {
  it('aggregates empty map correctly', () => {
    const categoryMinutes = new Map<TimeCategory, number>()
    const result = aggregateByView(categoryMinutes)

    expect(result.size).toBe(0)
  })

  it('aggregates single category correctly', () => {
    const categoryMinutes = new Map<TimeCategory, number>([['deep_work', 120]])
    const result = aggregateByView(categoryMinutes)

    expect(result.get('focus')).toBe(120)
    expect(result.size).toBe(1)
  })

  it('aggregates multiple categories in same group', () => {
    const categoryMinutes = new Map<TimeCategory, number>([
      ['deep_work', 120],
      ['learning', 60],
      ['creating', 30],
    ])
    const result = aggregateByView(categoryMinutes)

    expect(result.get('focus')).toBe(210) // 120 + 60 + 30
    expect(result.size).toBe(1)
  })

  it('aggregates categories across different groups', () => {
    const categoryMinutes = new Map<TimeCategory, number>([
      ['deep_work', 120],
      ['exercise', 60],
      ['social', 90],
      ['entertainment', 30],
    ])
    const result = aggregateByView(categoryMinutes)

    expect(result.get('focus')).toBe(120)
    expect(result.get('body')).toBe(60)
    expect(result.get('connection')).toBe(90)
    expect(result.get('escape')).toBe(30)
    expect(result.size).toBe(4)
  })

  it('aggregates all ops categories correctly', () => {
    const categoryMinutes = new Map<TimeCategory, number>([
      ['shallow_work', 30],
      ['meetings', 60],
      ['admin', 20],
      ['errands', 45],
      ['chores', 30],
      ['commute', 25],
    ])
    const result = aggregateByView(categoryMinutes)

    expect(result.get('ops')).toBe(210) // 30 + 60 + 20 + 45 + 30 + 25
  })

  it('aggregates all body categories correctly', () => {
    const categoryMinutes = new Map<TimeCategory, number>([
      ['exercise', 60],
      ['movement', 30],
      ['meals', 45],
      ['sleep', 480],
    ])
    const result = aggregateByView(categoryMinutes)

    expect(result.get('body')).toBe(615) // 60 + 30 + 45 + 480
  })

  it('does not include categories with 0 minutes', () => {
    const categoryMinutes = new Map<TimeCategory, number>([
      ['deep_work', 120],
      ['entertainment', 0],
    ])
    const result = aggregateByView(categoryMinutes)

    expect(result.get('focus')).toBe(120)
    expect(result.has('escape')).toBe(false)
  })

  it('handles a realistic day scenario', () => {
    const categoryMinutes = new Map<TimeCategory, number>([
      ['deep_work', 180],      // Focus: 3 hours
      ['shallow_work', 60],    // Ops
      ['meetings', 120],       // Ops
      ['learning', 60],        // Focus
      ['exercise', 45],        // Body
      ['meals', 90],           // Body
      ['rest', 30],            // Recovery
      ['social', 60],          // Connection
      ['entertainment', 120],  // Escape
    ])
    const result = aggregateByView(categoryMinutes)

    expect(result.get('focus')).toBe(240)       // 180 + 60
    expect(result.get('ops')).toBe(180)         // 60 + 120
    expect(result.get('body')).toBe(135)        // 45 + 90
    expect(result.get('recovery')).toBe(30)
    expect(result.get('connection')).toBe(60)
    expect(result.get('escape')).toBe(120)
  })
})

describe('INTENTION_CATEGORY_MAP integration with aggregated categories', () => {
  it('deep_work intention maps to focus category', () => {
    const categories = INTENTION_CATEGORY_MAP.deep_work
    categories.forEach(cat => {
      expect(getAggregatedCategory(cat)).toBe('focus')
    })
  })

  it('less_distraction intention maps to escape category', () => {
    const categories = INTENTION_CATEGORY_MAP.less_distraction
    categories.forEach(cat => {
      expect(getAggregatedCategory(cat)).toBe('escape')
    })
  })

  it('exercise intention maps to body category', () => {
    const categories = INTENTION_CATEGORY_MAP.exercise
    categories.forEach(cat => {
      expect(getAggregatedCategory(cat)).toBe('body')
    })
  })

  it('relationships intention maps to connection category', () => {
    const categories = INTENTION_CATEGORY_MAP.relationships
    categories.forEach(cat => {
      expect(getAggregatedCategory(cat)).toBe('connection')
    })
  })

  it('self_care intention maps to recovery or body categories', () => {
    const categories = INTENTION_CATEGORY_MAP.self_care
    const validAggCategories = ['recovery', 'body']
    categories.forEach(cat => {
      expect(validAggCategories).toContain(getAggregatedCategory(cat))
    })
  })

  it('learning intention maps to focus category', () => {
    const categories = INTENTION_CATEGORY_MAP.learning
    categories.forEach(cat => {
      expect(getAggregatedCategory(cat)).toBe('focus')
    })
  })

  it('work_life_balance intention maps to multiple categories', () => {
    const categories = INTENTION_CATEGORY_MAP.work_life_balance
    const aggCategories = new Set(categories.map(cat => getAggregatedCategory(cat)))

    // Should include recovery and connection at minimum
    expect(aggCategories.has('recovery')).toBe(true)
    expect(aggCategories.has('connection')).toBe(true)
  })
})

describe('TimeCategory type coverage', () => {
  const allCategories: TimeCategory[] = [
    // Productive
    'deep_work',
    'shallow_work',
    'meetings',
    'learning',
    'creating',
    // Maintenance
    'admin',
    'errands',
    'chores',
    'commute',
    // Body
    'exercise',
    'movement',
    'meals',
    'sleep',
    // Mind
    'rest',
    'self_care',
    // Connection
    'social',
    'calls',
    // Leisure
    'entertainment',
    // Fallback
    'other',
  ]

  it('has 19 total categories', () => {
    expect(allCategories.length).toBe(19)
  })

  it('all categories have labels', () => {
    allCategories.forEach(cat => {
      expect(CATEGORY_LABELS[cat]).toBeTruthy()
    })
  })

  it('all categories map to an aggregated category', () => {
    allCategories.forEach(cat => {
      const aggCat = getAggregatedCategory(cat)
      expect(['focus', 'ops', 'body', 'recovery', 'connection', 'escape']).toContain(aggCat)
    })
  })
})
