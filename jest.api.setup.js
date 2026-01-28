// Setup for API route tests
// Mock fetch and Web APIs using Node.js built-ins

// Use Node.js 18+ built-in fetch
global.fetch = global.fetch || require('node-fetch')

// Mock Request and Response using a simplified implementation for testing
global.Request = global.Request || class MockRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Map()
    this.body = options.body || null
    
    // Set headers from options
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value)
      })
    }
  }
  
  async json() {
    return this.body ? JSON.parse(this.body) : {}
  }
}

global.Response = global.Response || class MockResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.headers = new Map()
    
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value)
      })
    }
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
  }
  
  static json(data, init = {}) {
    return new MockResponse(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {})
      }
    })
  }
}

// Mock URL for URL parsing
global.URL = global.URL || require('url').URL

// TextEncoder/TextDecoder
global.TextEncoder = global.TextEncoder || require('util').TextEncoder
global.TextDecoder = global.TextDecoder || require('util').TextDecoder