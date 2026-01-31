import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url)
  const method = request.method

  // Set CSRF token cookie on all GET requests to non-API paths
  if (method === 'GET' && !pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    
    // Generate CSRF token if not present
    const existingToken = request.cookies.get('csrf-token')?.value
    if (!existingToken) {
      const csrfToken = crypto.randomUUID()
      response.cookies.set('csrf-token', csrfToken, {
        httpOnly: false, // Client needs to read this for API calls
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      })
    }
    
    return response
  }

  // Check CSRF token on mutating API requests (excluding NextAuth routes)
  if ((method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') && 
      pathname.startsWith('/api/') && 
      !pathname.startsWith('/api/auth/')) {
    
    const cookieToken = request.cookies.get('csrf-token')?.value
    const headerToken = request.headers.get('x-csrf-token')
    
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}