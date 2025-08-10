import { NextRequest, NextResponse } from 'next/server'
import { supabase, CastService } from '@/lib/supabase'
import { AIContextService } from '@/lib/ai-context'

export async function POST(request: NextRequest) {
  try {
    console.log('🧠 Manual AI learning triggered')
    
    const body = await request.json()
    const { forceRelearn = false, userId = null, limit = 100 } = body
    
    let castsToAnalyze = []
    
    if (userId) {
      // Learn from specific user's casts
      console.log(`📚 Learning from user ${userId}'s casts`)
      castsToAnalyze = await CastService.getUserCasts(userId, limit)
    } else {
      // Learn from all recent casts
      console.log('📚 Learning from all recent casts')
      castsToAnalyze = await CastService.getAllRecentCasts(limit)
    }
    
    if (castsToAnalyze.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No casts found to learn from',
        castsAnalyzed: 0,
        contextsCreated: 0,
        profilesUpdated: 0
      })
    }
    
    console.log(`🔍 Analyzing ${castsToAnalyze.length} casts`)
    
    let contextsCreated = 0
    let profilesUpdated = 0
    const topics = new Set<string>()
    const userInteractions = new Map<string, any>()
    
    // Process casts in batches to avoid overwhelming the system
    const batchSize = 10
    for (let i = 0; i < castsToAnalyze.length; i += batchSize) {
      const batch = castsToAnalyze.slice(i, i + batchSize)
      
      for (const cast of batch) {
        try {
          // Extract topics and insights from cast content
          const content = cast.cast_content.toLowerCase()
          const words = content.split(/\s+/)
          
          // Simple topic extraction (can be enhanced with NLP)
          const detectedTopics = extractTopics(content, cast.parsed_data)
          detectedTopics.forEach(topic => topics.add(topic))
          
          // Build user interaction patterns
          const userKey = cast.saved_by_user_id || 'anonymous'
          if (!userInteractions.has(userKey)) {
            userInteractions.set(userKey, {
              castCount: 0,
              topics: new Set(),
              avgEngagement: 0,
              totalEngagement: 0,
              preferredTimes: [],
              hashtagUsage: new Set()
            })
          }
          
          const userStats = userInteractions.get(userKey)
          userStats.castCount++
          detectedTopics.forEach(topic => userStats.topics.add(topic))
          
          const engagement = (cast.likes_count || 0) + (cast.replies_count || 0) + (cast.recasts_count || 0)
          userStats.totalEngagement += engagement
          userStats.avgEngagement = userStats.totalEngagement / userStats.castCount
          
          // Extract hashtags from parsed data
          if (cast.parsed_data?.hashtags) {
            cast.parsed_data.hashtags.forEach((tag: string) => userStats.hashtagUsage.add(tag))
          }
          
        } catch (castError) {
          console.error(`Error processing cast ${cast.id}:`, castError)
        }
      }
    }
    
    // Create or update AI contexts for discovered topics
    for (const topic of topics) {
      try {
        const relatedCasts = castsToAnalyze
          .filter(cast => extractTopics(cast.cast_content, cast.parsed_data).includes(topic))
          .map(cast => cast.cast_hash)
          .slice(0, 10) // Limit related casts
        
        const existingContext = await AIContextService.getContext(topic)
        
        if (existingContext && !forceRelearn) {
          // Update existing context with new casts
          await AIContextService.updateContext(topic, {
            related_casts: [...new Set([...existingContext.related_casts, ...relatedCasts])],
            confidence_score: Math.min(existingContext.confidence_score + 0.1, 1.0),
            updated_at: new Date().toISOString()
          })
        } else {
          // Create new context
          const summary = generateTopicSummary(topic, castsToAnalyze.filter(cast => 
            extractTopics(cast.cast_content, cast.parsed_data).includes(topic)
          ))
          
          const insights = generateKeyInsights(topic, castsToAnalyze)
          
          await AIContextService.createContext({
            id: `topic_${topic.replace(/\s+/g, '_').toLowerCase()}`,
            topic,
            summary,
            key_insights: insights,
            related_casts: relatedCasts,
            confidence_score: Math.min(relatedCasts.length * 0.1, 1.0)
          })
          
          contextsCreated++
        }
      } catch (contextError) {
        console.error(`Error creating context for topic ${topic}:`, contextError)
      }
    }
    
    // Update user AI profiles
    for (const [userId, stats] of userInteractions.entries()) {
      try {
        if (userId === 'anonymous') continue
        
        await supabase
          .from('user_ai_profiles')
          .upsert({
            user_id: userId,
            interests: Array.from(stats.topics),
            interaction_patterns: {
              avgEngagement: stats.avgEngagement,
              castCount: stats.castCount,
              topHashtags: Array.from(stats.hashtagUsage).slice(0, 10)
            },
            preferred_topics: Array.from(stats.topics).slice(0, 10),
            engagement_level: Math.min(stats.avgEngagement / 10, 1.0), // Normalize to 0-1
            last_updated: new Date().toISOString()
          })
        
        profilesUpdated++
      } catch (profileError) {
        console.error(`Error updating profile for user ${userId}:`, profileError)
      }
    }
    
    // Log learning session
    await supabase
      .from('ai_learning')
      .insert({
        learning_type: 'manual_trigger',
        learning_data: {
          castsAnalyzed: castsToAnalyze.length,
          topicsDiscovered: topics.size,
          contextsCreated,
          profilesUpdated,
          triggeredBy: userId || 'system',
          batchSize
        }
      })
    
    console.log(`✅ Learning complete: ${contextsCreated} contexts, ${profilesUpdated} profiles`)
    
    return NextResponse.json({
      success: true,
      message: 'AI learning completed successfully',
      castsAnalyzed: castsToAnalyze.length,
      topicsDiscovered: topics.size,
      contextsCreated,
      profilesUpdated,
      insights: {
        topTopics: Array.from(topics).slice(0, 10),
        totalUsers: userInteractions.size,
        avgEngagementAcrossUsers: Array.from(userInteractions.values())
          .reduce((sum, stats) => sum + stats.avgEngagement, 0) / userInteractions.size
      }
    })
    
  } catch (error) {
    console.error('💥 AI learning error:', error)
    return NextResponse.json({ 
      error: 'AI learning failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get learning analytics
    const { data: learningStats, error: learningError } = await supabase
      .from('ai_learning')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (learningError) {
      console.error('Error fetching learning stats:', learningError)
      return NextResponse.json({ error: 'Failed to fetch learning stats' }, { status: 500 })
    }
    
    const { data: contextStats, error: contextError } = await supabase
      .from('ai_contexts')
      .select('topic, confidence_score, created_at')
      .order('confidence_score', { ascending: false })
      .limit(20)
    
    if (contextError) {
      console.error('Error fetching context stats:', contextError)
      return NextResponse.json({ error: 'Failed to fetch context stats' }, { status: 500 })
    }
    
    const { data: profileStats, error: profileError } = await supabase
      .from('user_ai_profiles')
      .select('user_id, engagement_level, last_updated')
      .order('engagement_level', { ascending: false })
      .limit(10)
    
    if (profileError) {
      console.error('Error fetching profile stats:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile stats' }, { status: 500 })
    }
    
    return NextResponse.json({
      recentLearning: learningStats,
      topContexts: contextStats,
      topUsers: profileStats,
      summary: {
        totalContexts: contextStats.length,
        totalProfiles: profileStats.length,
        avgConfidence: contextStats.reduce((sum, ctx) => sum + (ctx.confidence_score || 0), 0) / contextStats.length,
        lastLearning: learningStats[0]?.created_at || null
      }
    })
    
  } catch (error) {
    console.error('AI learning GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper functions
function extractTopics(content: string, parsedData: any): string[] {
  const topics = new Set<string>()
  
  // Extract from hashtags
  if (parsedData?.hashtags) {
    parsedData.hashtags.forEach((tag: string) => topics.add(tag))
  }
  
  // Extract from common topic keywords
  const topicKeywords = [
    'crypto', 'nft', 'defi', 'web3', 'blockchain', 'ethereum', 'bitcoin',
    'art', 'music', 'gaming', 'sports', 'politics', 'tech', 'ai', 'ml',
    'startup', 'venture', 'investment', 'trading', 'market', 'finance',
    'social', 'community', 'meme', 'culture', 'philosophy', 'science'
  ]
  
  const words = content.toLowerCase().split(/\s+/)
  topicKeywords.forEach(keyword => {
    if (words.some(word => word.includes(keyword))) {
      topics.add(keyword)
    }
  })
  
  return Array.from(topics)
}

function generateTopicSummary(topic: string, relatedCasts: any[]): string {
  const castCount = relatedCasts.length
  const avgEngagement = relatedCasts.reduce((sum, cast) => 
    sum + (cast.likes_count || 0) + (cast.replies_count || 0) + (cast.recasts_count || 0), 0
  ) / castCount
  
  return `Topic '${topic}' appears in ${castCount} saved casts with average engagement of ${avgEngagement.toFixed(1)} interactions per cast.`
}

function generateKeyInsights(topic: string, allCasts: any[]): string[] {
  const relatedCasts = allCasts.filter(cast => 
    extractTopics(cast.cast_content, cast.parsed_data).includes(topic)
  )
  
  const insights = []
  
  if (relatedCasts.length > 0) {
    const totalEngagement = relatedCasts.reduce((sum, cast) => 
      sum + (cast.likes_count || 0) + (cast.replies_count || 0) + (cast.recasts_count || 0), 0
    )
    
    insights.push(`High engagement topic with ${totalEngagement} total interactions`)
    
    const uniqueAuthors = new Set(relatedCasts.map(cast => cast.username))
    insights.push(`Discussed by ${uniqueAuthors.size} different users`)
    
    const recentCasts = relatedCasts.filter(cast => 
      new Date(cast.cast_timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    )
    
    if (recentCasts.length > 0) {
      insights.push(`Active topic with ${recentCasts.length} casts in the last week`)
    }
  }
  
  return insights
}