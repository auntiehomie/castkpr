import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Create response
  const response = NextResponse.next()
  
  // Remove any X-Frame-Options header to allow embedding in Mini Apps
  response.headers.delete('X-Frame-Options')
  
  // Add debug header to confirm middleware is running
  response.headers.set('X-Middleware-Applied', 'true')
  
  return response
}

// Apply middleware to all routes
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
