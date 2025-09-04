import { NextRequest, NextResponse } from 'next/server'
import { CstkprIntelligenceService } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { test_content, test_author = 'test-user' } = await request.json()
    
    const testContent = test_content || "What do you think about the recent ETH pump? I'm bullish but worried about market volatility."
    
    console.log('🧪 Testing @cstkpr intelligence with content:', testContent)
    
    // Test 1: Extract topics
    const topics = CstkprIntelligenceService.extractCastTopics(testContent)
    console.log('✅ Topics extracted:', topics)
    
    // Test 2: Generate opinion (without database save)
    const opinion = await CstkprIntelligenceService.generateOpinion(
      testContent,
      test_author,
      topics,
      [], // No related casts
      null, // No web research
      '', // No user quality insight
      [] // No similar casts
    )
    
    console.log('✅ Opinion generated successfully')
    
    return NextResponse.json({
      success: true,
      test_results: {
        topics_extracted: topics,
        opinion_generated: {
          text: opinion.text,
          confidence: Math.round(opinion.confidence * 100),
          tone: opinion.tone,
          reasoning_points: opinion.reasoning.length,
          sources_count: opinion.sources.length
        },
        message: '✅ Core @cstkpr intelligence system is working!'
      }
    })
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '❌ @cstkpr intelligence test failed'
    }, { status: 500 })
  }
}
