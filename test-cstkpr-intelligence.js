// Simple script to test the @cstkpr intelligence system
import { CstkprIntelligenceService } from './src/lib/supabase.js'

async function testCstkprIntelligence() {
  console.log('🧪 Testing @cstkpr Intelligence System...')
  
  // Test 1: Extract topics
  const testContent = "What do you think about the recent ETH pump? I'm bullish but worried about market volatility."
  const topics = CstkprIntelligenceService.extractCastTopics(testContent)
  console.log('✅ Topics extracted:', topics)
  
  // Test 2: Generate opinion (without database)
  try {
    const opinion = await CstkprIntelligenceService.generateOpinion(
      testContent,
      'test-user',
      topics,
      [], // No related casts
      null, // No web research
      '', // No user quality insight
      [] // No similar casts
    )
    
    console.log('✅ Opinion generated successfully:', {
      text: opinion.text.substring(0, 100) + '...',
      confidence: opinion.confidence,
      tone: opinion.tone,
      reasoning: opinion.reasoning.length + ' reasons'
    })
    
  } catch (error) {
    console.error('❌ Opinion generation failed:', error)
  }
  
  // Test 3: Check environment variables
  console.log('🔧 Environment check:')
  console.log('- NEYNAR_API_KEY:', process.env.NEYNAR_API_KEY ? '✅ Set' : '❌ Missing')
  console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
}

testCstkprIntelligence().catch(console.error)
