import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

/**
 * Required Environment Variables for Bot Replies:
 * - NEYNAR_API_KEY: Your Neynar API key for posting casts
 * - NEYNAR_SIGNER_UUID: Signer UUID for the bot account
 * - OPENAI_API_KEY: OpenAI API key for cast comprehension
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
  thread_hash?: string
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
    
    // Check if this is a reply to one of the bot's previous casts
    const isReplyToBot = await isReplyToBotCast(cast.parent_hash)
    
    console.log('🤖 Bot mentioned?', mentionsBot)
    console.log('💬 Reply to bot?', isReplyToBot)
    
    // Process if bot is mentioned OR if it's a reply to bot's previous cast
    if (!mentionsBot && !isReplyToBot) {
      console.log('❌ Bot not mentioned and not a reply to bot, skipping')
      return NextResponse.json({ message: 'Bot not involved in conversation' })
    }
    
    // Process the bot mention
    const text = cast.text.toLowerCase()
    const userId = cast.author.username ?? 'unknown-user'
    const parentHash = cast.parent_hash ?? null
    
    console.log('💬 Cast text:', text)
    console.log('👤 User ID:', userId)
    console.log('👆 Parent hash:', parentHash)
    
    // Generate response - different logic for mentions vs follow-ups
    const { commandType, response, contextData } = mentionsBot ? 
      await generateBotResponse(text, userId, parentHash, cast) :
      await generateFollowUpResponse(text, userId, cast)
    
    // Post reply to Farcaster (reply to the cast that mentioned the bot)
    const castHash = cast.hash || body.data?.hash
    console.log('🔗 Cast hash for reply:', castHash)
    
    if (castHash) {
      const replyHash = await postReplyToFarcaster(response, cast.author.fid || 0, castHash)
      
      // Store this conversation for future follow-ups
      if (replyHash) {
        await storeBotConversation(castHash, replyHash, cast.thread_hash || castHash)
      }
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
  
  // Conversational responses for opinion questions - now with AI comprehension
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
    
    // Get the cast content to analyze
    const castToAnalyze = parentHash ? 
      await getCastContent(parentHash) : 
      cast.text
    
    if (castToAnalyze) {
      const aiResponse = await generateAIResponse(castToAnalyze, text)
      return {
        commandType: 'conversation',
        response: aiResponse
      }
    }
    
    // Fallback to generic response if no content found
    const responses = [
      "🤔 Interesting perspective! I think there's always multiple angles to consider. What's your take?",
      "💭 That's thought-provoking! As a cast-saving bot, I see all kinds of takes. This one's worth saving! Try 'save this' 😉",
      "🧠 Great question! I process a lot of conversations and this feels like one worth keeping track of."
    ]
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)]
    
    return {
      commandType: 'conversation',
      response: randomResponse
    }
  }
  
  // Agreement/disagreement responses - now with AI comprehension
  if (lowerText.includes('agree') || lowerText.includes('disagree')) {
    // Get the cast content to analyze
    const castToAnalyze = parentHash ? 
      await getCastContent(parentHash) : 
      cast.text
    
    if (castToAnalyze) {
      const aiResponse = await generateAIResponse(castToAnalyze, text)
      return {
        commandType: 'conversation',
        response: aiResponse
      }
    }
    
    // Fallback responses
    const responses = [
      "🤝 I see both sides! That's what makes discussions interesting.",
      "⚖️ Truth usually lies somewhere in the middle. What made you lean that way?",
      "🧩 Every perspective adds a piece to the puzzle. Thanks for sharing yours!"
    ]
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)]
    
    return {
      commandType: 'conversation',
      response: randomResponse
    }
  }
  
  // Default response for general mentions - now with AI comprehension
  const castToAnalyze = parentHash ? 
    await getCastContent(parentHash) : 
    cast.text

  if (castToAnalyze && lowerText.length > 10) { // Only use AI for substantial mentions
    const aiResponse = await generateAIResponse(castToAnalyze, text)
    return {
      commandType: 'general',
      response: aiResponse
    }
  }

  // Fallback response for simple mentions
  return {
    commandType: 'general',
    response: `🤖 Hey! I'm CastKPR, your cast-saving companion. 

I can help you save great conversations for later! Just reply "save this" to any cast you want to keep, or ask me what I think about anything.

Visit castkpr.vercel.app to browse your saved collection! 💜`
  }
}

// Function to post reply to Farcaster
async function postReplyToFarcaster(message: string, parentAuthorFid: number, parentCastHash: string): Promise<string | null> {
  try {
    console.log('📤 Attempting to post reply to Farcaster...')
    
    // Check if we have the required environment variables
    const neynarApiKey = process.env.NEYNAR_API_KEY
    const signerUuid = process.env.NEYNAR_SIGNER_UUID
    
    if (!neynarApiKey || !signerUuid) {
      console.error('❌ Missing required environment variables for posting')
      console.error('Need: NEYNAR_API_KEY and NEYNAR_SIGNER_UUID')
      return null
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
      return result.cast.hash
    } else {
      const errorText = await response.text()
      console.error('❌ Failed to post reply:', response.status, errorText)
      return null
    }
    
  } catch (postError) {
    console.error('💥 Error posting reply to Farcaster:', postError)
    return null
  }
}

// Function to get cast content from Neynar API
async function getCastContent(castHash: string): Promise<string | null> {
  try {
    const neynarApiKey = process.env.NEYNAR_API_KEY
    
    if (!neynarApiKey) {
      console.error('❌ Missing NEYNAR_API_KEY for fetching cast content')
      return null
    }
    
    const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api_key': neynarApiKey,
      },
    })
    
    if (response.ok) {
      const result = await response.json()
      return result.cast.text || null
    } else {
      console.error('❌ Failed to fetch cast content:', response.status)
      return null
    }
    
  } catch (fetchError) {
    console.error('💥 Error fetching cast content:', fetchError)
    return null
  }
}

// Function to generate AI response based on cast content
async function generateAIResponse(castContent: string, userMessage: string): Promise<string> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY
    
    if (!openaiApiKey) {
      console.error('❌ Missing OPENAI_API_KEY for AI responses')
      return "🤖 I'd love to share my thoughts, but I need my AI capabilities configured! For now, this seems like great content worth saving."
    }
    
    const prompt = `You are CastKPR, a helpful and engaging Farcaster bot that helps people save and discuss casts. 

Someone shared this cast: "${castContent}"

They asked you: "${userMessage}"

Please respond in a thoughtful, conversational way that:
- Shows you understand the cast content
- Gives a genuine, helpful perspective 
- Stays under 280 characters
- Uses emojis appropriately
- Occasionally mentions that great content like this is worth saving with "save this"
- Maintains a friendly, knowledgeable tone

Don't be overly promotional about saving casts - just be helpful and engaging.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are CastKPR, a helpful Farcaster bot that helps save and discuss casts. Be conversational, insightful, and under 280 characters.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })
    
    if (response.ok) {
      const result = await response.json()
      const aiResponse = result.choices[0]?.message?.content?.trim() || ''
      
      // Ensure response is under 280 characters
      if (aiResponse.length > 280) {
        return aiResponse.substring(0, 277) + '...'
      }
      
      return aiResponse
    } else {
      console.error('❌ Failed to generate AI response:', response.status)
      return "🤖 That's really interesting! I'm having trouble with my analysis right now, but this seems like quality content worth discussing."
    }
    
  } catch (aiError) {
    console.error('💥 Error generating AI response:', aiError)
    return "🤖 Fascinating topic! My circuits are a bit overloaded right now, but I can tell this is the kind of content worth keeping track of."
  }
}

// Function to check if a cast is a reply to one of the bot's previous casts
async function isReplyToBotCast(parentHash: string | undefined): Promise<boolean> {
  if (!parentHash) return false
  
  try {
    // Check if this parent hash is in our stored bot conversations
    const { data, error } = await supabase
      .from('bot_conversations')
      .select('bot_cast_hash')
      .eq('bot_cast_hash', parentHash)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking bot conversations:', error)
      return false
    }
    
    return !!data
  } catch (checkError) {
    console.error('💥 Error checking if reply to bot:', checkError)
    return false
  }
}

// Function to generate follow-up responses (when replying to bot's previous cast)
async function generateFollowUpResponse(text: string, userId: string, cast: WebhookCast): Promise<{
  commandType: string;
  response: string;
  contextData?: Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>;
}> {
  console.log('🔄 Generating follow-up response for:', text)
  
  // Get the conversation context
  const conversationContext = await getConversationContext(cast.parent_hash)
  
  const openaiApiKey = process.env.OPENAI_API_KEY
  
  if (!openaiApiKey) {
    return {
      commandType: 'followup',
      response: "🤖 Thanks for following up! I'm still processing our conversation. What specifically would you like to know more about?"
    }
  }
  
  try {
    const prompt = `You are CastKPR, a helpful Farcaster bot. You're in an ongoing conversation thread.

Previous context: ${conversationContext || 'Continuing our discussion'}

The user just said: "${text}"

Please respond naturally as if you're continuing the conversation. Keep it:
- Under 280 characters
- Conversational and helpful
- Related to the ongoing discussion
- Use emojis appropriately

Don't mention saving casts unless directly relevant.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are CastKPR, having a natural conversation. Be helpful, concise, and conversational.'
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
      const result = await response.json()
      let aiResponse = result.choices[0]?.message?.content?.trim() || ''
      
      // Ensure response is under 280 characters
      if (aiResponse.length > 280) {
        aiResponse = aiResponse.substring(0, 277) + '...'
      }
      
      return {
        commandType: 'followup',
        response: aiResponse
      }
    } else {
      console.error('❌ Failed to generate follow-up response:', response.status)
      return {
        commandType: 'followup',
        response: "🤔 That's a great point! I'm thinking through what you said. Could you elaborate a bit more?"
      }
    }
    
  } catch (followupError) {
    console.error('💥 Error generating follow-up response:', followupError)
    return {
      commandType: 'followup',
      response: "💭 Interesting perspective! I'm still processing our conversation. What would you like to explore further?"
    }
  }
}

// Function to store bot conversation for future tracking
async function storeBotConversation(originalCastHash: string, botReplyHash: string, threadHash: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('bot_conversations')
      .insert({
        original_cast_hash: originalCastHash,
        bot_cast_hash: botReplyHash,
        thread_hash: threadHash,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('❌ Error storing bot conversation:', error)
    } else {
      console.log('✅ Stored bot conversation for future tracking')
    }
  } catch (storeError) {
    console.error('💥 Error storing bot conversation:', storeError)
  }
}

// Function to get conversation context
async function getConversationContext(parentHash: string | undefined): Promise<string | null> {
  if (!parentHash) return null
  
  try {
    // In a full implementation, you'd get the conversation history
    // For now, just return a simple acknowledgment
    return "Continuing our discussion from the previous message"
  } catch (contextError) {
    console.error('💥 Error getting conversation context:', contextError)
    return null
  }
}