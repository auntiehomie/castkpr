import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import { analyzeCast } from '@/lib/cast-analyzer'
import type { SavedCast } from '@/lib/supabase'
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

// Simple in-memory context for conversations (upgrade to Redis/DB later)
const conversationContext = new Map<string, {
  lastAnalyzedCast?: AnalyzedCast
  lastResponse?: string
  timestamp: number
}>()

// Clean up old contexts periodically (prevent memory leaks)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000)
  for (const [key, value] of conversationContext.entries()) {
    if (value.timestamp < oneHourAgo) {
      conversationContext.delete(key)
    }
  }
}, 10 * 60 * 1000) // Clean every 10 minutes

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
 * Extract terms from natural language questions
 */
function extractTermFromQuery(text: string): string | null {
  const patterns = [
    /what does ([^?]+) mean/i,
    /explain ([^?]+)/i,
    /define ([^?]+)/i,
    /tell me about ([^?]+)/i,
    /what is ([^?]+)/i,
    /what's ([^?]+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim().replace(/[\"\']/g, '')
    }
  }
  
  return null
}

/**
 * NEW: AI-powered thoughtful opinion generation
 */
async function generateThoughtfulOpinion(analysis: AnalyzedCast): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `🤔 I'd need OpenAI to share my thoughts on this cast!`
  }

  try {
    const { text, author, reactions, parsed_data } = analysis
    
    const prompt = `
You are CastKPR, a thoughtful AI assistant analyzing a Farcaster cast. Someone asked "what do you think about this?" 

Give your honest, thoughtful opinion in a conversational tone (under 200 characters).

CAST DETAILS:
Author: @${author.username}
Text: "${text}"
Topics: ${parsed_data.topics?.join(', ') || 'general'}
Sentiment: ${parsed_data.sentiment || 'neutral'}
Engagement: ${reactions.likes_count} likes, ${reactions.recasts_count} recasts

Be conversational, insightful, and give a genuine perspective. You can:
- Agree or disagree respectfully
- Point out interesting aspects
- Share what you find compelling or concerning
- Connect it to broader trends
- Be supportive of good ideas

Format: Just your thoughtful response, no extra text.
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8, // Higher temperature for more personality
      max_tokens: 70
    })

    const thought = completion.choices[0]?.message?.content
    return thought || `🤔 That's an interesting perspective from @${author.username}. I'd need to think more about it!`
    
  } catch (error) {
    console.error('❌ Error generating thoughtful opinion:', error)
    return `🤔 That's thought-provoking! I'd love to share more thoughts but I'm having trouble processing right now.`
  }
}
async function explainTermWithContext(term: string, context?: AnalyzedCast): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `"${term}" - I'd need OpenAI to explain this clearly!`
  }

  try {
    const contextInfo = context 
      ? `Context: This term appeared in a post by @${context.author.username}: "${context.text}"`
      : ''

    const prompt = `
Explain this term in simple, clear language (under 180 characters): "${term}"

${contextInfo}

Focus on:
- What it means in everyday language  
- Why someone might encounter it on social media
- Keep it concise and educational

Format: Just the explanation, no extra text.
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 60
    })

    const explanation = completion.choices[0]?.message?.content
    return explanation || `"${term}" - Let me research that for you next time!`
    
  } catch (error) {
    console.error('❌ Error explaining term:', error)
    return `"${term}" - I'll learn about that and get back to you!`
  }
}

/**
 * Enhanced command detection with conversational patterns
 */
