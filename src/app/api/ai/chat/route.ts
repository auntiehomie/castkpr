import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import { AIService } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const { question, userId } = await request.json()
    
    console.log('🤖 AI Chat Request:', { question, userId })
    
    if (!question || !userId) {
      console.error('❌ Missing question or userId')
      return NextResponse.json({ 
        error: 'Question and userId are required' 
      }, { status: 400 })
    }

    // Get user's casts
    console.log('📊 Fetching casts for user:', userId)
    const userCasts = await CastService.getUserCasts(userId, 50)
    console.log('✅ Found casts:', userCasts.length)
    
    if (userCasts.length === 0) {
      console.log('⚠️ No casts found for user')
      return NextResponse.json({ 
        response: `I don't see any saved casts for you yet! Start saving some casts by replying "@cstkpr save this" to any cast on Farcaster, then come back and ask me questions about them.` 
      })
    }

    // Format casts for AI
    const castsForAI = userCasts.map(cast => ({
      content: cast.cast_content,
      author: cast.username,
      timestamp: cast.cast_timestamp,
      tags: cast.tags || [],
      category: cast.category || 'uncategorized'
    }))
    
    console.log('🔄 Sending to AI:', {
      castCount: castsForAI.length,
      question: question.slice(0, 50) + '...'
    })

    // Get AI response
    const aiResponse = await AIService.chatAboutCasts(question, castsForAI)
    console.log('✅ AI Response received:', aiResponse.slice(0, 100) + '...')
    
    return NextResponse.json({ response: aiResponse })
    
  } catch (error) {
    console.error('💥 AI Chat API Error:', error)
    
    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('OpenAI')) {
        return NextResponse.json({ 
          response: 'Sorry, there was an issue with the AI service. Please try again later.' 
        })
      }
      if (error.message.includes('database') || error.message.includes('supabase')) {
        return NextResponse.json({ 
          response: 'Sorry, there was an issue accessing your saved casts. Please try again.' 
        })
      }
    }
    
    return NextResponse.json({ 
      response: 'Sorry, something went wrong. Please try again later.' 
    })
  }
}