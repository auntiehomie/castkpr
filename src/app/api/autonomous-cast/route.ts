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

// Generate autonomous opinion based on trending cast
async function generateAutonomousOpinion(cast: TrendingCast): Promise<string | null> {
  try {
    // Extract topics from the cast
    const topics = CstkprIntelligenceService.extractCastTopics(cast.text)
    
    // Build context about the cast
    const engagementLevel = cast.reactions.likes_count + cast.reactions.replies_count + cast.reactions.recasts_count
    const isHighEngagement = engagementLevel > 20
    const channelContext = cast.channel ? ` in /${cast.channel.id}` : ''
    
    const prompt = `You are CastKPR, an AI assistant that analyzes and comments on Farcaster content. You have your own thoughts and opinions.

Original cast by ${cast.author.display_name || cast.author.username}${channelContext}:
"${cast.text}"

This cast has ${engagementLevel} total engagement (${cast.reactions.likes_count} likes, ${cast.reactions.replies_count} replies, ${cast.reactions.recasts_count} recasts).

Topics detected: ${topics.length > 0 ? topics.join(', ') : 'general discussion'}

Write your own thoughtful response as CastKPR. This should be:
- Your own perspective or analysis, not just a summary
- Conversational and natural (no markdown formatting)
- No emojis needed
- Between 50-280 characters for Farcaster
- Add insight, ask a question, or provide a different angle
- Professional but engaging tone

Your response:`

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
            content: 'You are CastKPR, an AI that provides thoughtful commentary on social media content. Be insightful, conversational, and authentic. No markdown or emojis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const opinion = data.choices[0]?.message?.content?.trim()
      
      if (opinion && opinion.length >= 10 && opinion.length <= 280) {
        return opinion
      } else {
        console.log('⚠️ Generated opinion was too short or too long:', opinion?.length)
        return null
      }
    } else {
      console.error('❌ OpenAI API error:', response.status)
      return null
    }
  } catch (error) {
    console.error('💥 Error generating autonomous opinion:', error)
    return null
  }
}

// Main webhook handler
export async function POST(request: NextRequest) {
  try {
    console.log('🤖 Autonomous cast webhook triggered')
    
    // Optional: Add authentication/authorization here
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.AUTONOMOUS_CAST_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get trending casts
    const trendingCasts = await getTrendingCasts()
    
    if (trendingCasts.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No suitable trending casts found' 
      })
    }

    // Select a random cast from the top trending ones
    const selectedCast = trendingCasts[Math.floor(Math.random() * Math.min(5, trendingCasts.length))]
    console.log(`🎯 Selected cast by ${selectedCast.author.username}: "${selectedCast.text.substring(0, 50)}..."`)

    // Generate autonomous opinion
    const opinion = await generateAutonomousOpinion(selectedCast)
    
    if (!opinion) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to generate opinion' 
      })
    }

    console.log(`💭 Generated opinion: "${opinion}"`)

    // Post the cast
    const success = await postCastToFarcaster(opinion)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Autonomous cast posted successfully',
        opinion: opinion,
        based_on: {
          author: selectedCast.author.username,
          content_preview: selectedCast.text.substring(0, 100),
          engagement: selectedCast.reactions.likes_count + selectedCast.reactions.replies_count + selectedCast.reactions.recasts_count
        }
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
