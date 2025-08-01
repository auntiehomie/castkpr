import { NextRequest, NextResponse } from 'next/server'
import { CastService, supabase } from '@/lib/supabase'
import { analyzeCast } from '@/lib/cast-analyzer'
import type { SavedCast } from '@/lib/supabase'
import type { AnalyzedCast } from '@/lib/cast-analyzer'

interface NeynarReplyResponse {
  success: boolean
  cast?: {
    hash: string
    author: {
      username: string
    }
  }
  message?: string
}

/**
 * Posts a reply cast using Neynar API
 */
async function postReplyWithNeynar(
  text: string, 
  parentHash: string, 
  signerUuid: string
): Promise<NeynarReplyResponse> {
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
  
  if (!NEYNAR_API_KEY) {
    console.error('❌ NEYNAR_API_KEY not found')
    return { success: false, message: 'API key not configured' }
  }

  try {
    console.log('📤 Posting reply with Neynar API...')
    
    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        text: text,
        parent: parentHash
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Neynar reply error:', response.status, errorText)
      return { 
        success: false, 
        message: `API error: ${response.status}` 
      }
    }

    const data = await response.json()
    console.log('✅ Reply posted successfully')
    return { success: true, cast: data.cast }

  } catch (error) {
    console.error('❌ Error posting reply:', error)
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Formats analysis results into a conversational response
 */
function formatAnalysisResponse(analysis: AnalyzedCast): string {
  const { text, author, reactions, parsed_data, channel } = analysis
  
  // Build response parts
  const parts: string[] = []
  
  // Header
  parts.push(`🔍 **Cast Analysis for @${author.username}**`)
  
  // Basic stats
  const stats = [
    `❤️ ${reactions.likes_count} likes`,
    `🔄 ${reactions.recasts_count} recasts`,
    `💬 ${analysis.replies.count} replies`
  ]
  parts.push(`📊 ${stats.join(' • ')}`)
  
  // Content insights
  if (parsed_data.word_count) {
    parts.push(`📝 ${parsed_data.word_count} words`)
  }
  
  // Sentiment
  const sentimentEmoji = {
    positive: '😊',
    negative: '😔',
    neutral: '😐'
  }
  parts.push(`${sentimentEmoji[parsed_data.sentiment as keyof typeof sentimentEmoji] || '😐'} Sentiment: ${parsed_data.sentiment || 'neutral'}`)
  
  // Topics
  if (parsed_data.topics && parsed_data.topics.length > 0) {
    parts.push(`🏷️ Topics: ${parsed_data.topics.slice(0, 3).join(', ')}`)
  }
  
  // URLs
  if (parsed_data.urls && parsed_data.urls.length > 0) {
    parts.push(`🔗 Contains ${parsed_data.urls.length} link${parsed_data.urls.length !== 1 ? 's' : ''}`)
  }
  
  // Mentions
  if (parsed_data.mentions && parsed_data.mentions.length > 0) {
    parts.push(`👥 Mentions ${parsed_data.mentions.length} user${parsed_data.mentions.length !== 1 ? 's' : ''}`)
  }
  
  // Channel
  if (channel) {
    parts.push(`📺 Posted in /${channel.id}`)
  }
  
  // Join with line breaks for readability
  return parts.join('\n')
}

/**
 * Formats save confirmation response
 */
function formatSaveResponse(cast: SavedCast): string {
  return `✅ **Cast Saved!**

📝 From: @${cast.username}
💾 Saved to your collection
🔗 ${cast.cast_url}

Use the dashboard to view all saved casts!`
}

/**
 * Formats help response
 */
function formatHelpResponse(): string {
  return `🤖 **CastKPR Bot Commands**

💾 \`@cstkpr save this\` - Save the parent cast
🔍 \`@cstkpr analyze this\` - Analyze the parent cast
📊 \`@cstkpr stats\` - View your save statistics
❓ \`@cstkpr help\` - Show this help message

Dashboard: [View your saved casts](https://your-app.vercel.app/dashboard)`
}

/**
 * Formats stats response
 */
function formatStatsResponse(stats: { totalCasts: number }, username: string): string {
  return `📊 **Stats for @${username}**

💾 Total saved casts: ${stats.totalCasts}
⏰ Last updated: ${new Date().toLocaleDateString()}

Keep saving great content! 🚀`
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Enhanced webhook received!')
    
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
    const mentionsBot = mentions.some((profile: { username?: string }) => {
      return profile.username === 'cstkpr'
    })
    
    console.log('🤖 Bot mentioned?', mentionsBot)
    
    if (!mentionsBot) {
      console.log('❌ Bot not mentioned, skipping')
      return NextResponse.json({ message: 'Bot not mentioned' })
    }
    
    const text = cast.text.toLowerCase()
    console.log('💬 Cast text:', text)
    
    // Enhanced command detection
    const commands = {
      save: text.includes('save this') || text.includes('save'),
      analyze: text.includes('analyze this') || text.includes('analyze'),
      quality: text.includes('quality') || text.includes('rate'),
      sentiment: text.includes('sentiment') || text.includes('feeling'),
      topics: text.includes('topics') || text.includes('categories'),
      help: text.includes('help') || text.includes('commands'),
      stats: text.includes('stats') || text.includes('statistics')
    }
    
    console.log('🔍 Enhanced command detection:', commands)
    
    const parentHash = cast.parent_hash
    const signerUuid = process.env.NEYNAR_SIGNER_UUID // You'll need to set this
    
    // Handle different commands
    if (commands.help) {
      console.log('❓ Help command detected')
      
      if (signerUuid) {
        const response = formatHelpResponse()
        await postReplyWithNeynar(response, cast.hash, signerUuid)
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Help response sent' 
      })
    }
    
    if (commands.stats) {
      console.log('📊 Stats command detected')
      
      try {
        const stats = await CastService.getUserStats(cast.author.username)
        
        if (signerUuid) {
          const response = formatStatsResponse(stats, cast.author.username)
          await postReplyWithNeynar(response, cast.hash, signerUuid)
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Stats response sent',
          stats 
        })
      } catch (error) {
        console.error('❌ Error fetching stats:', error)
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
      }
    }
    
    if (commands.analyze) {
      console.log('🔍 Enhanced analyze command detected')
      
      if (!parentHash) {
        console.log('❌ No parent cast to analyze')
        
        if (signerUuid) {
          await postReplyWithNeynar(
            '❌ No parent cast found to analyze. Reply to a cast with "@cstkpr analyze this"',
            cast.hash,
            signerUuid
          )
        }
        
        return NextResponse.json({ message: 'No parent cast to analyze' })
      }
      
      try {
        const analysis = await analyzeCast(parentHash)
        
        if (analysis) {
          console.log('✅ Analysis completed successfully')
          
          if (signerUuid) {
            const response = formatAnalysisResponse(analysis)
            const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
            
            if (replyResult.success) {
              console.log('✅ Analysis response sent successfully')
            } else {
              console.error('❌ Failed to send analysis response:', replyResult.message)
            }
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Analysis completed and response sent',
            analysis: {
              hash: analysis.hash,
              sentiment: analysis.parsed_data.sentiment,
              topics: analysis.parsed_data.topics,
              engagement: analysis.reactions
            }
          })
        } else {
          console.log('❌ Analysis failed')
          
          if (signerUuid) {
            await postReplyWithNeynar(
              '❌ Sorry, I couldn\'t analyze that cast. It might be private or unavailable.',
              cast.hash,
              signerUuid
            )
          }
          
          return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
        }
      } catch (error) {
        console.error('❌ Error in analysis:', error)
        return NextResponse.json({ error: 'Analysis error' }, { status: 500 })
      }
    }
    
    if (commands.save) {
      console.log('💾 Save command detected')
      
      if (!parentHash) {
        console.log('❌ No parent cast to save')
        
        if (signerUuid) {
          await postReplyWithNeynar(
            '❌ No parent cast found to save. Reply to a cast with "@cstkpr save this"',
            cast.hash,
            signerUuid
          )
        }
        
        return NextResponse.json({ message: 'No parent cast to save' })
      }
      
      try {
        // First analyze the cast to get full data
        const analysis = await analyzeCast(parentHash)
        
        if (analysis) {
          // Convert analysis to SavedCast format
          const castData = {
            username: analysis.author.username,
            fid: analysis.author.fid,
            cast_hash: parentHash,
            cast_content: analysis.text,
            cast_timestamp: analysis.timestamp,
            tags: analysis.parsed_data.topics || ['saved-via-bot'],
            likes_count: analysis.reactions.likes_count,
            replies_count: analysis.replies.count,
            recasts_count: analysis.reactions.recasts_count,
            cast_url: analysis.cast_url,
            author_pfp_url: analysis.author.pfp_url,
            author_display_name: analysis.author.display_name,
            saved_by_user_id: cast.author.username,
            category: 'saved-via-bot',
            notes: `💾 Saved via @cstkpr bot by ${cast.author.username} on ${new Date().toLocaleDateString()}`,
            parsed_data: analysis.parsed_data
          } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
          
          const savedCast = await CastService.saveCast(castData)
          console.log('✅ Cast saved successfully:', savedCast.cast_hash)
          
          if (signerUuid) {
            const response = formatSaveResponse(savedCast)
            await postReplyWithNeynar(response, cast.hash, signerUuid)
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Cast saved and response sent',
            cast_id: savedCast.cast_hash,
            saved_cast_id: savedCast.id
          })
        } else {
          // Fallback to basic save without analysis
          const castData = {
            username: `user-${cast.parent_author?.fid || 'unknown'}`,
            fid: cast.parent_author?.fid || 0,
            cast_hash: parentHash,
            cast_content: `🔗 Cast saved from Farcaster - Hash: ${parentHash}`,
            cast_timestamp: new Date().toISOString(),
            tags: ['saved-via-bot'] as string[],
            likes_count: 0,
            replies_count: 0,
            recasts_count: 0,
            cast_url: `https://warpcast.com/~/conversations/${parentHash}`,
            author_pfp_url: undefined,
            author_display_name: `User ${cast.parent_author?.fid || 'Unknown'}`,
            saved_by_user_id: cast.author.username,
            category: 'saved-via-bot',
            notes: `💾 Saved via @cstkpr bot by ${cast.author.username} on ${new Date().toLocaleDateString()}`,
            parsed_data: {
              urls: [`https://warpcast.com/~/conversations/${parentHash}`],
              hashtags: ['cstkpr', 'saved'],
              mentions: ['cstkpr'],
              word_count: 0,
              sentiment: 'neutral' as const,
              topics: ['saved-cast']
            }
          } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
          
          const savedCast = await CastService.saveCast(castData)
          
          if (signerUuid) {
            const response = formatSaveResponse(savedCast)
            await postReplyWithNeynar(response, cast.hash, signerUuid)
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Cast saved (fallback) and response sent',
            cast_id: savedCast.cast_hash
          })
        }
      } catch (saveError) {
        console.error('❌ Error saving cast:', saveError)
        
        if (signerUuid) {
          await postReplyWithNeynar(
            '❌ Sorry, I couldn\'t save that cast. It might already be saved or there was an error.',
            cast.hash,
            signerUuid
          )
        }
        
        return NextResponse.json({ error: 'Failed to save cast' }, { status: 500 })
      }
    }
    
    // Default response for unrecognized commands
    if (signerUuid) {
      await postReplyWithNeynar(
        '🤖 I didn\'t recognize that command. Try "@cstkpr help" for available commands!',
        cast.hash,
        signerUuid
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Bot mentioned but no recognized command' 
    })
    
  } catch (error) {
    console.error('💥 Enhanced webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}