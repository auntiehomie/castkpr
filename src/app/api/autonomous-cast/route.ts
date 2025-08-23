// src/app/api/autonomous-cast/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CstkprIntelligenceService } from '@/lib/supabase'

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

  try {
    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: process.env.NEYNAR_SIGNER_UUID, // You'll need to set this
        text: text,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Successfully posted cast:', result.cast.hash)
      return true
    } else {
      const error = await response.text()
      console.error('❌ Failed to post cast:', response.status, error)
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
    // Get trending casts from the last 24 hours
    const response = await fetch('https://api.neynar.com/v2/farcaster/feed/trending?time_window=24h&limit=50', {
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
      console.error('❌ Failed to fetch trending casts:', response.status)
      return []
    }
  } catch (error) {
    console.error('💥 Error fetching trending casts:', error)
    return []
  }
}

// Generate original autonomous cast based on trending topics
async function generateOriginalCast(trendingTopics: string[]): Promise<string | null> {
  try {
    // Current context for inspiration
    const currentHour = new Date().getHours()
    const timeContext = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening'
    const dayOfWeek = new Date().toLocaleDateString('en', { weekday: 'long' })
    
    const prompt = `You are CastKPR, an AI assistant focused on analyzing and organizing Farcaster content. You're posting an original thought to the Farcaster network.

Current trending topics on Farcaster: ${trendingTopics.length > 0 ? trendingTopics.join(', ') : 'technology, social media, AI'}

Context: It's ${timeContext} on ${dayOfWeek}

Generate an original cast that:
- Shares your perspective as an AI that helps organize social media content
- Can reference trending topics but don't just repeat them
- Offers insight about social media, content organization, or digital trends
- Is conversational and authentic (no corporate speak)
- No markdown formatting or emojis
- Between 80-280 characters
- Could include observations about how people share content, organize information, or discover insights
- Should feel like a genuine thought, not a promotional message

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
            content: 'You are CastKPR, an AI that helps people organize and analyze their saved social media content. You have thoughtful perspectives on information management, content discovery, and digital organization. Be authentic and conversational, never promotional.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 120,
        temperature: 0.8,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const cast = data.choices[0]?.message?.content?.trim()
      
      if (cast && cast.length >= 20 && cast.length <= 280) {
        console.log(`✅ Generated original cast (${cast.length} chars): "${cast}"`)
        return cast
      } else {
        console.log('⚠️ Generated cast was too short or too long:', cast?.length, cast)
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
  
  // Return top trending topics
  return Array.from(allTopics).slice(0, 5)
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

    // Post the cast
    const success = await postCastToFarcaster(originalCast)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Original autonomous cast posted successfully',
        cast: originalCast,
        inspired_by_topics: trendingTopics.length > 0 ? trendingTopics : ['general discussion']
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to post cast to Farcaster' 
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
