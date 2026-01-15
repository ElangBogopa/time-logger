/**
 * Simple in-memory rate limiter for API routes
 * Designed for serverless environments - no background intervals
 * In production at scale, consider using Redis or a distributed cache
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// Track last cleanup time to avoid cleaning on every request
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60 * 1000 // Clean up every minute

/**
 * Clean up expired entries inline (called during rate limit checks)
 * This avoids memory leaks from setInterval in serverless environments
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()

  // Only clean up once per minute to avoid performance overhead
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }

  lastCleanup = now

  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}

interface RateLimitConfig {
  limit: number      // Max requests allowed
  windowMs: number   // Time window in milliseconds
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

/**
 * Check if a request should be rate limited
 * @param key - Unique identifier (e.g., user ID or IP)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and remaining quota
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  // Clean up expired entries periodically (inline, no background interval)
  cleanupExpiredEntries()

  const now = Date.now()
  const entry = rateLimitMap.get(key)

  // If no entry exists or window has expired, create new entry
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    rateLimitMap.set(key, newEntry)
    return {
      success: true,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime,
    }
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  // Increment count
  entry.count++
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  }
}

// Pre-configured rate limiters for different endpoints
export const RATE_LIMITS = {
  // AI endpoints - more restrictive (10 requests per minute)
  ai: { limit: 10, windowMs: 60 * 1000 },
  // Calendar API - moderate (30 requests per minute)
  calendar: { limit: 30, windowMs: 60 * 1000 },
  // General API - permissive (100 requests per minute)
  general: { limit: 100, windowMs: 60 * 1000 },
}

/**
 * Create rate limit headers for the response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  }
}
