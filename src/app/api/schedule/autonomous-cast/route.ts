// src/app/api/schedule/autonomous-cast/route.ts
// Internal scheduler endpoint for autonomous casting
import { NextRequest, NextResponse } from 'next/server'
import { AutonomousCastScheduler } from '@/lib/autonomous-scheduler'

let lastPostTime: Date | null = null
let schedulerRunning = false

export async function POST(request: NextRequest) {
  try {
    console.log('🕐 Internal scheduler check triggered')
    
    // Prevent multiple scheduler instances
    if (schedulerRunning) {
      return NextResponse.json({ message: 'Scheduler already running' })
    }
    
    schedulerRunning = true
    
    try {
      // Check if enough time has passed since last post
      const minInterval = AutonomousCastScheduler.getRecommendedPostingInterval()
      const shouldPost = AutonomousCastScheduler.shouldPostBasedOnRecentActivity(lastPostTime, minInterval)
      
      if (!shouldPost) {
        console.log('⏱️ Too soon since last post, skipping')
        return NextResponse.json({ 
          success: true, 
          message: 'Skipped - too soon since last post',
          lastPostTime,
          minInterval: `${minInterval} hours`
        })
      }
      
      // Check if it's a good time to post
      const isGoodTime = AutonomousCastScheduler.isGoodTimeToPost()
      if (!isGoodTime) {
        console.log('⏰ Not an optimal time to post, skipping')
        return NextResponse.json({ 
          success: true, 
          message: 'Skipped - not optimal posting time',
          currentTime: new Date().toISOString()
        })
      }
      
      // Trigger autonomous cast
      const baseUrl = request.nextUrl.origin
      const response = await fetch(`${baseUrl}/api/autonomous-cast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AUTONOMOUS_CAST_SECRET}`,
          'Content-Type': 'application/json',
        },
      })
      
      const result = await response.json()
      
      if (result.success) {
        lastPostTime = new Date()
        console.log('✅ Autonomous cast posted successfully:', result.cast)
        
        return NextResponse.json({
          success: true,
          message: 'Autonomous cast posted successfully',
          cast: result.cast,
          postedAt: lastPostTime.toISOString(),
          nextPostAfter: new Date(lastPostTime.getTime() + (minInterval * 60 * 60 * 1000)).toISOString()
        })
      } else {
        console.log('❌ Autonomous cast failed:', result.message)
        return NextResponse.json({
          success: false,
          message: result.message || 'Failed to generate cast'
        })
      }
      
    } finally {
      schedulerRunning = false
    }
    
  } catch (error) {
    schedulerRunning = false
    console.error('💥 Scheduler error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET method to check scheduler status
export async function GET() {
  return NextResponse.json({
    message: 'CastKPR Internal Autonomous Cast Scheduler',
    status: {
      running: schedulerRunning,
      lastPostTime,
      recommendedInterval: `${AutonomousCastScheduler.getRecommendedPostingInterval()} hours`,
      isGoodTimeToPost: AutonomousCastScheduler.isGoodTimeToPost(),
      cronSchedule: AutonomousCastScheduler.generateCronSchedule()
    },
    endpoints: {
      POST: 'Trigger autonomous cast check and generation',
      GET: 'Get scheduler status'
    }
  })
}
