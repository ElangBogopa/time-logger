/**
 * Tests for /api/auth/check-email API route
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

// Mock dependencies BEFORE importing the route
jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  getRateLimitHeaders: jest.fn(),
  RATE_LIMITS: {
    auth: { limit: 5, windowMs: 60 * 1000 },
  },
}))

import { POST } from '@/app/api/auth/check-email/route'
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

const mockSupabase = supabase as any
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>
const mockGetRateLimitHeaders = getRateLimitHeaders as jest.MockedFunction<typeof getRateLimitHeaders>

describe('/api/auth/check-email', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default to rate limit success
    mockCheckRateLimit.mockReturnValue({
      success: true,
      remaining: 4,
      resetTime: Date.now() + 60000,
    })
    
    mockGetRateLimitHeaders.mockReturnValue({
      'X-RateLimit-Remaining': '4',
      'X-RateLimit-Reset': Math.ceil((Date.now() + 60000) / 1000).toString(),
    })
    
    // Reset supabase mock
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })
  })

  describe('Rate Limiting', () => {
    it('returns 429 when rate limited', async () => {
      mockCheckRateLimit.mockReturnValue({
        success: false,
        remaining: 0,
        resetTime: Date.now() + 30000,
      })
      
      mockGetRateLimitHeaders.mockReturnValue({
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil((Date.now() + 30000) / 1000).toString(),
      })
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.100' },
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error).toBe('Too many attempts. Please try again later.')
      
      // Verify rate limiting was checked with IP
      expect(mockCheckRateLimit).toHaveBeenCalledWith('check-email:192.168.1.100', { limit: 5, windowMs: 60000 })
    })

    it('uses "unknown" IP when x-forwarded-for header is missing', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      })
      
      await POST(req)
      
      expect(mockCheckRateLimit).toHaveBeenCalledWith('check-email:unknown', { limit: 5, windowMs: 60000 })
    })
  })

  describe('Input Validation', () => {
    it('returns 400 for missing email', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Email is required')
    })

    it('returns 400 for null email', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: null,
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Email is required')
    })

    it('returns 400 for empty string email', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: '',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Email is required')
    })
  })

  describe('Unknown Email', () => {
    it('returns correct response for unknown email', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'unknown@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        exists: false,
        hasPassword: false,
        authProvider: null,
        preferredName: null,
      })
      
      // Verify email was normalized
      expect(mockQuery.eq).toHaveBeenCalledWith('email', 'unknown@example.com')
    })

    it('normalizes email to lowercase and trims whitespace', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: '  UNKNOWN@EXAMPLE.COM  ',
        }),
      })
      
      await POST(req)
      
      // Verify email was normalized before the database query
      expect(mockQuery.eq).toHaveBeenCalledWith('email', 'unknown@example.com')
    })
  })

  describe('Email User (with password)', () => {
    it('returns correct response for email user', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'email-user-123',
            auth_provider: 'email',
            password_hash: 'hashed-password',
            preferred_name: 'Email User',
          },
          error: null,
        }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'emailuser@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        exists: true,
        hasPassword: true,
        authProvider: 'email',
        preferredName: 'Email User',
      })
    })

    it('returns correct response for "both" auth provider (email + google)', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'both-user-123',
            auth_provider: 'both',
            password_hash: 'hashed-password',
            preferred_name: 'Both User',
          },
          error: null,
        }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'bothuser@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        exists: true,
        hasPassword: true,
        authProvider: 'both',
        preferredName: 'Both User',
      })
    })
  })

  describe('Google User (no password)', () => {
    it('returns correct response for Google user', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'google-user-123',
            auth_provider: 'google',
            password_hash: null,
            preferred_name: 'Google User',
          },
          error: null,
        }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'googleuser@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        exists: true,
        hasPassword: false,
        authProvider: 'google',
        preferredName: 'Google User',
      })
    })

    it('handles user with empty string password_hash as no password', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            auth_provider: 'google',
            password_hash: '',
            preferred_name: 'User',
          },
          error: null,
        }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.hasPassword).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('handles supabase errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Something went wrong')
    })

    it('handles JSON parsing error gracefully', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Something went wrong')
    })
  })

  describe('Specific User Scenarios', () => {
    it('handles user with no preferred_name', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            auth_provider: 'email',
            password_hash: 'hash',
            preferred_name: null,
          },
          error: null,
        }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'noname@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        exists: true,
        hasPassword: true,
        authProvider: 'email',
        preferredName: null,
      })
    })

    it('handles user with empty string preferred_name', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-123',
            auth_provider: 'email',
            password_hash: 'hash',
            preferred_name: '',
          },
          error: null,
        }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)
      
      const req = new NextRequest('http://localhost:3000/api/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({
          email: 'emptyname@example.com',
        }),
      })
      
      const res = await POST(req)
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        exists: true,
        hasPassword: true,
        authProvider: 'email',
        preferredName: '',
      })
    })
  })
})