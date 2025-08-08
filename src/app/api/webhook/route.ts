import { NextRequest, NextResponse } from 'next/server'
import { CastService, BotService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

// Type definitions for webhook data
interface WebhookCast {
  hash: string
  text: string
  author: {
    username: string
    fid: number
    display_name?: string
    pfp_url?: string
  }
  parent_hash?: string
  parent_author?: {
    fid: number
    username?: string
    display_name?: string
  }
  mentioned_profiles: Array<{
    username?: string
    fid?: number
  }>
  embeds?: Array<{
    url?: string
    cast_id?: {
      fid: number
      hash: string
    }
  }>
}

interface ConversationContext {
  original_content?: string
  bot_response?: string
  timestamp?: string
  conversation_type?: 'save_command' | 'general_question' | 'follow_up' | 'analyze_command'
  parent_hash?: string | null
  is_follow_up?: boolean
  [key: string]: unknown
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

    // Rate limiting check - simple in-memory rate limiting
    const userId = cast.author.username
    const now = Date.now()
    if (await isRateLimited(userId, now)) {
      console.log('⏱️ Rate limit hit for user:', userId)
      return NextResponse.json({ message: 'Rate limited' })
    }

    // Check if this is a reply to a previous bot conversation
    const parentHash = cast.parent_hash
    let isReplyToBotConversation = false
    let previousConversation = null
    
    if (parentHash) {
      try {
        console.log('🔍 Checking if parent hash is a bot conversation:', parentHash)
        previousConversation = await BotService.getBotConversationByCastHash(parentHash)
        if (previousConversation) {
          isReplyToBotConversation = true
          console.log('🔄 This is a reply to a previous bot conversation')
        }
      } catch (error) {
        console.error('Error checking bot conversations:', error)
        // Continue processing even if conversation check fails
      }
    }
    
    console.log('💬 Reply to bot?', isReplyToBotConversation)
    
    // Get cast details
    const text = cast.text.toLowerCase()
    const currentCastHash = cast.hash
    
    console.log('💬 Cast text:', text)
    console.log('👤 User ID:', userId)
    console.log('👆 Parent hash:', parentHash)
    console.log('🔗 Current cast hash:', currentCastHash)
    
    // Determine response type and content
    let responseText = ''
    let conversationType: 'save_command' | 'general_question' | 'follow_up' | 'analyze_command' = 'general_question'
    
    if (isReplyToBotConversation && previousConversation) {
      // This is a follow-up to a previous conversation
      conversationType = 'follow_up'
      responseText = generateFollowUpResponse(text, previousConversation.conversation_context)
    } else if (text.includes('save this') || (text.includes('save') && parentHash)) {
      // This is a save command
      conversationType = 'save_command'
      
      if (!parentHash) {
        responseText = "I'd love to help you save a cast! Please reply to the cast you want to save with '@cstkpr save this' 💾"
      } else {
        // Handle save command
        try {
          await handleSaveCommand(parentHash, userId, cast)
          responseText = "✅ Cast saved successfully! You can view all your saved casts at castkpr.com 📚"
        } catch (error) {
          console.error('Error handling save command:', error)
          if (error instanceof Error && error.message.includes('already saved')) {
            responseText = "🔄 You've already saved this cast! Check your collection at castkpr.com"
          } else {
            responseText = "❌ Sorry, I couldn't save that cast. Please try again later."
          }
        }
      }
    } else if (text.includes('analyze this') || text.includes('analyze')) {
      // This is an analyze command
      conversationType = 'analyze_command'
      
      if (!parentHash) {
        responseText = "I'd love to analyze a cast for you! Please reply to the cast you want me to analyze with '@cstkpr analyze this' 🧠"
      } else {
        try {
          const analysis = await handleAnalyzeCommand(parentHash)
          responseText = analysis
        } catch (error) {
          console.error('Error handling analyze command:', error)
          responseText = "❌ Sorry, I couldn't analyze that cast right now. Please try again later."
        }
      }
    } else {
      // General question/interaction
      responseText = generateGeneralResponse(text)
    }
    
    console.log('🤖 Bot responding with', conversationType + ':', responseText)
    
    // Post reply to Farcaster using Neynar API
    try {
      console.log('📤 Attempting to post reply to Farcaster via Neynar...')
      
      // Check if we have the required API key
      if (!process.env.NEYNAR_API_KEY) {
        console.error('❌ Missing NEYNAR_API_KEY environment variable')
        
        // Store conversation even if posting fails
        await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
        
        return NextResponse.json({ 
          error: 'Missing Neynar API key configuration',
          response_generated: responseText,
          conversation_stored: true
        }, { status: 500 })
      }
      
      if (!process.env.NEYNAR_SIGNER_UUID) {
        console.error('❌ Missing NEYNAR_SIGNER_UUID environment variable')
        
        // Store conversation even if posting fails
        await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
        
        return NextResponse.json({ 
          error: 'Missing Neynar signer configuration',
          response_generated: responseText,
          conversation_stored: true
        }, { status: 500 })
      }
      
      const replyResponse = await fetch('https://api.neynar.com/v2/farcaster/cast', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Api-Key': process.env.NEYNAR_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signer_uuid: process.env.NEYNAR_SIGNER_UUID,
          text: responseText,
          parent: currentCastHash
        }),
      })
      
      if (!replyResponse.ok) {
        const errorText = await replyResponse.text()
        console.error('❌ Neynar API error:', replyResponse.status, errorText)
        
        // Still try to store conversation even if posting fails
        await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
        
        return NextResponse.json({ 
          error: 'Failed to post reply to Farcaster', 
          details: errorText,
          response_generated: responseText,
          conversation_stored: true
        }, { status: 500 })
      }
      
      const replyData = await replyResponse.json()
      const botCastHash = replyData.cast?.hash
      
      console.log('✅ Successfully posted reply to Farcaster:', botCastHash)
      
      // Store the bot conversation for future reference
      await storeBotConversation(userId, currentCastHash, botCastHash, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Bot response posted successfully',
        response_text: responseText,
        conversation_type: conversationType,
        bot_cast_hash: botCastHash
      })
      
    } catch (error) {
      console.error('❌ Error posting reply:', error)
      
      // Still try to store conversation even if posting fails
      try {
        await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
      } catch (storageError) {
        console.error('❌ Failed to store conversation after post error:', storageError)
      }
      
      return NextResponse.json({ 
        error: 'Failed to post reply', 
        details: error instanceof Error ? error.message : 'Unknown error',
        response_generated: responseText,
        conversation_storage_attempted: true
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Simple in-memory rate limiting (5 requests per minute per user)
const rateLimitMap = new Map<string, number[]>()

async function isRateLimited(userId: string, now: number): Promise<boolean> {
  const userRequests = rateLimitMap.get(userId) || []
  const oneMinuteAgo = now - 60000 // 1 minute in milliseconds
  
  // Remove old requests
  const recentRequests = userRequests.filter(timestamp => timestamp > oneMinuteAgo)
  
  // Check if user has exceeded rate limit (5 requests per minute)
  if (recentRequests.length >= 5) {
    return true
  }
  
  // Add current request
  recentRequests.push(now)
  rateLimitMap.set(userId, recentRequests)
  
  return false
}

async function storeBotConversation(
  userId: string, 
  originalCastHash: string, 
  botCastHash: string | null, 
  originalContent: string, 
  botResponse: string, 
  conversationType: 'save_command' | 'general_question' | 'follow_up' | 'analyze_command', 
  parentHash: string | null, 
  isFollowUp: boolean
): Promise<void> {
  try {
    await BotService.storeBotConversation({
      user_id: userId,
      original_cast_hash: originalCastHash,
      bot_cast_hash: botCastHash,
      conversation_context: {
        original_content: originalContent,
        bot_response: botResponse,
        timestamp: new Date().toISOString(),
        conversation_type: conversationType,
        parent_hash: parentHash,
        is_follow_up: isFollowUp
      }
    })
    console.log('✅ Bot conversation stored successfully')
  } catch (error) {
    console.error('❌ Error storing bot conversation:', error)
    // Don't throw here - we don't want storage failures to break the main flow
  }
}

async function handleSaveCommand(parentHash: string, userId: string, mentionCast: WebhookCast): Promise<void> {
  console.log('💾 Handling save command for parent hash:', parentHash)
  
  // Try to fetch the actual cast content if we have parent author info
  // Using const since we're not reassigning this value in the current implementation
  const castContent = `🔗 Cast saved from Farcaster - Hash: ${parentHash}`
  let authorInfo = {
    username: `user-${mentionCast.parent_author?.fid || 'unknown'}`,
    fid: mentionCast.parent_author?.fid || 0,
    display_name: `User ${mentionCast.parent_author?.fid || 'Unknown'}`,
    pfp_url: undefined
  }

  // If we have parent author info, use it
  if (mentionCast.parent_author) {
    authorInfo = {
      username: mentionCast.parent_author.username || `user-${mentionCast.parent_author.fid}`,
      fid: mentionCast.parent_author.fid,
      display_name: mentionCast.parent_author.display_name || `User ${mentionCast.parent_author.fid}`,
      pfp_url: undefined
    }
  }
  
  // Create cast data that matches your SavedCast interface exactly
  const castData = {
    username: authorInfo.username,
    fid: authorInfo.fid,
    cast_hash: parentHash,
    cast_content: castContent,
    cast_timestamp: new Date().toISOString(),
    tags: ['saved-via-bot'] as string[],
    likes_count: 0,
    replies_count: 0,
    recasts_count: 0,
    cast_url: `https://warpcast.com/~/conversations/${parentHash}`,
    author_pfp_url: authorInfo.pfp_url,
    author_display_name: authorInfo.display_name,
    saved_by_user_id: userId,
    category: 'saved-via-bot',
    notes: `💾 Saved via @cstkpr bot by ${userId} on ${new Date().toLocaleDateString()}`,
    parsed_data: {
      urls: [`https://warpcast.com/~/conversations/${parentHash}`],
      hashtags: ['cstkpr', 'saved'],
      mentions: ['cstkpr'],
      word_count: castContent.split(' ').length,
      sentiment: 'neutral' as const,
      topics: ['saved-cast'],
      ai_category: 'saved-via-bot',
      ai_tags: ['bot-saved', 'farcaster-cast']
    }
  } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
  
  console.log('💾 Saving cast data to database...')
  await CastService.saveCast(castData)
  console.log('✅ Cast saved successfully')
}

async function handleAnalyzeCommand(parentHash: string): Promise<string> {
  console.log('🧠 Handling analyze command for parent hash:', parentHash)
  
  // For now, return a simple analysis response
  // In the future, this could integrate with OpenAI to provide actual analysis
  const analysisResponses = [
    "🧠 This cast looks interesting! It has good engagement potential and covers relevant topics. Perfect for saving to your collection!",
    "📊 Analysis: This cast appears to be informative content that could be valuable for future reference. Consider saving it!",
    "🎯 This cast shows strong discussion potential - it's the kind of content that often generates meaningful conversations.",
    "💡 Insight: This type of content typically performs well and could be worth archiving for later reference.",
    "🔍 Analysis complete: This cast contains useful information that aligns with current trending topics."
  ]
  
  return analysisResponses[Math.floor(Math.random() * analysisResponses.length)]
}

function generateGeneralResponse(text: string): string {
  // Help responses
  if (text.includes('help') || text.includes('how')) {
    return "I help you save and analyze Farcaster casts! 📚\n\n• Reply '@cstkpr save this' to any cast to save it\n• Reply '@cstkpr analyze this' for quick insights\n• View your collection at castkpr.com\n• I'll organize everything for you automatically! ✨"
  }
  
  // What do you do responses
  if (text.includes('what') && (text.includes('you') || text.includes('do'))) {
    return "I'm CastKPR! 🤖 I save your favorite Farcaster casts and provide quick analysis. Reply '@cstkpr save this' or '@cstkpr analyze this' to any cast to try it out! 🚀"
  }
  
  // Stats responses
  if (text.includes('stats') || text.includes('count') || text.includes('how many')) {
    return "I don't have your stats right now, but you can see all your saved casts at castkpr.com! Keep saving with '@cstkpr save this' 📊"
  }
  
  // Insights responses
  if (text.includes('insights') || text.includes('insight')) {
    return "💡 For personalized insights about your saved casts, visit castkpr.com and check out the AI section! I can help you discover patterns in your saved content."
  }
  
  // Thanks responses
  if (text.includes('thanks') || text.includes('thank')) {
    return "You're welcome! 🙌 Happy to help you build your cast collection. Remember: '@cstkpr save this' on any cast you want to keep!"
  }
  
  // Random general responses
  const responses = [
    "Hey there! I'm CastKPR, your friendly cast-saving bot! 🤖 Reply '@cstkpr save this' to any cast to save it to your collection.",
    "Hi! I help save and analyze your favorite Farcaster casts. Try replying '@cstkpr save this' or '@cstkpr analyze this' to a cast! 📚",
    "Hello! I'm here to help you build your personal cast collection. Just mention me with 'save this' or 'analyze this' on any cast! ✨",
    "Hey! I'm CastKPR - I help you save the best casts from Farcaster. Reply '@cstkpr save this' to get started! 💾",
    "Hi there! I can help you save interesting casts for later. Just reply '@cstkpr save this' or ask for analysis with '@cstkpr analyze this'! 🌟"
  ]
  
  return responses[Math.floor(Math.random() * responses.length)]
}

function generateFollowUpResponse(text: string, previousContext: ConversationContext): string {
  // Thanks responses for follow-ups
  if (text.includes('thanks') || text.includes('thank')) {
    return "You're very welcome! 🙌 Happy to help you build your cast collection. Keep saving the good stuff with '@cstkpr save this'!"
  }
  
  // Context-aware responses based on previous conversation
  if (previousContext?.conversation_type === 'save_command') {
    return "Glad I could help save that cast! 🎯 Keep building your collection - there's so much great content on Farcaster! Feel free to save more with '@cstkpr save this'"
  }
  
  if (previousContext?.conversation_type === 'analyze_command') {
    return "Hope that analysis was helpful! 🧠 If you liked what you learned, consider saving the cast with '@cstkpr save this' for future reference!"
  }
  
  // Help requests in follow-ups
  if (text.includes('help') || text.includes('how')) {
    return "I'm always here to help! 🤖 Just reply '@cstkpr save this' to save casts or '@cstkpr analyze this' for insights. View your entire collection at castkpr.com!"
  }
  
  // General follow-up responses
  const followUpResponses = [
    "Thanks for the follow-up! 😊 Remember, I'm always ready to save interesting casts for you. Just say '@cstkpr save this'!",
    "Great to chat with you! 💭 Don't forget you can organize your saved casts at castkpr.com",
    "I appreciate the continued conversation! 🗣️ Keep saving great content with '@cstkpr save this'",
    "Thanks for chatting! 💬 I'm always here when you want to save more amazing casts!",
    "Love the follow-up! 🌟 Your cast collection is growing - keep it up with '@cstkpr save this'!"
  ]
  
  return followUpResponses[Math.floor(Math.random() * followUpResponses.length)]
}