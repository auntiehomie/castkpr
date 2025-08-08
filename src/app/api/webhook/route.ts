import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

/**
 * Required Environment Variables for Bot Replies:
 * - NEYNAR_API_KEY: Your Neynar API key for posting casts
 * - NEYNAR_SIGNER_UUID: Signer UUID for the bot account
 * 
 * Without these, the bot will process mentions but won't reply to casts.
 */

// Type definitions for webhook payload
interface CastAuthor {
  fid?: number
  username?: string
  display_name?: string
  pfp_url?: string
}

interface WebhookCast {
  text: string
  hash?: string  // Current cast hash
  parent_hash?: string
  parent_author?: CastAuthor
  author: CastAuthor
  mentioned_profiles?: Array<{ username?: string; fid?: number }>
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
    
    const cast: WebhookCast = body.data
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
    
    // Process the bot mention
    const text = cast.text.toLowerCase()
    const userId = cast.author.username ?? 'unknown-user'
    const parentHash = cast.parent_hash ?? null
    
    console.log('💬 Cast text:', text)
    console.log('👤 User ID:', userId)
    console.log('👆 Parent hash:', parentHash)
    
    // Generate response for any bot mention
    const { commandType, response, contextData } = await generateBotResponse(text, userId, parentHash, cast)
    
    // Post reply to Farcaster (reply to the cast that mentioned the bot)
    const castHash = cast.hash || body.data?.hash
    console.log('🔗 Cast hash for reply:', castHash)
    
    if (castHash) {
      await postReplyToFarcaster(response, cast.author.fid || 0, castHash)
    } else {
      console.error('❌ No cast hash found to reply to')
      console.log('📋 Available cast data:', Object.keys(cast))
      console.log('📋 Available body.data:', Object.keys(body.data || {}))
    }
    
