/**
 * Tests for /api/entries API route
 */

// Mock dependencies BEFORE importing the route
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(url, options = {}) {
      this._url = new URL(url)
      this._options = options
    }
    
    get url() {
      return this._url.toString()
    }
    
    get method() {
      return this._options.method || 'GET'
    }
    
    get headers() {
      return {
        get: (name) => {
          return this._options.headers?.[name.toLowerCase()] || null
        }
      }
    }
    
    async json() {
      if (!this._options.body) return {}
      return typeof this._options.body === 'string' 
        ? JSON.parse(this._options.body) 
        : this._options.body
    }
  },
  NextResponse: class MockNextResponse {
    constructor(body, options = {}) {
      this.body = body
      this.status = options.status || 200
      this.headers = new Map()
      
      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          this.headers.set(key, value)
        })
      }
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }
    
    static json(data, init = {}) {
      return new this(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init.headers || {})
        }
      })
    }
  },
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}))

import { GET, POST } from '@/app/api/entries/route'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabase } from '@/lib/supabase-server'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockSupabase = supabase as any

describe('/api/entries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset the supabase mock chain
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })
  })

  describe('GET /api/entries', () => {
    it('returns 401 when no session', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const req = new NextRequest('http://localhost:3000/api/entries', { method: 'GET' })
      const res = await GET(req)
      
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 401 when session has no user ID', async () => {
      mockGetServerSession.mockResolvedValue({ user: {} } as any)
      
      const req = new NextRequest('http://localhost:3000/api/entries', { method: 'GET' })
      const res = await GET(req)
      
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns entries array when authenticated', async () => {
      const mockEntries = [
        { id: '1', user_id: 'user-123', activity: 'Deep Work', duration_minutes: 90 },
        { id: '2', user_id: 'user-123', activity: 'Exercise', duration_minutes: 60 },
      ]
      
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } } as any)
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockEntries, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/entries', { method: 'GET' })
      const res = await GET(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual(mockEntries)
      
      // Verify proper scoping to user
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123')
    })

    it('filters by date when date param provided', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } } as any)
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/entries?date=2025-01-28', { method: 'GET' })
      const res = await GET(req)
      
      expect(res.status).toBe(200)
      
      // Verify date filtering
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockQuery.eq).toHaveBeenCalledWith('date', '2025-01-28')
    })

    it('handles supabase errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } } as any)
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/entries', { method: 'GET' })
      const res = await GET(req)
      
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Failed to fetch entries')
    })
  })

  describe('POST /api/entries', () => {
    it('returns 401 when no session', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const req = new NextRequest('http://localhost:3000/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-28',
          activity: 'Deep Work',
          duration_minutes: 90,
        }),
      })
      const res = await POST(req)
      
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 400 when missing required fields', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } } as any)
      
      // Missing activity
      const req = new NextRequest('http://localhost:3000/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-28',
          duration_minutes: 90,
        }),
      })
      const res = await POST(req)
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Missing required fields: date, activity, duration_minutes')
    })

    it('returns 400 when missing date', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } } as any)
      
      const req = new NextRequest('http://localhost:3000/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          activity: 'Deep Work',
          duration_minutes: 90,
        }),
      })
      const res = await POST(req)
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Missing required fields: date, activity, duration_minutes')
    })

    it('returns 400 when missing duration_minutes', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } } as any)
      
      const req = new NextRequest('http://localhost:3000/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-28',
          activity: 'Deep Work',
        }),
      })
      const res = await POST(req)
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Missing required fields: date, activity, duration_minutes')
    })

    it('creates entry with valid data', async () => {
      const mockCreatedEntry = {
        id: 'new-entry-123',
        user_id: 'user-123',
        date: '2025-01-28',
        activity: 'Deep Work',
        duration_minutes: 90,
        status: 'confirmed',
      }
      
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } } as any)
      
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCreatedEntry, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-28',
          activity: 'Deep Work',
          duration_minutes: 90,
          category: 'work',
          description: 'Working on project',
        }),
      })
      const res = await POST(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual(mockCreatedEntry)
      
      // Verify entry was created with user ID
      expect(mockQuery.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        date: '2025-01-28',
        activity: 'Deep Work',
        category: 'work',
        duration_minutes: 90,
        start_time: null,
        end_time: null,
        description: 'Working on project',
        commentary: null,
        status: 'confirmed',
      })
    })

    it('scopes entry to authenticated user ID', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-456' } } as any)
      
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-28',
          activity: 'Exercise',
          duration_minutes: 60,
        }),
      })
      await POST(req)
      
      // Verify the user_id is set to the authenticated user, not anything from the request body
      expect(mockQuery.insert).toHaveBeenCalledWith({
        user_id: 'user-456',
        date: '2025-01-28',
        activity: 'Exercise',
        category: null,
        duration_minutes: 60,
        start_time: null,
        end_time: null,
        description: null,
        commentary: null,
        status: 'confirmed',
      })
    })

    it('handles supabase errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } } as any)
      
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-28',
          activity: 'Deep Work',
          duration_minutes: 90,
        }),
      })
      const res = await POST(req)
      
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Failed to create entry')
    })
  })
})