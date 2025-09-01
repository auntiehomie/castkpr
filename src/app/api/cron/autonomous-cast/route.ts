// src/app/api/cron/autonomous-cast/route.ts
// This endpoint is designed to be called by external cron services
import { NextRequest, NextResponse } from 'next/server'
import { AutonomousCastScheduler } from '@/lib/autonomous-scheduler'

export async function GET(request: NextRequest) {
  try {
    console.log('⏰ Cron job triggered for autonomous casting')
    
    // Verify the request is from a legitimate cron service
    const cronSecret = request.nextUrl.searchParams.get('secret')
    const expectedSecret = process.env.AUTONOMOUS_CAST_SECRET
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      console.log('❌ Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if it's a good time to post
    const isGoodTime = AutonomousCastScheduler.isGoodTimeToPost()
    if (!isGoodTime) {
      console.log('⏱️ Not an optimal time to post, skipping')
      return NextResponse.json({ 
        success: true, 
        message: 'Skipped - not optimal posting time',
        nextOptimalTime: 'Check scheduling algorithm'
      })
    }
    
    // Check rate limiting (don't post too frequently)
    // Note: In a real system, you'd store the last post time in a database
    // For now, we'll rely on the cron schedule to manage frequency
    
    // Trigger the autonomous cast
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/autonomous-cast`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${expectedSecret}`,
        'Content-Type': 'application/json',
      },
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log('✅ Autonomous cast posted via cron:', result.cast)
      return NextResponse.json({
        success: true,
        message: 'Autonomous cast posted successfully',
        cast: result.cast,
        triggeredAt: new Date().toISOString()
      })
    } else {
      console.log('❌ Autonomous cast failed via cron:', result.message)
      return NextResponse.json({
        success: false,
        message: result.message || 'Failed to generate cast',
        triggeredAt: new Date().toISOString()
      })
    }
    
  } catch (error) {
    console.error('💥 Cron autonomous cast error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST method for backward compatibility
export async function POST(request: NextRequest) {
  return GET(request)
}
