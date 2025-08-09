// src/app/api/webhook-smart/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import { CastIntelligence } from '@/lib/intelligence'

export async function POST(request: NextRequest) {
  try {
    console.log('🧠 Smart webhook received!')
    
    const body = await request.json()
    
    if (body.type !== 'cast.created') {
      return NextResponse.json({ message: 'Event type not handled' })
    }
    
    const cast = body.data
    const mentions = cast.mentioned_profiles || []
    const mentionsBot = mentions.some((profile: { username?: string }) => 
      profile.username === 'cstkpr'
    )
    
    if (!mentionsBot) {
      return NextResponse.json({ message: 'Bot not mentioned' })
    }
    
    const text = cast.text.toLowerCase()
    const authorUsername = cast.author.username
    
    // Handle different commands
    if (text.includes('save this') || text.includes('save')) {
      return await handleSaveCommand(cast)
    }
    
    if (text.includes('opinion') || text.includes('thoughts') || text.includes('what do you think')) {
      return await handleOpinionRequest(cast)
    }
    
    if (text.includes('trending') || text.includes('hot topics')) {
      return await handleTrendingRequest(cast, authorUsername)
    }
    
    if (text.includes('stats') || text.includes('my stats')) {
      return await handleStatsRequest(cast, authorUsername)
    }
    
    if (text.includes('recommend') || text.includes('suggestions')) {
      return await handleRecommendationRequest(cast, authorUsername)
    }
    
    if (text.includes('help')) {
      return await handleHelpRequest(cast)
    }
    
    // Default: provide opinion on the cast or parent cast
    return await handleOpinionRequest(cast)
    
  } catch (error) {
    console.error('💥 Smart webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleSaveCommand(cast: any) {
  // Your existing save logic...
  const parentHash = cast.parent_hash
  
  if (!parentHash) {
    return NextResponse.json({ 
      message: 'No parent cast to save',
      reply: "🤔 I don't see a cast to save here. Reply to a cast with '@cstkpr save this' to save it!"
    })
  }
  
  // Analyze the cast before saving to provide insight
  let analysisResult = ''
  try {
    const insight = await CastIntelligence.analyzeCastQuality(
      cast.parent_text || '', 
      {
        likes: cast.parent_likes || 0,
        replies: cast.parent_replies || 0,
        recasts: cast.parent_recasts || 0
      }
    )
    
    analysisResult = ` (Quality score: ${(insight.save_worthiness * 100).toFixed(0)}% - ${
      insight.save_worthiness > 0.7 ? 'Great choice!' : 
      insight.save_worthiness > 0.4 ? 'Solid pick!' : 
      'Interesting selection!'
    })`
  } catch (e) {
    console.log('Analysis failed, but continuing with save...')
  }
  
  // Save the cast (your existing logic)
  const castData = {
    username: `user-${cast.parent_author?.fid || 'unknown'}`,
    fid: cast.parent_author?.fid || 0,
    cast_hash: parentHash,
    cast_content: cast.parent_text || `Cast saved - Hash: ${parentHash}`,
    cast_timestamp: new Date().toISOString(),
    tags: ['saved-via-bot'],
    likes_count: cast.parent_likes || 0,
    replies_count: cast.parent_replies || 0,
    recasts_count: cast.parent_recasts || 0,
    cast_url: `https://warpcast.com/~/conversations/${parentHash}`,
    saved_by_user_id: cast.author.username,
    category: 'saved-via-bot',
    notes: `Saved via @cstkpr bot by ${cast.author.username}`
  }
  
  try {
    await CastService.saveCast(castData)
    
    return NextResponse.json({ 
      success: true,
      reply: `💾 Cast saved successfully!${analysisResult} You can view all your saved casts at your dashboard.`
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      reply: "❌ Hmm, I couldn't save that cast. It might already be saved or there was a technical issue."
    })
  }
}

async function handleOpinionRequest(cast: any) {
  // Analyze the current cast or parent cast
  const targetText = cast.parent_text || cast.text
  const targetAuthor = cast.parent_author?.username || cast.author.username
  
  if (!targetText || targetText.length < 10) {
    return NextResponse.json({
      reply: "🤔 I need more content to form an opinion! Tag me on a cast with some substance."
    })
  }
  
  try {
    const opinion = await CastIntelligence.generateOpinion(targetText, targetAuthor)
    
    return NextResponse.json({
      reply: opinion
    })
  } catch (error) {
    return NextResponse.json({
      reply: "🤖 My analysis circuits are a bit fried right now, but this cast seems worth considering based on my gut feeling!"
    })
  }
}

async function handleTrendingRequest(cast: any, requesterUsername: string) {
  try {
    const trending = await CastIntelligence.getTrendingTopics('week')
    
    if (trending.length === 0) {
      return NextResponse.json({
        reply: "📊 Not enough data yet to identify trending topics. Help me learn by saving more casts!"
      })
    }
    
    const topTrending = trending.slice(0, 5)
    const trendingText = topTrending
      .map((topic, i) => `${i + 1}. #${topic.topic} (${topic.save_count} saves)`)
      .join('\n')
    
    return NextResponse.json({
      reply: `🔥 This week's trending topics based on what people are saving:\n\n${trendingText}\n\nThese topics are getting lots of saves lately!`
    })
  } catch (error) {
    return NextResponse.json({
      reply: "📊 I'm still learning about trends. Save more casts to help me identify what's hot!"
    })
  }
}

async function handleStatsRequest(cast: any, requesterUsername: string) {
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
    
    return NextResponse.json({ reply })
  } catch (error) {
    return NextResponse.json({
      reply: "📊 I can't access your stats right now. Make sure you've saved some casts first!"
    })
  }
}

async function handleRecommendationRequest(cast: any, requesterUsername: string) {
  try {
    const recommendations = await CastIntelligence.getPersonalizedRecommendations(requesterUsername)
    const trending = await CastIntelligence.getTrendingTopics('day')
    
    let reply = "🎯 Based on your saved casts, here's what I recommend:\n\n"
    
    if (recommendations.recommended_hashtags.length > 0) {
      reply += `🏷️ Hashtags to follow: ${recommendations.recommended_hashtags.slice(0, 5).map(h => `#${h}`).join(', ')}\n\n`
    }
    
    if (trending.length > 0) {
      reply += `🔥 Hot right now: ${trending.slice(0, 3).map(t => `#${t.topic}`).join(', ')}\n\n`
    }
    
    reply += "💡 I'm constantly learning from the community's saves to give you better recommendations!"
    
    return NextResponse.json({ reply })
  } catch (error) {
    return NextResponse.json({
      reply: "🎯 I need more data to make good recommendations. Save more casts to help me learn your preferences!"
    })
  }
}

async function handleHelpRequest(cast: any) {
  const helpText = `🤖 CastKPR Bot Commands:

💾 "@cstkpr save this" - Save any cast
🤔 "@cstkpr opinion" - Get my thoughts on a cast  
🔥 "@cstkpr trending" - See what's hot this week
📊 "@cstkpr stats" - Your personal stats
🎯 "@cstkpr recommend" - Get personalized suggestions
❓ "@cstkpr help" - Show this help

I learn from every cast you save to give better opinions and recommendations!`

  return NextResponse.json({ reply: helpText })
}