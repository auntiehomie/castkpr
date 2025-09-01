// src/app/api/autonomous-cast/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CstkprIntelligenceService, CastService } from '@/lib/supabase'
import { AutonomousCastScheduler } from '@/lib/autonomous-scheduler'

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

interface TrendingCast {
  hash: string
  text: string
  author: {
    username: string
    display_name: string
    fid: number
  }
  timestamp: string
  reactions: {
    likes_count: number
    replies_count: number
    recasts_count: number
  }
  channel?: {
    id: string
    name: string
  }
}

// POST a cast to Farcaster via Neynar API
async function postCastToFarcaster(text: string): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    console.error('❌ NEYNAR_API_KEY not configured')
    return false
  }

  const signerUuid = process.env.NEYNAR_SIGNER_UUID
  if (!signerUuid) {
    console.error('❌ NEYNAR_SIGNER_UUID not configured')
    return false
  }

  try {
    console.log('📤 Attempting to post cast to Farcaster...')
    console.log('🔑 Using signer UUID:', signerUuid.substring(0, 8) + '...')
    
    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        text: text,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Successfully posted cast:', result.cast?.hash)
      return true
    } else {
      const error = await response.text()
      console.error('❌ Failed to post cast:', response.status, error)
      
      // Specific error handling for signer issues
      if (response.status === 404 && error.includes('Signer not found')) {
        console.error('🔑 Signer UUID is invalid or expired. Please check NEYNAR_SIGNER_UUID in your environment file.')
        console.error('💡 You may need to create a new signer at https://dev.neynar.com/app')
      }
      
      return false
    }
  } catch (error) {
    console.error('💥 Error posting cast:', error)
    return false
  }
}