function detectConversationalCommands(text: string) {
  const lowerText = text.toLowerCase()
  
  return {
    // Existing commands
    save: lowerText.includes('save this') || lowerText.includes('save'),
    analyze: lowerText.includes('analyze this') || lowerText.includes('analyze'),
    quality: lowerText.includes('quality') || lowerText.includes('rate'),
    sentiment: lowerText.includes('sentiment') || lowerText.includes('feeling'),
    topics: lowerText.includes('topics') || lowerText.includes('categories'),
    help: lowerText.includes('help') || lowerText.includes('commands'),
    stats: lowerText.includes('stats') || lowerText.includes('statistics'),
    
    // Conversational patterns
    explainWord: /what does (.+) mean|explain (.+)|define (.+)/i.test(text),
    askAbout: /tell me about (.+)|what is (.+)|what's (.+)/i.test(text),
    thanks: lowerText.includes('thank') || lowerText.includes('thanks'),
    followUp: lowerText.includes('tell me more') || lowerText.includes('elaborate'),
    reference: lowerText.includes('that word') || lowerText.includes('it') || 
               lowerText.includes('that term') || lowerText.includes('this'),
    
    // NEW: Opinion/thought requests
    opinion: /what do you think|your thoughts|opinion|what's your take/i.test(text) &&
             (lowerText.includes('this') || lowerText.includes('about')),
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
    const { text, author, reactions, channel } = analysis
    
    // Create a comprehensive prompt for GPT
    const prompt = `
You are analyzing a Farcaster social media post. Provide a thoughtful, conversational analysis.

POST DETAILS:
Author: @${author.username}
Text: "${text}"
Channel: ${channel?.id || 'general feed'}
Engagement: ${reactions.likes_count} likes, ${reactions.recasts_count} recasts, ${analysis.replies.count} replies
Topics detected: ${analysis.parsed_data.topics?.join(', ') || 'none'}
Links: ${analysis.parsed_data.urls?.length || 0}
Mentions: ${analysis.parsed_data.mentions?.length || 0}

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
      model: "gpt-4o-mini",
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
 * Concise analysis response with educational prompt
 */
async function formatAnalysisResponse(analysis: AnalyzedCast): Promise<string> {
  const { reactions } = analysis
  
  // Get AI-powered analysis
  const aiAnalysis = await generateAIAnalysis(analysis)
  
  // Create a very concise response with education prompt
  const engagement = `${reactions.likes_count}❤️ ${reactions.recasts_count}🔄 ${analysis.replies.count}💬`
  const tone = aiAnalysis.tone.split(' ')[0] // Just first word of tone
  
  return `🤖 ${aiAnalysis.summary.split('.')[0]}. 📊 ${engagement} • ${tone} tone • Ask "what does [word] mean?"`
}

/**
 * Formats save confirmation response with educational prompt
 */
function formatSaveResponse(cast: SavedCast): string {
  return `✅ Cast saved from @${cast.username}! Ask me about any words you don't understand.`
}

/**
 * Formats help response with new conversational features
 */
function formatHelpResponse(): string {
  return `🤖 Commands: save this | analyze this | "what do you think?" | stats | help | "what does [word] mean?"`
}

/**
 * Formats stats response (concise)
 */
function formatStatsResponse(stats: { totalCasts: number }, username: string): string {
  return `📊 @${username} has saved ${stats.totalCasts} cast${stats.totalCasts !== 1 ? 's' : ''}! Keep exploring! 🚀`
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Enhanced conversational webhook received!')
    
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
    
    const text = cast.text // Keep original case for better parsing
    console.log('💬 Cast text:', text)
    
    // Enhanced command detection
    const commands = detectConversationalCommands(text)
    
    console.log('🔍 Enhanced command detection:', commands)
    
    const parentHash = cast.parent_hash
    const signerUuid = process.env.NEYNAR_SIGNER_UUID
    const apiKey = process.env.NEYNAR_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const userId = cast.author.username
    
    // 🔍 DEBUG: Environment Variables
    console.log('🔍 Environment Debug:')
    console.log('- NEYNAR_API_KEY exists?', !!apiKey)
    console.log('- NEYNAR_API_KEY first 8 chars:', apiKey?.substring(0, 8) || 'MISSING')
    console.log('- NEYNAR_SIGNER_UUID exists?', !!signerUuid)
    console.log('- NEYNAR_SIGNER_UUID first 8 chars:', signerUuid?.substring(0, 8) || 'MISSING')
    console.log('- OPENAI_API_KEY exists?', !!openaiKey)
    console.log('- OPENAI_API_KEY first 8 chars:', openaiKey?.substring(0, 8) || 'MISSING')

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
    
    // Handle conversational patterns FIRST (before basic commands)
    if (commands.thanks) {
      console.log('💝 Thanks detected')
      
      if (signerUuid) {
        const response = '😊 You\'re welcome! Happy to help you learn!'
        const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
        console.log('📤 Thanks reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Thanks response sent' 
      })
    }
    
    if (commands.explainWord || commands.askAbout) {
      console.log('🔍 Word explanation request detected')
      
      const term = extractTermFromQuery(text)
      if (term) {
        console.log('📚 Explaining term:', term)
        
        // Get context from recent analysis
        const userContext = conversationContext.get(userId)
        const response = await explainTermWithContext(term, userContext?.lastAnalyzedCast)
        
        if (signerUuid) {
          const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
          console.log('📤 Explanation reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
          
          // Save this interaction
          conversationContext.set(userId, {
            ...userContext,
            lastResponse: response,
            timestamp: Date.now()
          })
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Term explanation sent',
          term,
          explanation: response
        })
      } else {
        if (signerUuid) {
          const response = '🤖 What specific word would you like me to explain?'
          await postReplyWithNeynar(response, cast.hash, signerUuid)
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Clarification request sent' 
        })
      }
    }
    
    if (commands.reference || commands.followUp) {
      console.log('🔍 Contextual question detected')
      
      const userContext = conversationContext.get(userId)
      if (userContext?.lastAnalyzedCast) {
        const topics = userContext.lastAnalyzedCast.parsed_data.topics?.join(', ') || 'general topics'
        const response = `🤖 The last cast I analyzed was by @${userContext.lastAnalyzedCast.author.username} about ${topics}. What would you like to know?`
        
        if (signerUuid) {
          const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
          console.log('📤 Context reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Contextual response sent' 
        })
      } else {
        if (signerUuid) {
          const response = '🤖 I\'d need to analyze a cast first to answer questions about it!'
          await postReplyWithNeynar(response, cast.hash, signerUuid)
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Context prompt sent' 
        })
      }
    }
    
    if (commands.opinion) {
      console.log('🤔 Opinion request detected')
      
      if (!parentHash) {
        console.log('❌ No parent cast to give opinion on')
        
        if (signerUuid) {
          const replyResult = await postReplyWithNeynar(
            '🤔 No parent cast found. Reply to a cast with "@cstkpr what do you think about this?"',
            cast.hash,
            signerUuid
          )
          console.log('📤 Error reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
        }
        
        return NextResponse.json({ message: 'No parent cast for opinion' })
      }
      
      try {
        const analysis = await analyzeCast(parentHash)
        
        if (analysis) {
          console.log('✅ Analysis completed, generating opinion')
          
          // Save context for future conversations
          conversationContext.set(userId, {
            lastAnalyzedCast: analysis,
            timestamp: Date.now()
          })
          
          if (signerUuid) {
            const response = await generateThoughtfulOpinion(analysis)
            console.log('📝 Opinion response length:', response.length)
            console.log('📝 Opinion content:', response)
            
            const replyResult = await postReplyWithNeynar(response, cast.hash, signerUuid)
            
            if (replyResult.success) {
              console.log('✅ Opinion response sent successfully')
            } else {
              console.error('❌ Failed to send opinion response:', replyResult.message)
            }
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Opinion completed and response sent',
            analysis: {
              hash: analysis.hash,
              sentiment: analysis.parsed_data.sentiment,
              topics: analysis.parsed_data.topics
            }
          })
        } else {
          console.log('❌ Analysis failed for opinion')
          
          if (signerUuid) {
            const replyResult = await postReplyWithNeynar(
              '🤔 Sorry, I couldn\'t form an opinion on that cast. It might be unavailable.',
              cast.hash,
              signerUuid
            )
            console.log('📤 Opinion failure reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
          }
          
          return NextResponse.json({ error: 'Opinion analysis failed' }, { status: 500 })
        }
      } catch (error) {
        console.error('❌ Error in opinion generation:', error)
        return NextResponse.json({ error: 'Opinion error' }, { status: 500 })
      }
    }
    
    // Handle existing commands
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
        const stats = await CastService.getUserStats(userId)
        
        if (signerUuid) {
          const response = formatStatsResponse(stats, userId)
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
            '❌ No parent cast found. Reply to a cast with "@cstkpr analyze this"',
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
          
          // SAVE context for future conversations
          conversationContext.set(userId, {
            lastAnalyzedCast: analysis,
            timestamp: Date.now()
          })
          
          if (signerUuid) {
            const response = await formatAnalysisResponse(analysis)
            console.log('📝 Formatted response length:', response.length)
            console.log('📝 Response content:', response)
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
              '❌ Sorry, couldn\'t analyze that cast. It might be unavailable.',
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
            '❌ No parent cast found. Reply to a cast with "@cstkpr save this"',
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
            saved_by_user_id: userId,
            category: 'saved-via-bot',
            notes: `💾 Saved via @cstkpr bot by ${userId} on ${new Date().toLocaleDateString()}`,
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
            saved_by_user_id: userId,
            category: 'saved-via-bot',
            notes: `💾 Saved via @cstkpr bot by ${userId} on ${new Date().toLocaleDateString()}`,
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
            '❌ Couldn\'t save that cast. It might already be saved.',
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
        '🤖 Try: save this | analyze this | "what do you think?" | stats | help | "what does [word] mean?"',
        cast.hash,
        signerUuid
      )
      console.log('📤 Default reply result:', replyResult.success ? 'SUCCESS' : replyResult.message)
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Enhanced conversational response processed',
      commandsDetected: Object.entries(commands).filter(([_, v]) => v).map(([commandName]) => commandName)
    })
    
  } catch (error) {
    console.error('💥 Enhanced webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}