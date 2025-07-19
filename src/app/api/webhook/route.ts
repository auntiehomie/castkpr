import { NextRequest, NextResponse } from 'next/server'
import { CastService, ContentParser } from '@/lib/supabase'
import { AIService } from '@/lib/ai'
import type { SavedCast } from '@/lib/supabase'

// Add your Neynar API key to your environment variables
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

async function fetchCastByHash(castHash: string) {
  if (!NEYNAR_API_KEY) {
    console.error('❌ NEYNAR_API_KEY not set')
    return null
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`,
      {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        }
      }
    )

    if (!response.ok) {
      console.error(`❌ Neynar API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    return data.cast
  } catch (error) {
    console.error('❌ Error fetching cast from Neynar:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Webhook received!')
    
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
    
    // Parse command from cast text
    const text = cast.text.toLowerCase()
    console.log('💬 Cast text:', text)
    
    // Check for different command types
    const isSaveCommand = text.includes('save this') || text.includes('save')
    const isAnalyzeCommand = text.includes('analyze this') || text.includes('analyze')
    const isAskCommand = text.includes('ask ')
    const isHelpCommand = text.includes('help')
    const isStatsCommand = text.includes('stats')
    const isInsightsCommand = text.includes('insights')
    
    console.log('🔍 Command detection:', {
      save: isSaveCommand,
      analyze: isAnalyzeCommand, 
      ask: isAskCommand,
      help: isHelpCommand,
      stats: isStatsCommand,
      insights: isInsightsCommand
    })

    // Handle HELP command
    if (isHelpCommand) {
      console.log('❓ Help command detected')
      return NextResponse.json({
        success: true,
        message: 'CastKPR Bot Commands',
        commands: [
          '@cstkpr save this - Save any cast',
          '@cstkpr analyze this - AI analysis of cast',
          '@cstkpr ask "question" - Ask about your saves',
          '@cstkpr stats - Your save statistics',
          '@cstkpr insights - AI insights about your saves',
          '@cstkpr help - Show this help'
        ]
      })
    }

    // Handle STATS command
    if (isStatsCommand) {
      console.log('📊 Stats command detected')
      try {
        const stats = await CastService.getUserStats(cast.author.username)
        return NextResponse.json({
          success: true,
          message: `Your CastKPR Stats`,
          stats: {
            totalCasts: stats.totalCasts,
            user: cast.author.username
          }
        })
      } catch (error) {
        console.error('❌ Error fetching stats:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to fetch your stats'
        })
      }
    }

    // Handle INSIGHTS command
    if (isInsightsCommand) {
      console.log('💡 Insights command detected')
      try {
        const userCasts = await CastService.getUserCasts(cast.author.username, 50)
        
        if (userCasts.length === 0) {
          return NextResponse.json({
            success: true,
            message: "You don't have any saved casts yet! Start saving some casts first."
          })
        }

        const castsForAI = userCasts.map(savedCast => ({
          content: savedCast.cast_content,
          author: savedCast.username
        }))

        const insights = await AIService.generateInsights(castsForAI)
        
        return NextResponse.json({
          success: true,
          message: 'AI Insights Generated',
          insights: {
            topTopics: insights.topTopics,
            patterns: insights.interestingPatterns,
            recommendedFollows: insights.recommendedFollows,
            summary: insights.summary,
            totalCasts: userCasts.length
          }
        })
      } catch (error) {
        console.error('❌ Error generating insights:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to generate AI insights'
        })
      }
    }

    // Handle ASK command
    if (isAskCommand) {
      console.log('❓ Ask command detected')
      try {
        // Extract question from cast text
        const questionMatch = text.match(/ask\s+["']([^"']+)["']/) || text.match(/ask\s+(.+)/)
        const question = questionMatch?.[1]?.trim()
        
        if (!question) {
          return NextResponse.json({
            success: false,
            message: 'Please provide a question after "ask". Example: @cstkpr ask "what topics am I interested in?"'
          })
        }

        const userCasts = await CastService.getUserCasts(cast.author.username, 50)
        
        if (userCasts.length === 0) {
          return NextResponse.json({
            success: true,
            message: "You don't have any saved casts yet! Start saving some casts first, then ask me questions about them."
          })
        }

        const castsForAI = userCasts.map(savedCast => ({
          content: savedCast.cast_content,
          author: savedCast.username,
          timestamp: savedCast.cast_timestamp
        }))

        const aiResponse = await AIService.chatAboutCasts(question, castsForAI)
        
        return NextResponse.json({
          success: true,
          message: 'AI Response',
          question: question,
          answer: aiResponse,
          castsAnalyzed: userCasts.length
        })
      } catch (error) {
        console.error('❌ Error processing ask command:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to process your question'
        })
      }
    }

    // Handle ANALYZE command
    if (isAnalyzeCommand) {
      console.log('🔍 Analyze command detected')
      const parentHash = cast.parent_hash
      
      if (!parentHash) {
        return NextResponse.json({
          success: false,
          message: 'No cast to analyze. Reply to a cast with "@cstkpr analyze this"'
        })
      }

      try {
        const parentCast = await fetchCastByHash(parentHash)
        
        if (!parentCast) {
          return NextResponse.json({
            success: false,
            message: 'Could not fetch cast data for analysis'
          })
        }

        const analysis = await AIService.analyzeCast(parentCast.text, parentCast.author.username)
        
        return NextResponse.json({
          success: true,
          message: 'AI Analysis Complete',
          analysis: {
            sentiment: analysis.sentiment,
            topics: analysis.topics,
            keyInsights: analysis.keyInsights,
            summary: analysis.summary,
            author: parentCast.author.username,
            contentPreview: parentCast.text.slice(0, 100) + (parentCast.text.length > 100 ? '...' : '')
          }
        })
      } catch (error) {
        console.error('❌ Error analyzing cast:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to analyze cast'
        })
      }
    }

    // Handle SAVE command (existing functionality)
    if (isSaveCommand) {
      console.log('💾 Save command detected')
      
      // Check for parent hash
      const parentHash = cast.parent_hash
      console.log('👆 Parent hash:', parentHash)
      
      if (!parentHash) {
        console.log('❌ No parent cast to save')
        return NextResponse.json({ message: 'No parent cast to save' })
      }
      
      // Fetch the actual parent cast data from Neynar
      console.log('🔍 Fetching parent cast data from Neynar...')
      const parentCast = await fetchCastByHash(parentHash)
      
      if (!parentCast) {
        console.log('❌ Failed to fetch parent cast data')
        return NextResponse.json({ error: 'Could not fetch parent cast data' }, { status: 500 })
      }
      
      console.log('✅ Parent cast fetched successfully')
      console.log('📝 Parent cast author:', parentCast.author.username)
      console.log('📝 Parent cast text length:', parentCast.text.length)
      console.log('🖼️ Profile picture URL:', parentCast.author.pfp_url || 'Not available')
      
      // Parse the content for additional data
      const parsedData = ContentParser.parseContent(parentCast.text)
      
      // Generate fallback avatar if no pfp_url
      const authorPfpUrl = parentCast.author.pfp_url || 
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${parentCast.author.fid || parentCast.author.username}`
      
      // Create cast data with actual parent cast information
      const castData = {
        username: parentCast.author.username,
        fid: parentCast.author.fid,
        cast_hash: parentHash,
        cast_content: parentCast.text,
        cast_timestamp: parentCast.timestamp,
        tags: [...(parsedData.hashtags || []), 'saved-via-bot'] as string[],
        likes_count: parentCast.reactions?.likes?.length || 0,
        replies_count: parentCast.replies?.count || 0,
        recasts_count: parentCast.reactions?.recasts?.length || 0,
        
        // Optional fields with actual data and fallbacks
        cast_url: `https://warpcast.com/${parentCast.author.username}/${parentHash.slice(0, 10)}`,
        author_pfp_url: authorPfpUrl, // Use actual pfp or generated fallback
        author_display_name: parentCast.author.display_name || parentCast.author.username,
        saved_by_user_id: cast.author.username, // The person who mentioned the bot
        category: 'saved-via-bot',
        notes: `💾 Saved via @cstkpr bot by ${cast.author.username} on ${new Date().toLocaleDateString()}`,
        parsed_data: {
          ...parsedData,
          urls: [...(parsedData.urls || []), ...extractEmbeds(parentCast.embeds)],
          mentions: [...(parsedData.mentions || []), 'cstkpr'],
          hashtags: [...(parsedData.hashtags || []), 'cstkpr', 'saved'],
          topics: [...(parsedData.topics || []), 'saved-cast']
        }
      } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
      
      console.log('💾 Saving cast data...')
      console.log('🖼️ Final avatar URL being saved:', authorPfpUrl)
      
      // Save to database
      try {
        const savedCast = await CastService.saveCast(castData)
        console.log('✅ Cast saved successfully:', savedCast.cast_hash)
        
        return NextResponse.json({ 
          success: true, 
          message: 'Cast saved successfully',
          cast_id: savedCast.cast_hash,
          saved_cast_id: savedCast.id,
          author: parentCast.author.username,
          content_preview: parentCast.text.slice(0, 100) + (parentCast.text.length > 100 ? '...' : ''),
          pfp_saved: !!authorPfpUrl
        })
        
      } catch (saveError) {
        console.error('❌ Error saving cast:', saveError)
        
        // Handle duplicate save gracefully
        if (saveError instanceof Error && saveError.message.includes('already saved')) {
          return NextResponse.json({ 
            success: false,
            message: 'Cast already saved by this user',
            duplicate: true
          })
        }
        
        return NextResponse.json({ 
          error: 'Failed to save cast', 
          details: saveError instanceof Error ? saveError.message : 'Unknown error' 
        }, { status: 500 })
      }
    }

    // If no recognized command
    console.log('❓ No recognized command')
    return NextResponse.json({
      success: false,
      message: 'Command not recognized. Try: @cstkpr help'
    })
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to extract URLs from embeds
interface CastEmbed {
  url?: string;
  [key: string]: unknown;
}

function extractEmbeds(embeds: CastEmbed[] | undefined): string[] {
  if (!embeds || !Array.isArray(embeds)) return []
  
  return embeds
    .filter((embed): embed is CastEmbed & { url: string } => typeof embed?.url === 'string')
    .map(embed => embed.url)
}