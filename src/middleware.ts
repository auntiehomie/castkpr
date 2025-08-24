import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Create response
  const response = NextResponse.next()
  
  // Aggressively remove X-Frame-Options header
  response.headers.delete('X-Frame-Options')
  response.headers.delete('x-frame-options')
  
  // Explicitly set X-Frame-Options to ALLOWALL to override any platform defaults
  response.headers.set('X-Frame-Options', 'ALLOWALL')
  
  // Use Content Security Policy for modern browsers
  response.headers.set('Content-Security-Policy', 
    "frame-ancestors *; default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:"
  )
  
  // Add debug headers to confirm middleware is running and what we're setting
  response.headers.set('X-Middleware-Applied', 'castkpr-' + Date.now())
  response.headers.set('X-Frame-Debug', 'attempting-allowall')
  
  return response
}

// Apply middleware to all routes
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
