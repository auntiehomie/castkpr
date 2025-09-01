// src/app/api/dev-scheduler/route.ts
// Development-only endpoint to simulate cron scheduling locally
import { NextRequest, NextResponse } from 'next/server'
import { AutonomousCastScheduler } from '@/lib/autonomous-scheduler'

let isSchedulerActive = false
let schedulerInterval: NodeJS.Timeout | null = null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body // 'start', 'stop', or 'status'
    
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
    }
    
    switch (action) {
      case 'start':
        if (isSchedulerActive) {
          return NextResponse.json({ message: 'Scheduler already running' })
        }
        
        isSchedulerActive = true
        const intervalHours = AutonomousCastScheduler.getRecommendedPostingInterval()
        const intervalMs = intervalHours * 60 * 60 * 1000 // Convert to milliseconds
        
        // Set up interval to check for posting
        schedulerInterval = setInterval(async () => {
          try {
            console.log('🕐 Development scheduler tick')
            
            const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
            const response = await fetch(`${baseUrl}/api/schedule/autonomous-cast`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            })
            
            const result = await response.json()
            console.log('📊 Scheduler result:', result.message)
            
          } catch (error) {
            console.error('💥 Scheduler tick error:', error)
          }
        }, intervalMs)
        
        return NextResponse.json({
          success: true,
          message: 'Development scheduler started',
          interval: `${intervalHours} hours`,
          nextCheck: new Date(Date.now() + intervalMs).toISOString()
        })
        
      case 'stop':
        if (!isSchedulerActive) {
          return NextResponse.json({ message: 'Scheduler not running' })
        }
        
        if (schedulerInterval) {
          clearInterval(schedulerInterval)
          schedulerInterval = null
        }
        isSchedulerActive = false
        
        return NextResponse.json({
          success: true,
          message: 'Development scheduler stopped'
        })
        
      case 'trigger':
        // Manually trigger a post regardless of timing
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
        const response = await fetch(`${baseUrl}/api/autonomous-cast`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.AUTONOMOUS_CAST_SECRET}`,
            'Content-Type': 'application/json',
          },
        })
        
        const result = await response.json()
        
        return NextResponse.json({
          success: result.success,
          message: result.success ? 'Manual trigger successful' : 'Manual trigger failed',
          cast: result.cast,
          triggeredAt: new Date().toISOString()
        })
        
      default:
        return NextResponse.json({
          success: true,
          status: {
            active: isSchedulerActive,
            interval: schedulerInterval ? `${AutonomousCastScheduler.getRecommendedPostingInterval()} hours` : null,
            isGoodTimeToPost: AutonomousCastScheduler.isGoodTimeToPost(),
            cronSchedule: AutonomousCastScheduler.generateCronSchedule()
          }
        })
    }
    
  } catch (error) {
    console.error('💥 Dev scheduler error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return POST(new NextRequest('http://localhost:3000/api/dev-scheduler', { 
    method: 'POST',
    body: JSON.stringify({ action: 'status' }),
    headers: { 'Content-Type': 'application/json' }
  }))
}
