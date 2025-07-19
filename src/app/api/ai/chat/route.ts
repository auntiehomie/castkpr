import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import { AIService } from '@/lib/ai'

export async function POST(request: NextRequest) {
  const { question, userId } = await request.json()
  const userCasts = await CastService.getUserCasts(userId, 50)
  
  const castsForAI = userCasts.map(cast => ({
    content: cast.cast_content,
    author: cast.username,
    timestamp: cast.cast_timestamp
  }))
  
  const aiResponse = await AIService.chatAboutCasts(question, castsForAI)
  
  return NextResponse.json({ response: aiResponse })
}