    // Save the conversation using regular service
    try {
      if (commandType === 'save' && contextData) {
        const savedCast = await CastService.saveCast(contextData)
        console.log('✅ Cast saved successfully:', savedCast.cast_hash)
        
        return NextResponse.json({ 
          success: true, 
          message: 'Cast saved and reply posted',
          cast_id: savedCast.cast_hash,
          saved_cast_id: savedCast.id,
          response,
          command_type: commandType
        })
      } else {
        // For non-save commands (help, stats, conversation, general), just return the response
        console.log(`🤖 Bot responding with ${commandType}: ${response}`)
        return NextResponse.json({ 
          success: true, 
          message: 'Reply posted successfully',
          response,
          command_type: commandType
        })
      }
      
    } catch (saveError) {
      console.error('❌ Error saving cast:', saveError)
      const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error'
      console.error('❌ Save error details:', errorMessage)
      return NextResponse.json({ 
        error: 'Failed to save cast', 
        details: errorMessage 
      }, { status: 500 })
    }
    
  } catch (webhookError) {
    console.error('💥 Webhook error:', webhookError)
    const errorMessage = webhookError instanceof Error ? webhookError.message : 'Unknown error'
    console.error('💥 Webhook error details:', errorMessage)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate bot responses
async function generateBotResponse(
  text: string, 
  userId: string, 
  parentHash: string | null,
  cast: WebhookCast
): Promise<{
  commandType: string;
  response: string;
  contextData?: Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>;
}> {
  const lowerText = text.toLowerCase()
  
  // Save commands
  if (lowerText.includes('save this') || (lowerText.includes('save') && !lowerText.includes('what do you think'))) {
    if (!parentHash) {
      return {
        commandType: 'save_error',
        response: 'No cast to save found. Please reply to a cast you want to save.'
      }
    }
    
    // Create cast data for saving
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
    
    return {
      commandType: 'save',
      response: '✅ Cast saved successfully! You can view it at castkpr.vercel.app',
      contextData: castData
    }
  }
  
  // Help command
  if (lowerText.includes('help')) {
    return {
      commandType: 'help',
      response: `🤖 CastKPR Bot Commands:
      
• Reply "save this" to any cast to save it
• "help" - Show this help message  
• "stats" - View your save statistics
• Ask me what I think about anything!

Visit castkpr.vercel.app to view all your saved casts!`
    }
  }
  
  // Stats command
  if (lowerText.includes('stats')) {
    try {
      const stats = await CastService.getUserStats(userId)
      return {
        commandType: 'stats',
        response: `📊 Your CastKPR Stats:

• Total saved casts: ${stats.totalCasts}

Visit castkpr.vercel.app to explore your collection!`
      }
    } catch (statsError) {
      console.error('Error fetching stats:', statsError)
      return {
        commandType: 'stats_error',
        response: 'Unable to fetch stats right now. Try again later!'
      }
    }
  }
  
  // Conversational responses for opinion questions
  if (lowerText.includes('what do you think') || 
      lowerText.includes('your thoughts') || 
      lowerText.includes('do you agree') || 
      lowerText.includes('do you disagree') ||
      lowerText.includes('what are your thoughts') ||
      lowerText.includes('thoughts?') ||
      lowerText.includes('opinion') ||
      lowerText.includes('take on this') ||
      lowerText.includes('what\'s your take') ||
      lowerText.includes('how do you feel')) {
    
    const responses = [
      "🤔 Interesting perspective! I think there's always multiple angles to consider. What's your take?",
      "💭 That's thought-provoking! As a cast-saving bot, I see all kinds of takes. This one's worth saving! Try 'save this' 😉",
      "🧠 Great question! I process a lot of conversations and this feels like one worth keeping track of.",
      "💡 I find this fascinating! You know what would help? Saving good discussions like this for later reference.",
      "🤖 My circuits are buzzing! This is the kind of content that makes people want to save casts for future reference.",
      "⚡ Solid point! I've processed tons of discussions and the best ones always spark more questions.",
      "🎯 You're onto something here! This feels like premium content worth preserving.",
      "🔥 Now that's a hot take! I'm just a humble cast-saving bot, but this seems worth archiving.",
      "✨ Love seeing active discussions like this! Makes me want to remind everyone they can save great threads.",
      "🌟 This is exactly the kind of engagement that makes Farcaster special!"
    ]
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)]
    
    return {
      commandType: 'conversation',
      response: randomResponse
    }
  }
  
  // Agreement/disagreement responses
  if (lowerText.includes('agree') || lowerText.includes('disagree')) {
    const responses = [
      "🤝 I see both sides! That's what makes discussions interesting.",
      "⚖️ Truth usually lies somewhere in the middle. What made you lean that way?",
      "🧩 Every perspective adds a piece to the puzzle. Thanks for sharing yours!",
      "💬 Love seeing different viewpoints clash in a good way. This is worth saving!",
      "🎭 The beauty of discourse! Everyone brings their own lens to the conversation."
    ]
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)]
    
    return {
      commandType: 'conversation',
      response: randomResponse
    }
  }
  
  // Default response for general mentions
  return {
    commandType: 'general',
    response: `🤖 Hey! I'm CastKPR, your cast-saving companion. 

I can help you save great conversations for later! Just reply "save this" to any cast you want to keep, or ask me what I think about anything.

Visit castkpr.vercel.app to browse your saved collection! 💜`
  }
}

// Function to post reply to Farcaster
async function postReplyToFarcaster(message: string, parentAuthorFid: number, parentCastHash: string): Promise<void> {
  try {
    console.log('📤 Attempting to post reply to Farcaster...')
    
    // Check if we have the required environment variables
    const neynarApiKey = process.env.NEYNAR_API_KEY
    const signerUuid = process.env.NEYNAR_SIGNER_UUID
    
    if (!neynarApiKey || !signerUuid) {
      console.error('❌ Missing required environment variables for posting')
      console.error('Need: NEYNAR_API_KEY and NEYNAR_SIGNER_UUID')
      return
    }
    
    // Post the reply using Neynar API
    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api_key': neynarApiKey,
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        text: message,
        parent: parentCastHash,
      }),
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Successfully posted reply to Farcaster:', result.cast.hash)
    } else {
      const errorText = await response.text()
      console.error('❌ Failed to post reply:', response.status, errorText)
    }
    
  } catch (postError) {
    console.error('💥 Error posting reply to Farcaster:', postError)
  }
}