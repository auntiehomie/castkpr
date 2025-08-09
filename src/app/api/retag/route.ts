// src/app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CastService, supabase } from '@/lib/supabase'
import { CastIntelligence } from '@/lib/intelligence'
import { AIResponseService } from '@/lib/ai-response'
import type { SavedCast } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Enhanced CastKPR webhook received!')
    
    // Debug environment variables
    console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing')
    console.log('🔍 Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing')
    console.log('🔍 OpenAI Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Missing')
    
    const body = await request.json()
    console.log('📦 Webhook payload received')
    
    // Check event type
    if (body.type !== 'cast.created') {
      console.log('❌ Not a cast.created event, skipping')
      return NextResponse.json({ message: 'Event type not handled' })
    }
    
    const cast = body.data
    console.log('📝 Processing cast from:', cast.author.username)
    
    // Check for mentions
    const mentions = cast.mentioned_profiles || []
    const mentionsBot = mentions.some((profile: { username?: string; fid?: number }) => {
      return profile.username === 'cstkpr'
    })
    
    console.log('🤖 Bot mentioned?', mentionsBot)
    
    if (!mentionsBot) {
      console.log('❌ Bot not mentioned, skipping')
      return NextResponse.json({ message: 'Bot not mentioned' })
    }
    
    const text = cast.text.toLowerCase()
    const authorUsername = cast.author.username
    
    console.log('💬 Cast text:', text)
    console.log('👤 Author:', authorUsername)
    
    // Handle different commands with AI intelligence
    try {
      // Save commands
      if (text.includes('save this') || text.includes('save')) {
        return await handleSaveCommand(cast)
      }
      
      // Opinion commands (AI-powered)
      if (text.includes('opinion') || text.includes('thoughts') || text.includes('what do you think')) {
        return await handleOpinionRequest(cast)
      }
      
      // Enhanced opinion with web context
      if (text.includes('deep opinion') || text.includes('enhanced opinion') || text.includes('web context')) {
        return await handleEnhancedOpinionRequest(cast)
      }
      
      // Trending analysis (AI-powered)
      if (text.includes('trending') || text.includes('hot topics') || text.includes('what\'s hot')) {
        return await handleTrendingRequest(cast, authorUsername)
      }
      
      // Stats and analytics
      if (text.includes('stats') || text.includes('my stats') || text.includes('analytics')) {
        return await handleStatsRequest(cast, authorUsername)
      }
      
      // AI recommendations
      if (text.includes('recommend') || text.includes('suggestions') || text.includes('what should i')) {
        return await handleRecommendationRequest(cast, authorUsername)
      }
      
      // Help command
      if (text.includes('help') || text.includes('commands')) {
        return await handleHelpRequest(cast)
      }
      
      // Analysis command
      if (text.includes('analyze') || text.includes('analysis')) {
        return await handleAnalysisRequest(cast)
      }
      
      // Default: provide opinion on the cast or parent cast
      console.log('🤔 No specific command detected, providing default opinion...')
      return await handleOpinionRequest(cast)
      
    } catch (commandError) {
      console.error('❌ Command handling error:', commandError)
      
      // Fallback response
      return NextResponse.json({
        success: false,
        reply: "🤖 Something went wrong with my circuits! Try '@cstkpr help' to see available commands."
      })
    }
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleSaveCommand(cast: any) {
  console.log('💾 Processing save command...')
  
  const parentHash = cast.parent_hash
  console.log('👆 Parent hash:', parentHash)
  
  if (!parentHash) {
    return NextResponse.json({ 
      success: false,
      reply: "🤔 I don't see a cast to save here. Reply to a cast with '@cstkpr save this' to save it!"
    })
  }
  
  // Analyze the cast before saving to provide insight
  let analysisResult = ''
  let qualityScore = 0
  
  try {
    console.log('🧠 Analyzing cast quality...')
    const insight = await CastIntelligence.analyzeCastQuality(
      cast.parent_text || `Cast ${parentHash}`, 
      {
        likes: cast.parent_likes || 0,
        replies: cast.parent_replies || 0,
        recasts: cast.parent_recasts || 0
      }
    )
    
    qualityScore = insight.save_worthiness
    const scorePercent = (qualityScore * 100).toFixed(0)
    
    if (qualityScore > 0.7) {
      analysisResult = ` 🔥 Excellent choice! Quality score: ${scorePercent}% - this matches patterns from highly-saved content.`
    } else if (qualityScore > 0.4) {
      analysisResult = ` ✨ Solid pick! Quality score: ${scorePercent}% - good content worth preserving.`
    } else {
      analysisResult = ` 📝 Interesting selection! Quality score: ${scorePercent}% - unique content for your collection.`
    }
    
    // Add trending context if relevant
    if (insight.trending_score > 0.5) {
      analysisResult += ` Plus it's aligned with current trending topics!`
    }
    
  } catch (analysisError) {
    console.log('⚠️ Analysis failed, but continuing with save...', analysisError)
    analysisResult = ' (Analysis unavailable, but saved successfully!)'
  }
  
  // Create cast data that matches SavedCast interface
  const castData = {
    username: cast.parent_author?.username || `user-${cast.parent_author?.fid || 'unknown'}`,
    fid: cast.parent_author?.fid || 0,
    cast_hash: parentHash,
    cast_content: cast.parent_text || `🔗 Cast saved from Farcaster - Hash: ${parentHash}`,
    cast_timestamp: cast.parent_timestamp || new Date().toISOString(),
    tags: ['saved-via-bot'] as string[],
    likes_count: cast.parent_likes || 0,
    replies_count: cast.parent_replies || 0,
    recasts_count: cast.parent_recasts || 0,
    
    // Optional fields
    cast_url: `https://warpcast.com/~/conversations/${parentHash}`,
    author_pfp_url: cast.parent_author?.pfp_url,
    author_display_name: cast.parent_author?.display_name || cast.parent_author?.username,
    saved_by_user_id: cast.author.username,
    category: 'saved-via-bot',
    notes: `💾 Saved via @cstkpr bot by ${cast.author.username} on ${new Date().toLocaleDateString()}`,
    parsed_data: {
      urls: cast.parent_text ? 
        [...(cast.parent_text.match(/https?:\/\/[^\s]+/g) || []), `https://warpcast.com/~/conversations/${parentHash}`] :
        [`https://warpcast.com/~/conversations/${parentHash}`],
      hashtags: cast.parent_text ? [...(cast.parent_text.match(/#(\w+)/g) || [])].map((h: string) => h.slice(1)) : ['cstkpr', 'saved'],
      mentions: cast.parent_text ? [...(cast.parent_text.match(/@(\w+)/g) || [])].map((m: string) => m.slice(1)) : ['cstkpr'],
      word_count: cast.parent_text ? cast.parent_text.split(' ').length : 0,
      sentiment: 'neutral' as const,
      topics: cast.parent_text ? extractTopicsFromText(cast.parent_text) : ['saved-cast']
    }
  } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
  
  console.log('💾 Saving cast to database...')
  
  try {
    const savedCast = await CastService.saveCast(castData)
    console.log('✅ Cast saved successfully:', savedCast.cast_hash)
    
    return NextResponse.json({ 
      success: true,
      reply: `💾 Cast saved successfully!${analysisResult} View all your saves at your CastKPR dashboard.`,
      cast_id: savedCast.cast_hash,
      saved_cast_id: savedCast.id,
      quality_score: qualityScore
    })
    
  } catch (saveError) {
    console.error('❌ Error saving cast:', saveError)
    
    if (saveError instanceof Error && saveError.message.includes('already saved')) {
      return NextResponse.json({ 
        success: false,
        reply: "📝 You've already saved this cast! Check your dashboard to see all your saved content."
      })
    }
    
    return NextResponse.json({ 
      success: false,
      reply: "❌ Hmm, I couldn't save that cast. There might be a technical issue. Try again in a moment!"
    })
  }
}

async function handleOpinionRequest(cast: any) {
  console.log('🤔 Generating AI opinion...')
  
  const targetText = cast.parent_text || cast.text
  const targetAuthor = cast.parent_author?.username || cast.author.username
  const requesterUsername = cast.author.username
  
  if (!targetText || targetText.length < 10) {
    return NextResponse.json({
      reply: "🤔 I need more content to form an opinion! Tag me on a cast with some substance."
    })
  }
  
  try {
    // Use AI + data-driven context for intelligent response
    console.log('🧠 Generating AI opinion with community context...')
    const opinion = await AIResponseService.generateResponse(
      targetText,
      'opinion',
      targetAuthor,
      requesterUsername
    )
    
    return NextResponse.json({
      reply: opinion
    })
  } catch (error) {
    console.error('❌ AI opinion generation failed:', error)
    
    // Fallback to pattern-based opinion
    try {
      console.log('🔄 Falling back to pattern-based opinion...')
      const fallbackOpinion = await CastIntelligence.generateOpinion(targetText, targetAuthor)
      return NextResponse.json({
        reply: fallbackOpinion + " (AI temporarily unavailable)"
      })
    } catch (fallbackError) {
      console.error('❌ Fallback opinion also failed:', fallbackError)
      return NextResponse.json({
        reply: "🤖 My analysis circuits are having a moment, but this cast seems worth considering based on my pattern recognition!"
      })
    }
  }
}

async function handleEnhancedOpinionRequest(cast: any) {
  console.log('🌐 Generating enhanced AI opinion with web context...')
  
  const targetText = cast.parent_text || cast.text
  const targetAuthor = cast.parent_author?.username || cast.author.username
  const requesterUsername = cast.author.username
  
  if (!targetText || targetText.length < 10) {
    return NextResponse.json({
      reply: "🤔 I need more content for an enhanced analysis! Tag me on a cast with substance."
    })
  }
  
  try {
    // Use enhanced AI with web context
    const enhancedOpinion = await AIResponseService.generateOpinionWithWebContext(
      targetText,
      targetAuthor,
      requesterUsername
    )
    
    return NextResponse.json({
      reply: "🌐 " + enhancedOpinion
    })
  } catch (error) {
    console.error('❌ Enhanced opinion generation failed:', error)
    // Fallback to regular opinion
    return handleOpinionRequest(cast)
  }
}

async function handleTrendingRequest(cast: any, requesterUsername: string) {
  console.log('🔥 Generating trending analysis...')
  
  try {
    // Use AI to explain trends with context
    const aiResponse = await AIResponseService.generateResponse(
      'current trending topics and patterns in the community',
      'trending',
      undefined,
      requesterUsername
    )
    
    return NextResponse.json({
      reply: aiResponse
    })
  } catch (error) {
    console.error('❌ AI trending analysis failed:', error)
    
    // Fallback to data-only trending
    try {
      const trending = await CastIntelligence.getTrendingTopics('week')
      
      if (trending.length === 0) {
        return NextResponse.json({
          reply: "📊 Not enough data yet to identify trending topics. Help me learn by saving more casts! Use '@cstkpr save this' on interesting content."
        })
      }
      
      const topTrending = trending.slice(0, 5)
      const trendingText = topTrending
        .map((topic, i) => `${i + 1}. #${topic.topic} (${topic.save_count} saves)`)
        .join('\n')
      
      return NextResponse.json({
        reply: `🔥 This week's trending topics based on community saves:\n\n${trendingText}\n\nThese topics are getting lots of attention lately!`
      })
    } catch (fallbackError) {
      return NextResponse.json({
        reply: "📊 I'm still learning about trends. Save more casts to help me identify what's hot!"
      })
    }
  }
}

async function handleStatsRequest(cast: any, requesterUsername: string) {
  console.log('📊 Generating user stats...')
  
  try {
    const stats = await CastService.getUserStats(requesterUsername)
    const recommendations = await CastIntelligence.getPersonalizedRecommendations(requesterUsername)
    
    let reply = `📊 Your CastKPR stats:\n• ${stats.totalCasts} casts saved`
    
    if (recommendations.topics.length > 0) {
      reply += `\n• Top interests: ${recommendations.topics.slice(0, 3).join(', ')}`
    }
    
    if (recommendations.similar_users.length > 0) {
      reply += `\n• Users with similar taste: ${recommendations.similar_users.slice(0, 2).join(', ')}`
    }
    
    if (stats.totalCasts > 0) {
      reply += `\n\n💡 Keep saving quality content to improve my recommendations for you!`
    } else {
      reply += `\n\n🚀 Start saving casts with '@cstkpr save this' to build your profile!`
    }
    
    return NextResponse.json({ reply })
  } catch (error) {
    console.error('❌ Stats generation failed:', error)
    return NextResponse.json({
      reply: "📊 I can't access your stats right now. Make sure you've saved some casts first with '@cstkpr save this'!"
    })
  }
}

async function handleRecommendationRequest(cast: any, requesterUsername: string) {
  console.log('🎯 Generating AI recommendations...')
  
  try {
    // Use AI to provide personalized recommendations
    const aiResponse = await AIResponseService.generateResponse(
      'personalized content recommendations based on user behavior and community trends',
      'recommendation',
      undefined,
      requesterUsername
    )
    
    return NextResponse.json({
      reply: aiResponse
    })
  } catch (error) {
    console.error('❌ AI recommendation failed:', error)
    
    // Fallback to data-driven recommendations
    try {
      const recommendations = await CastIntelligence.getPersonalizedRecommendations(requesterUsername)
      const trending = await CastIntelligence.getTrendingTopics('day')
      
      let reply = "🎯 Based on your saves and current trends:\n\n"
      
      if (recommendations.recommended_hashtags.length > 0) {
        reply += `🏷️ Try following: ${recommendations.recommended_hashtags.slice(0, 4).map(h => `#${h}`).join(', ')}\n\n`
      }
      
      if (trending.length > 0) {
        reply += `🔥 Hot right now: ${trending.slice(0, 3).map(t => `#${t.topic}`).join(', ')}\n\n`
      }
      
      reply += "💡 Save more casts to get even better personalized recommendations!"
      
      return NextResponse.json({ reply })
    } catch (fallbackError) {
      return NextResponse.json({
        reply: "🎯 I need more data to make good recommendations. Save some casts with '@cstkpr save this' to help me learn your preferences!"
      })
    }
  }
}

async function handleAnalysisRequest(cast: any) {
  console.log('📊 Generating cast analysis...')
  
  const targetText = cast.parent_text || cast.text
  
  if (!targetText || targetText.length < 10) {
    return NextResponse.json({
      reply: "📊 I need more content to analyze! Tag me on a cast with substance."
    })
  }
  
  try {
    const analysis = await CastIntelligence.analyzeCastQuality(targetText)
    
    const qualityPercent = (analysis.quality_score * 100).toFixed(0)
    const trendingPercent = (analysis.trending_score * 100).toFixed(0)
    const saveWorthiness = (analysis.save_worthiness * 100).toFixed(0)
    
    let reply = `📊 Cast Analysis:\n\n`
    reply += `🎯 Quality Score: ${qualityPercent}%\n`
    reply += `🔥 Trending Alignment: ${trendingPercent}%\n`
    reply += `💾 Save Worthiness: ${saveWorthiness}%\n`
    
    if (analysis.topics.length > 0) {
      reply += `🏷️ Key Topics: ${analysis.topics.slice(0, 3).join(', ')}\n`
    }
    
    if (saveWorthiness >= '70') {
      reply += `\n✨ Strong candidate for saving!`
    } else if (saveWorthiness >= '50') {
      reply += `\n🤔 Decent content, save if it matches your interests.`
    } else {
      reply += `\n💡 Unique content - value depends on personal relevance.`
    }
    
    return NextResponse.json({ reply })
  } catch (error) {
    console.error('❌ Analysis failed:', error)
    return NextResponse.json({
      reply: "📊 Analysis circuits temporarily offline. Try again in a moment!"
    })
  }
}

async function handleHelpRequest(cast: any) {
  const helpText = `🤖 CastKPR Bot Commands:

💾 "@cstkpr save this" - Save any cast with quality analysis
🤔 "@cstkpr opinion" - AI opinion based on community data  
🌐 "@cstkpr deep opinion" - Enhanced analysis with web context
📊 "@cstkpr analyze" - Detailed cast quality breakdown
🔥 "@cstkpr trending" - AI explanation of what's hot
📈 "@cstkpr stats" - Your personal save statistics
🎯 "@cstkpr recommend" - AI-powered content suggestions
❓ "@cstkpr help" - Show this help

I combine community intelligence with AI to give you smart insights! 🧠✨`

  return NextResponse.json({ reply: helpText })
}

// Helper function to extract topics from text
function extractTopicsFromText(text: string): string[] {
  const topics = []
  
  // Extract hashtags
  const hashtags = [...text.matchAll(/#(\w+)/g)].map(match => match[1])
  topics.push(...hashtags)
  
  // Simple keyword extraction
  const keywords = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(word => word.length > 3)
    .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'will', 'been', 'were'].includes(word))
  
  topics.push(...keywords.slice(0, 3))
  
  return [...new Set(topics)].slice(0, 5)
}