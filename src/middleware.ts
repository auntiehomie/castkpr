import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Create response
  const response = NextResponse.next()
  
  // Remove any existing X-Frame-Options header
  response.headers.delete('X-Frame-Options')
  
  // Don't set X-Frame-Options at all to allow all embedding
  // OR alternatively, try setting it to allow from specific origins
  // response.headers.set('X-Frame-Options', 'ALLOW-FROM https://warpcast.com')
  
  // Use Content Security Policy instead for more flexible frame control
  response.headers.set('Content-Security-Policy', 
    "frame-ancestors 'self' https://*.farcaster.xyz https://warpcast.com https://*.vercel.app"
  )
  
  // Add debug header to confirm middleware is running
  response.headers.set('X-Middleware-Applied', 'castkpr-' + Date.now())
  
  return response
}

// Apply middleware to all routes
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