// Get trending casts from Neynar
async function getTrendingCasts(): Promise<TrendingCast[]> {
  if (!NEYNAR_API_KEY) {
    console.error('❌ NEYNAR_API_KEY not configured')
    return []
  }

  try {
    // Get trending casts from the last 24 hours (Neynar allows max 10 limit)
    const response = await fetch('https://api.neynar.com/v2/farcaster/feed/trending?time_window=24h&limit=10', {
      headers: {
        'Accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
    })

    if (response.ok) {
      const data = await response.json()
      
      // Filter for casts with good engagement and quality content
      const trendingCasts = data.casts
        .filter((cast: any) => {
          const totalEngagement = (cast.reactions?.likes_count || 0) + 
                                 (cast.reactions?.replies_count || 0) + 
                                 (cast.reactions?.recasts_count || 0)
          
          return totalEngagement >= 5 && // Minimum engagement
                 cast.text && 
                 cast.text.length > 20 && // Substantial content
                 cast.text.length < 200 && // Not too long
                 !cast.text.includes('@cstkpr') && // Not already about our bot
                 !cast.author.username.includes('bot') // Not from other bots
        })
        .map((cast: any) => ({
          hash: cast.hash,
          text: cast.text,
          author: {
            username: cast.author.username,
            display_name: cast.author.display_name,
            fid: cast.author.fid
          },
          timestamp: cast.timestamp,
          reactions: {
            likes_count: cast.reactions?.likes_count || 0,
            replies_count: cast.reactions?.replies_count || 0,
            recasts_count: cast.reactions?.recasts_count || 0
          },
          channel: cast.channel ? {
            id: cast.channel.id,
            name: cast.channel.name
          } : undefined
        }))
        .slice(0, 10) // Top 10 trending casts

      console.log(`📈 Found ${trendingCasts.length} trending casts`)
      return trendingCasts

    } else {
      const errorText = await response.text()
      console.error('❌ Failed to fetch trending casts:', response.status, errorText)
      return []
    }
  } catch (error) {
    console.error('💥 Error fetching trending casts:', error)
    return []
  }
}

// Generate original autonomous cast based on trending topics and saved cast analysis
async function generateOriginalCast(trendingTopics: string[]): Promise<string | null> {
  try {
    // Current context for inspiration (use proper timezone detection)
    const now = new Date()
    
    // Get Eastern Time properly
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    const currentHour = easternTime.getHours()
    const timeContext = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening'
    const dayOfWeek = easternTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })
    const isWeekend = easternTime.getDay() === 0 || easternTime.getDay() === 6
    
    console.log(`🕐 Current Eastern Time: ${easternTime.toLocaleString()}, Hour: ${currentHour}, Day: ${dayOfWeek}`)
    
    // Get recent saved casts for analysis
    console.log('📚 Analyzing recent saved casts for content inspiration...')
    let savedCastsInsights = ''
    try {
      const recentCasts = await CastService.getAllRecentCasts(20)
      if (recentCasts.length > 0) {
        // Analyze common topics and patterns in saved casts
        const allTopics = new Set<string>()
        const contentTypes = new Map<string, number>()
        let totalEngagement = 0
        
        recentCasts.forEach(cast => {
          // Extract topics from saved casts
          if (cast.parsed_data?.topics) {
            cast.parsed_data.topics.forEach(topic => allTopics.add(topic))
          }
          
          // Track content types
          if (cast.parsed_data?.urls && cast.parsed_data.urls.length > 0) {
            contentTypes.set('links', (contentTypes.get('links') || 0) + 1)
          }
          if (cast.parsed_data?.hashtags && cast.parsed_data.hashtags.length > 0) {
            contentTypes.set('hashtags', (contentTypes.get('hashtags') || 0) + 1)
          }
          
          totalEngagement += (cast.likes_count + cast.replies_count + cast.recasts_count)
        })
        
        const popularSavedTopics = Array.from(allTopics).slice(0, 5)
        const avgEngagement = Math.round(totalEngagement / recentCasts.length)
        
        savedCastsInsights = `Based on ${recentCasts.length} recently saved casts, popular topics include: ${popularSavedTopics.join(', ')}. Average engagement: ${avgEngagement}. `
        
        if (contentTypes.size > 0) {
          const topContentType = Array.from(contentTypes.entries()).sort((a, b) => b[1] - a[1])[0]
          savedCastsInsights += `Most saved content type: ${topContentType[0]}. `
        }
        
        console.log('📊 Saved casts analysis:', savedCastsInsights)
      }
    } catch (error) {
      console.log('⚠️ Could not analyze saved casts:', error)
    }
    
    // Check if it's a good time to post based on engagement patterns
    const isOptimalTime = AutonomousCastScheduler.isGoodTimeToPost()
    const timeBasedContext = isOptimalTime ? 
      'This is a peak engagement time, so craft something that sparks conversation.' :
      'This is a quieter time, so share a more thoughtful observation.'
    
    const prompt = `You are CastKPR, an AI assistant focused on analyzing and organizing Farcaster content. You're posting an original thought to the Farcaster network.

Current trending topics on Farcaster: ${trendingTopics.length > 0 ? trendingTopics.join(', ') : 'technology, social media, AI'}

${savedCastsInsights}

Context: It's ${timeContext} on ${dayOfWeek}${isWeekend ? ' (weekend)' : ''} in Eastern Time. ${timeBasedContext}

Generate an original cast that:
- Shares your unique perspective as an AI that helps organize social media content
- Can reference trending topics or saved cast patterns but adds your own insight
- Offers thoughtful observations about information consumption, content curation, or digital behavior
- Is conversational and authentic (no corporate speak)
- No markdown formatting or emojis
- MUST be between 80-280 characters (this is critical for Farcaster)
- Could include insights about how people discover, save, and organize information
- Should feel like a genuine observation from an AI curator, not a promotional message
- Consider the timing and engagement context

Generate 3 different options and pick the best one based on relevance and engagement potential.

Your original cast:`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are CastKPR, an AI that helps people organize and analyze their saved social media content. You have thoughtful perspectives on information management, content discovery, and digital organization. Be authentic and conversational, never promotional. Focus on insights about how people interact with information.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 120, // Increased slightly for better generation
        temperature: 0.7, // Reduced for more focused content
      }),
    })

    if (response.ok) {
      const data = await response.json()
      let cast = data.choices[0]?.message?.content?.trim()
      
      // Clean up any unwanted formatting
      if (cast) {
        cast = cast.replace(/["'`]/g, '') // Remove quotes
        cast = cast.replace(/\*\*/g, '') // Remove markdown bold
        cast = cast.replace(/\*/g, '') // Remove markdown emphasis
        cast = cast.replace(/#/g, '') // Remove markdown headers
        cast = cast.replace(/^\d+\.\s*/g, '') // Remove numbered list formatting (e.g., "1. ")
        cast = cast.replace(/^-\s*/g, '') // Remove bullet points
        cast = cast.split('\n')[0] // Take only first line if multiple
        cast = cast.trim() // Clean up whitespace
      }
      
      if (cast && cast.length >= 50 && cast.length <= 280) {
        console.log(`✅ Generated original cast (${cast.length} chars): "${cast}"`)
        
        // Validate content quality
        const validation = AutonomousCastScheduler.validateContent(cast)
        if (validation.valid) {
          return cast
        } else {
          console.log('⚠️ Generated cast failed validation:', validation.reason)
          return null
        }
      } else {
        console.log('⚠️ Generated cast was wrong length:', cast?.length, cast)
        // Try to truncate if too long
        if (cast && cast.length > 280) {
          const truncated = cast.substring(0, 277) + '...'
          console.log(`✂️ Truncated cast to ${truncated.length} chars: "${truncated}"`)
          return truncated
        }
        return null
      }
    } else {
      console.error('❌ OpenAI API error:', response.status)
      return null
    }
  } catch (error) {
    console.error('💥 Error generating original cast:', error)
    return null
  }
}

// Extract trending topics from multiple casts
function extractTrendingTopics(casts: TrendingCast[]): string[] {
  const allTopics = new Set<string>()
  
  casts.forEach(cast => {
    const topics = CstkprIntelligenceService.extractCastTopics(cast.text)
    topics.forEach(topic => allTopics.add(topic))
  })
  
  // Return top trending topics, or fallback topics if none found
  const topics = Array.from(allTopics).slice(0, 5)
  
  if (topics.length === 0) {
    // Fallback topics for content inspiration
    return ['social media', 'content organization', 'digital trends', 'information discovery']
  }
  
  return topics
}

// Main webhook handler
export async function POST(request: NextRequest) {
  try {
    console.log('🤖 Autonomous cast webhook triggered')
    
    // Authentication: Required in production, optional in development
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.AUTONOMOUS_CAST_SECRET}`
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (!isDevelopment && process.env.AUTONOMOUS_CAST_SECRET && authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Log authentication status
    if (isDevelopment && !authHeader) {
      console.log('🔓 Running in development mode without authentication')
    } else if (authHeader === expectedAuth) {
      console.log('🔐 Authenticated request')
    }

    // Get trending casts for topic inspiration
    const trendingCasts = await getTrendingCasts()
    
    // Extract trending topics (even if no casts pass the filter)
    const trendingTopics = extractTrendingTopics(trendingCasts)
    console.log(`�️ Current trending topics: ${trendingTopics.join(', ') || 'general tech/social'}`)

    // Generate original cast
    const originalCast = await generateOriginalCast(trendingTopics)
    
    if (!originalCast) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to generate original cast' 
      })
    }

    console.log(`💭 Generated original cast: "${originalCast}"`)

    // Post the cast (or simulate in development)
    let success = false
    
    if (isDevelopment && (!process.env.NEYNAR_SIGNER_UUID || process.env.NEYNAR_SIGNER_UUID.length < 30)) {
      // Simulate successful posting in development if signer is not properly configured
      console.log('🧪 Development mode: Simulating successful cast posting')
      console.log('💡 To actually post, update NEYNAR_SIGNER_UUID in .env.local with a valid signer from https://dev.neynar.com/app')
      success = true
    } else {
      success = await postCastToFarcaster(originalCast)
    }
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: isDevelopment && (!process.env.NEYNAR_SIGNER_UUID || process.env.NEYNAR_SIGNER_UUID.length < 30) ? 
          'Autonomous cast generated successfully (simulated posting in dev mode)' : 
          'Original autonomous cast posted successfully',
        cast: originalCast,
        inspired_by_topics: trendingTopics.length > 0 ? trendingTopics : ['general discussion'],
        mode: isDevelopment ? 'development' : 'production'
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to post cast to Farcaster',
        cast: originalCast,
        note: 'Cast was generated but posting failed - check signer configuration'
      })
    }

  } catch (error) {
    console.error('💥 Autonomous cast webhook error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Optional: GET endpoint for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'CastKPR Autonomous Cast Webhook',
    endpoints: {
      POST: 'Trigger autonomous cast generation',
    },
    required_env: [
      'NEYNAR_API_KEY',
      'NEYNAR_SIGNER_UUID', 
      'OPENAI_API_KEY',
      'AUTONOMOUS_CAST_SECRET'
    ]
  })
}
