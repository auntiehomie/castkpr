import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Create response
  const response = NextResponse.next()
  
  // Remove X-Frame-Options completely to allow iframe embedding
  response.headers.delete('X-Frame-Options')
  response.headers.delete('x-frame-options')
  
  // Don't set any X-Frame-Options header at all
  
  // Add debug header to confirm middleware is running
  response.headers.set('X-Middleware-Applied', 'castkpr-no-frame-options-' + Date.now())
  
  return response
}

// Apply middleware to all routes
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
