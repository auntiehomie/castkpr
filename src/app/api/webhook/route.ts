import { NextRequest, NextResponse } from 'next/server'
import { CastService, supabase, ContentParser } from '@/lib/supabase'
// import { AIResponseService } from '@/lib/ai-responses'
// TODO: Update the import path below to the correct location of ai-responses.ts
import { AIResponseService } from '@/lib/ai-responses'
import type { SavedCast } from '@/lib/supabase'

// Neynar integration for enhanced responses (optional)
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Webhook received!')
    
    // Debug environment variables
    console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing')
    console.log('🔍 Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'Missing')
    console.log('🔍 Neynar API:', NEYNAR_API_KEY ? 'Available' : 'Not configured')
    
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
    
    // Extract command from the cast text
    const text = cast.text.toLowerCase()
    console.log('💬 Cast text:', text)
    
    const command = extractCommand(text)
    console.log('🎯 Detected command:', command)
    
    // Handle different commands
    let result
    let aiResponse
    
    switch (command) {
      case 'save this':
      case 'save':
        result = await handleSaveCommand(cast)
        break
      
      case 'help':
        result = await handleHelpCommand(cast)
        break
      
      case 'stats':
        result = await handleStatsCommand(cast)
        break
      
      case 'search':
        result = await handleSearchCommand(cast)
        break
      
      default:
        result = await handleConversationalCommand(cast, command)
        break
    }
    
    // Generate AI-powered response
    try {
      console.log('🧠 Generating AI response...')
      
      const responseContext = {
        castContent: cast.text,
        authorUsername: cast.author.username,
        mentionedUser: cast.author.username,
        command: command,
        parentCast: 'savedCast' in result ? result.savedCast : undefined
      }
      
      aiResponse = await AIResponseService.generateResponse(responseContext)
      console.log('✅ AI response generated:', aiResponse.responseType)
      
      // Update user profile based on this interaction
      await AIResponseService.updateUserProfileFromInteraction(
        cast.author.username,
        cast.text,
        command,
        {
          likes: cast.reactions?.likes_count || 0,
          replies: cast.replies?.count || 0,
          recasts: cast.reactions?.recasts_count || 0
        }
      )
      
    } catch (aiError) {
      console.error('⚠️ AI response generation failed:', aiError)
      aiResponse = {
        content: result.fallbackMessage || "✅ Command processed! Check castkpr.com for more details.",
        confidence: 0.5,
        reasoning: "AI response failed, using fallback",
        usedContexts: [],
        responseType: 'error' as const
      }
    }
    
    // Send response back to Farcaster (if Neynar is configured)
    if (NEYNAR_API_KEY && NEYNAR_SIGNER_UUID && aiResponse) {
      try {
        await sendResponseCast(cast.hash, aiResponse.content)
        console.log('📨 Response sent to Farcaster')
      } catch (responseError) {
        console.error('⚠️ Failed to send response cast:', responseError)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: result.message,
      command: command,
      aiResponse: {
        content: aiResponse.content,
        confidence: aiResponse.confidence,
        responseType: aiResponse.responseType
      },
      details: result.details
    })
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    console.error('💥 Webhook error details:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Extract command from cast text
function extractCommand(text: string): string {
  const lowerText = text.toLowerCase()
  
  if (lowerText.includes('save this') || lowerText.includes('save')) {
    return 'save this'
  } else if (lowerText.includes('help')) {
    return 'help'
  } else if (lowerText.includes('stats')) {
    return 'stats'
  } else if (lowerText.includes('search')) {
    return 'search'
  } else {
    return 'conversational'
  }
}

// Handle save command
async function handleSaveCommand(cast: any) {
  const parentHash = cast.parent_hash
  console.log('👆 Parent hash:', parentHash)
  
  if (!parentHash) {
    console.log('❌ No parent cast to save')
    return {
      success: false,
      message: 'No parent cast to save',
      fallbackMessage: "🤔 I don't see a cast to save. Reply to a cast with '@cstkpr save this' to save it!",
      details: { error: 'No parent cast found' }
    }
  }
  
  try {
    // Create cast data that matches SavedCast interface
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
      parsed_data: ContentParser.parseContent(`Cast saved from Farcaster - Hash: ${parentHash}`)
    } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
    
    console.log('💾 Saving cast data...')
    
    // Test Supabase connection first
    console.log('🔍 Testing Supabase connection...')
    const { data: testData, error: testError } = await supabase
      .from('saved_casts')
      .select('*')
      .limit(1)
    
    if (testError) {
      console.error('❌ Supabase connection test failed:', testError)
      throw new Error('Database connection failed')
    }
    
    console.log('✅ Supabase connection test successful')
    
    // Save to database
    const savedCast = await CastService.saveCast(castData)
    console.log('✅ Cast saved successfully:', savedCast.cast_hash)
    
    return {
      success: true,
      message: 'Cast saved successfully',
      savedCast: savedCast,
      details: {
        cast_id: savedCast.cast_hash,
        saved_cast_id: savedCast.id,
        saved_by: cast.author.username
      }
    }
    
  } catch (saveError) {
    console.error('❌ Error saving cast:', saveError)
    
    if (saveError instanceof Error && saveError.message.includes('already saved')) {
      return {
        success: false,
        message: 'Cast already saved by this user',
        fallbackMessage: "📝 You've already saved this cast! Check your dashboard at castkpr.com to view it.",
        details: { error: 'Duplicate save attempt' }
      }
    }
    
    return {
      success: false,
      message: 'Failed to save cast',
      fallbackMessage: "⚠️ Something went wrong saving that cast. Please try again or check castkpr.com",
      details: { error: saveError instanceof Error ? saveError.message : 'Unknown error' }
    }
  }
}

// Handle help command
async function handleHelpCommand(cast: any) {
  console.log('❓ Processing help command for:', cast.author.username)
  
  return {
    success: true,
    message: 'Help command processed',
    fallbackMessage: `🤖 CastKPR Bot Help:

📝 **Commands:**
• "@cstkpr save this" - Save any cast
• "@cstkpr help" - Show this help
• "@cstkpr stats" - Your statistics
• "@cstkpr search [topic]" - Find saved casts

💡 **Tips:**
• Reply to any cast to save it
• Visit castkpr.com for full dashboard
• I learn from your interactions!`,
    details: { user: cast.author.username }
  }
}

// Handle stats command
async function handleStatsCommand(cast: any) {
  console.log('📊 Processing stats command for:', cast.author.username)
  
  try {
    const userStats = await CastService.getUserStats(cast.author.username)
    
    return {
      success: true,
      message: 'Stats command processed',
      fallbackMessage: `📊 Your CastKPR Stats:

💾 Total Saved Casts: ${userStats.totalCasts}
📱 Dashboard: castkpr.com/dashboard

Keep saving interesting casts to build your knowledge base!`,
      details: { 
        user: cast.author.username,
        totalCasts: userStats.totalCasts
      }
    }
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return {
      success: false,
      message: 'Failed to fetch stats',
      fallbackMessage: "📊 Couldn't fetch your stats right now. Check your dashboard at castkpr.com!",
      details: { error: 'Stats fetch failed' }
    }
  }
}

// Handle search command
async function handleSearchCommand(cast: any) {
  console.log('🔍 Processing search command for:', cast.author.username)
  
  // Extract search query
  const words = cast.text.split(' ')
  const searchIndex = words.findIndex((word: string) => word.toLowerCase().includes('search'))
  const searchQuery = words.slice(searchIndex + 1).join(' ').trim()
  
  if (!searchQuery) {
    return {
      success: false,
      message: 'No search query provided',
      fallbackMessage: "🔍 Please specify what to search for! Example: '@cstkpr search crypto'",
      details: { error: 'Empty search query' }
    }
  }
  
  try {
    const searchResults = await CastService.searchCasts(cast.author.username, searchQuery)
    
    return {
      success: true,
      message: 'Search completed',
      fallbackMessage: `🔍 Search for "${searchQuery}": Found ${searchResults.length} result(s)!

${searchResults.length > 0 
  ? `Top result: "${searchResults[0].cast_content.slice(0, 100)}..."` 
  : 'Try different keywords or check castkpr.com'
}

📱 View all results: castkpr.com/dashboard`,
      details: { 
        query: searchQuery,
        resultCount: searchResults.length,
        results: searchResults.slice(0, 3).map(r => ({
          hash: r.cast_hash,
          content: r.cast_content.slice(0, 100)
        }))
      }
    }
  } catch (error) {
    console.error('Error performing search:', error)
    return {
      success: false,
      message: 'Search failed',
      fallbackMessage: `🔍 Search encountered an error. Try again or search at castkpr.com`,
      details: { error: 'Search operation failed' }
    }
  }
}

// Handle conversational command
async function handleConversationalCommand(cast: any, command: string) {
  console.log('💬 Processing conversational command for:', cast.author.username)
  
  return {
    success: true,
    message: 'Conversational response generated',
    fallbackMessage: `🤖 Hi @${cast.author.username}! I'm CastKPR, your cast-saving assistant.

Reply "@cstkpr save this" to any cast to save it, or "@cstkpr help" for all commands!

📱 Dashboard: castkpr.com`,
    details: { 
      user: cast.author.username,
      originalCommand: command,
      type: 'conversational'
    }
  }
}

// Send response cast via Neynar (optional)
async function sendResponseCast(parentHash: string, content: string) {
  if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
    console.log('⚠️ Neynar not configured, skipping response cast')
    return
  }
  
  try {
    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        signer_uuid: NEYNAR_SIGNER_UUID,
        text: content,
        parent: parentHash
      })
    })
    
    if (!response.ok) {
      const errorData = await response.text()
      console.error('❌ Neynar API error:', response.status, errorData)
      throw new Error(`Neynar API error: ${response.status}`)
    }
    
    const responseData = await response.json()
    console.log('✅ Response cast sent:', responseData.cast?.hash)
    
  } catch (error) {
    console.error('❌ Error sending response cast:', error)
    throw error
  }
}