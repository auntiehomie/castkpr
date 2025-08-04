import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import { analyzeCast } from '@/lib/cast-analyzer'
import type { SavedCast, ParsedData } from '@/lib/supabase'
import type { AnalyzedCast } from '@/lib/cast-analyzer'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
 * Enhanced AI-powered cast analysis using OpenAI
 */
async function generateAIAnalysis(analysis: AnalyzedCast): Promise<{
  summary: string
  insights: string[]
  tone: string
  keyPoints: string[]
}> {
  try {
    const { text, author, reactions, parsed_data, channel } = analysis
    
    // Create a comprehensive prompt for GPT
    const prompt = `
You are analyzing a Farcaster social media post. Provide a thoughtful, conversational analysis.

POST DETAILS:
Author: @${author.username}
Text: "${text}"
Channel: ${channel?.id || 'general feed'}
Engagement: ${reactions.likes_count} likes, ${reactions.recasts_count} recasts, ${analysis.replies.count} replies
Topics detected: ${parsed_data.topics?.join(', ') || 'none'}
Links: ${parsed_data.urls?.length || 0}
Mentions: ${parsed_data.mentions?.length || 0}

Please provide:
1. SUMMARY: A 2-3 sentence conversational summary of what this post is really about (not just restating the text, but explaining the context, meaning, or significance)
2. INSIGHTS: 2-3 bullet points of interesting observations about the content, style, or implications
3. TONE: A nuanced description of the author's tone/mood (beyond just positive/negative/neutral)
4. KEY_POINTS: The main takeaways or important points the author is making

Format as JSON:
{
  "summary": "conversational summary here",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "tone": "nuanced tone description",
  "keyPoints": ["point 1", "point 2"]
}
`

    console.log('🤖 Requesting AI analysis from OpenAI...')
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-effective model
      messages: [
        {
          role: "system",
          content: "You are a skilled social media analyst who provides insightful, conversational analysis of posts. Focus on meaning, context, and deeper insights rather than surface-level observations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    const aiAnalysis = JSON.parse(response)
    console.log('✅ AI analysis completed')
    
    return aiAnalysis

  } catch (error) {
    console.error('❌ Error in AI analysis:', error)
    
    // Fallback to basic analysis if AI fails
    return {
      summary: `@${analysis.author.username} shared a ${analysis.parsed_data.word_count || 0 > 50 ? 'detailed' : 'brief'} post about ${analysis.parsed_data.topics?.[0] || 'their thoughts'}.`,
      insights: [
        `Post received ${analysis.reactions.likes_count + analysis.reactions.recasts_count} total engagements`,
        `Written in a ${analysis.parsed_data.sentiment || 'neutral'} tone`
      ],
      tone: analysis.parsed_data.sentiment || 'neutral',
      keyPoints: analysis.parsed_data.topics?.slice(0, 2) || ['General discussion']
    }
  }
}

/**
 * Enhanced conversational response with AI analysis
 */
async function formatAnalysisResponse(analysis: AnalyzedCast): Promise<string> {
  const { author, reactions, parsed_data, channel } = analysis
  
  // Get AI-powered analysis
  const aiAnalysis = await generateAIAnalysis(analysis)
  
  const parts: string[] = []
  
  // 🤖 AI Summary Section
  parts.push(`🤖 **Cast Analysis**`)
  parts.push(aiAnalysis.summary)
  
  // 💡 Key Insights
  if (aiAnalysis.insights.length > 0) {
    parts.push('') // Empty line
    parts.push(`💡 **Key Insights**`)
    aiAnalysis.insights.forEach(insight => {
      parts.push(`• ${insight}`)
    })
  }
  
  // 🎯 Main Points
  if (aiAnalysis.keyPoints.length > 0) {
    parts.push('') // Empty line
    parts.push(`🎯 **Main Points**`)
    aiAnalysis.keyPoints.forEach(point => {
      parts.push(`• ${point}`)
    })
  }
  
  parts.push('') // Empty line
  
  // 📊 Quick Stats
  parts.push(`📊 **Stats & Details**`)
  
  const stats = [
    `❤️ ${reactions.likes_count} likes`,
    `🔄 ${reactions.recasts_count} recasts`,
    `💬 ${analysis.replies.count} replies`
  ]
  parts.push(`📈 **Engagement:** ${stats.join(' • ')}`)
  
  if (parsed_data.word_count) {
    parts.push(`📝 **Length:** ${parsed_data.word_count} words`)
  }
  
  parts.push(`🎭 **Tone:** ${aiAnalysis.tone}`)
  
  // Content elements
  const contentElements: string[] = []
  if (parsed_data.urls && parsed_data.urls.length > 0) {
    contentElements.push(`${parsed_data.urls.length} link${parsed_data.urls.length !== 1 ? 's' : ''}`)
  }
  if (parsed_data.mentions && parsed_data.mentions.length > 0) {
    contentElements.push(`${parsed_data.mentions.length} mention${parsed_data.mentions.length !== 1 ? 's' : ''}`)
  }
  if (parsed_data.hashtags && parsed_data.hashtags.length > 0) {
    contentElements.push(`${parsed_data.hashtags.length} hashtag${parsed_data.hashtags.length !== 1 ? 's' : ''}`)
  }
  
  if (contentElements.length > 0) {
    parts.push(`🔗 **Contains:** ${contentElements.join(', ')}`)
  }
  
  if (channel) {
    parts.push(`📺 **Channel:** /${channel.id}`)
  }
  
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
    
    // 🛡️ Prevent bot from responding to itself
    if (cast.author.username === 'cstkpr') {
      console.log('🤖 Ignoring cast from bot itself to prevent loops')
      return NextResponse.json({ message: 'Ignoring bot self-cast' })
    }
    
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
    const signerUuid = process.env.NEYNAR_SIGNER_UUID
    const apiKey = process.env.NEYNAR_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    
    // 🔍 DEBUG: Environment Variables
    console.log('🔍 Environment Debug:')
    console.log('- NEYNAR_API_KEY exists?', !!apiKey)
    console.log('- NEYNAR_API_KEY first 8 chars:', apiKey?.substring(0, 8) || 'MISSING')
    console.log('- NEYNAR_SIGNER_UUID exists?', !!signerUuid)
    console.log('- NEYNAR_SIGNER_UUID first 8 chars:', signerUuid?.substring(0, 8) || 'MISSING')
    console.log('- OPENAI_API_KEY exists?', !!openaiKey)
    console.log('- OPENAI_API_KEY first 8 chars:', openaiKey?.substring(0, 8) || 'MISSING')
    console.log('- All env vars:', Object.keys(process.env).filter(key => key.includes('NEYNAR') || key.includes('OPENAI')))

    if (!signerUuid) {
      console.error('❌ NEYNAR_SIGNER_UUID is undefined!')
      return NextResponse.json({ 
        error: 'Bot configuration error - signer not found',
        debug: {
          has_api_key: !!apiKey,
          has_signer: !!signerUuid,
          has_openai: !!openaiKey,
          env_keys: Object.keys(process.env).filter(key => key.includes('NEYNAR') || key.includes('OPENAI'))
        }
      }, { status: 500 })
    }
    if (!apiKey) {
      console.error('❌ NEYNAR_API_KEY is undefined!')
      return NextResponse.json({ 
        error: 'Bot configuration error - API key not found'
      }, { status: 500 })
    }
    
    // Handle different commands
    if (commands.help) {
      console.log('❓ Help command detected')
      
      if (signerUuid) {
        const response = formatHelpResponse()
        const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
        console.log('📤 Help reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
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
          const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
          console.log('📤 Stats reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
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
          const replyResult = await postReplyWithNeynar(
            '❌ No parent cast found to analyze. Reply to a cast with "@cstkpr analyze this"',
            cast.hash,
            signerUuid
          )
          console.log('📤 Error reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
        }
        
        return NextResponse.json({ message: 'No parent cast to analyze' })
      }
      
      try {
        const analysis = await analyzeCast(parentHash)
        
        if (analysis) {
          console.log('✅ Analysis completed successfully')
          
          if (signerUuid) {
            // NOTE: formatAnalysisResponse is now async and needs await
            const response = await formatAnalysisResponse(analysis)
            console.log('📝 Formatted response length:', response.length)
            console.log('📤 About to post reply with signer:', signerUuid.substring(0, 8) + '...')
            
            const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
            
            if (replyResult.success) {
              console.log('✅ Analysis response sent successfully')
            } else {
              console.error('❌ Failed to send analysis response:', replyResult.message)
            }
          } else {
            console.error('❌ No signer UUID available for reply')
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
            const replyResult = await postReplyWithNeynar(
              '❌ Sorry, I couldn\'t analyze that cast. It might be private or unavailable.',
              cast.hash,
              signerUuid
            )
            console.log('📤 Failure reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
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
          const replyResult = await postReplyWithNeynar(
            '❌ No parent cast found to save. Reply to a cast with "@cstkpr save this"',
            cast.hash,
            signerUuid
          )
          console.log('📤 Error reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
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
            const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
            console.log('📤 Save reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
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
            const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
            console.log('📤 Fallback save reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
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
          const replyResult = await postReplyWithNeynar(
            '❌ Sorry, I couldn\'t save that cast. It might already be saved or there was an error.',
            cast.hash,
            signerUuid
          )
          console.log('📤 Save error reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
        }
        
        return NextResponse.json({ error: 'Failed to save cast' }, { status: 500 })
      }
    }
    
    // Default response for unrecognized commands
    if (signerUuid) {
      const replyResult = await postReplyWithNeynar(
        '🤖 I didn\'t recognize that command. Try "@cstkpr help" for available commands!',
        cast.hash,
        signerUuid
      )
      console.log('📤 Default reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
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