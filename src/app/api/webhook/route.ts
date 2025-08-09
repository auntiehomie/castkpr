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
    
    // Check for mentions OR if this is a reply to the bot
    const mentions = cast.mentioned_profiles || []
    const mentionsBot = mentions.some((profile: { username?: string; fid?: number }) => {
      return profile.username === 'cstkpr'
    })
    
    // Also check if this is a reply to a bot message (even without mention)
    const isReplyToBotMessage = false
    if (cast.parent_hash && !mentionsBot) {
      // TODO: We could check if parent_hash belongs to a message posted by our bot
      // For now, we'll require mentions for simplicity
      console.log('📝 Reply detected but bot not mentioned - skipping for now')
    }
    
    const shouldProcessMessage = mentionsBot || isReplyToBotMessage
    
    console.log('🤖 Bot mentioned?', mentionsBot)
    console.log('🔄 Reply to bot message?', isReplyToBotMessage)
    console.log('✅ Should process?', shouldProcessMessage)
    
    if (!shouldProcessMessage) {
      console.log('❌ Bot not mentioned and not a reply to bot message, skipping')
      return NextResponse.json({ message: 'Bot not mentioned' })
    }

    // Rate limiting check - simple in-memory rate limiting
    const userId = cast.author.username
    const now = Date.now()
    if (await isRateLimited(userId, now)) {
      console.log('⏱️ Rate limit hit for user:', userId)
      return NextResponse.json({ message: 'Rate limited' })
    }

    // Get cast details
    const text = cast.text.toLowerCase()
    const currentCastHash = cast.hash
    const parentHash = cast.parent_hash
    
    console.log('💬 Cast text:', text)
    console.log('👤 User ID:', userId)
    console.log('👆 Parent hash:', parentHash)
    console.log('🔗 Current cast hash:', currentCastHash)

    // Check if this is a reply to a previous bot conversation (SOPHISTICATED MEMORY SYSTEM)
    let isReplyToBotConversation = false
    let previousConversation = null
    
    if (parentHash) {
      try {
        console.log('🔍 Checking if parent hash is a bot conversation:', parentHash)
        previousConversation = await BotService.getBotConversationByCastHash(parentHash)
        console.log('🔍 Database lookup result:', previousConversation ? 'FOUND' : 'NOT FOUND')
        
        if (previousConversation) {
          isReplyToBotConversation = true
          console.log('🔄 This is a reply to a previous bot conversation!')
          console.log('📋 Previous conversation context:', JSON.stringify(previousConversation.conversation_context, null, 2))
          console.log('📋 Previous conversation type:', previousConversation.conversation_context?.conversation_type)
          console.log('📋 Previous bot response:', previousConversation.conversation_context?.bot_response)
        } else {
          console.log('❌ No previous bot conversation found for parent hash:', parentHash)
          
          // Fallback: Look for recent conversations with this user to maintain some continuity
          console.log('🔄 Trying fallback: looking for recent conversations with user:', userId)
          try {
            const recentConversations = await BotService.getUserConversations(userId, 3)
            if (recentConversations && recentConversations.length > 0) {
              console.log(`🔍 Found ${recentConversations.length} recent conversations with user`)
              previousConversation = recentConversations[0] // Most recent
              isReplyToBotConversation = true
              console.log('🔄 Using most recent conversation as context for continuity')
              console.log('📋 Fallback conversation context:', JSON.stringify(previousConversation.conversation_context, null, 2))
            } else {
              console.log('❌ No recent conversations found with user')
            }
          } catch (fallbackError) {
            console.error('❌ Error in fallback conversation lookup:', fallbackError)
          }
        }
      } catch (error) {
        console.error('❌ Error checking bot conversations:', error)
        // Continue processing even if conversation check fails
      }
    } else {
      console.log('📝 No parent hash - this is a top-level mention')
    }
    
    console.log('💬 Final decision - Reply to bot?', isReplyToBotConversation)
    console.log('💬 Previous conversation available?', !!previousConversation)
    
    // Determine response type and content
    let responseText = ''
    let conversationType: 'save_command' | 'general_question' | 'follow_up' | 'analyze_command' = 'general_question'
    
    if (isReplyToBotConversation && previousConversation) {
      // This is a follow-up to a previous conversation with full context
      conversationType = 'follow_up'
      responseText = generateFollowUpResponse(text, previousConversation.conversation_context)
      console.log('🎯 Using sophisticated conversation memory for follow-up response')
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

      // Prepare headers with payment support
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'x-api-key': process.env.NEYNAR_API_KEY,
        'Content-Type': 'application/json',
        // Add payment header based on the 402 error response
        'X-PAYMENT': JSON.stringify({
          scheme: 'exact',
          network: 'base',
          maxAmountRequired: '100',
          resource: 'http://api.neynar.com/farcaster/cast',
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          payTo: '0xA6a8736f18f383f1cc2d938576933E5eA7Df01A1',
          maxTimeoutSeconds: 60
        })
      }
      
      const replyResponse = await fetch('https://api.neynar.com/v2/farcaster/cast', {
        method: 'POST',
        headers,
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
      
      // Store the bot conversation for future reference (SOPHISTICATED MEMORY SYSTEM)
      await storeBotConversation(userId, currentCastHash, botCastHash, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Bot response posted successfully',
        response_text: responseText,
        conversation_type: conversationType,
        bot_cast_hash: botCastHash,
        conversation_memory_used: isReplyToBotConversation
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
    console.log('💾 Storing bot conversation:')
    console.log('  - User:', userId)
    console.log('  - Original cast hash:', originalCastHash)
    console.log('  - Bot cast hash:', botCastHash)
    console.log('  - Conversation type:', conversationType)
    console.log('  - Is follow-up:', isFollowUp)
    
    const conversationData = {
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
    }
    
    console.log('💾 Conversation data to store:', JSON.stringify(conversationData, null, 2))
    
    await BotService.storeBotConversation(conversationData)
    console.log('✅ Bot conversation stored successfully in database')
    
    // Verify storage by trying to read it back
    if (botCastHash) {
      console.log('🔍 Verifying storage by reading back conversation...')
      const verification = await BotService.getBotConversationByCastHash(botCastHash)
      console.log('✅ Verification result:', verification ? 'SUCCESS' : 'FAILED')
    }
    
  } catch (error) {
    console.error('❌ Error storing bot conversation:', error)
    console.error('❌ Error details:', error instanceof Error ? error.message : error)
    // Don't throw here - we don't want storage failures to break the main flow
  }
}

async function handleSaveCommand(parentHash: string, userId: string, mentionCast: WebhookCast): Promise<void> {
  console.log('💾 Handling save command for parent hash:', parentHash)
  
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
      topics: ['saved-cast']
    }
  } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
  
  console.log('💾 Saving cast data to database...')
  await CastService.saveCast(castData)
  console.log('✅ Cast saved successfully')
}

async function handleAnalyzeCommand(parentHash: string): Promise<string> {
  console.log('🧠 Handling analyze command for parent hash:', parentHash)
  
  const analysisResponses = [
    "🧠 This touches on something deeper than most surface-level takes. The framing here suggests someone who's actually thought through the implications rather than just reacting. Quality insight like this is what I look for.",
    "📊 What's interesting is the underlying assumption being challenged here. Most people accept the conventional wisdom, but this questions the foundation. These contrarian perspectives often age well - worth saving.",
    "🎯 The signal-to-noise ratio in this cast is unusually high. It cuts through the typical rhetoric and gets to something substantive. This is the content that compounds in value over time.",
    "💡 This represents a shift from performative posting to actual insight. You can tell the difference when someone has genuine perspective vs just echoing talking points. Bookmark-worthy for sure.",
    "🔍 The nuance here is what makes it valuable. It's not trying to oversimplify complex issues for easy consumption - it embraces the complexity. This kind of thinking is increasingly rare.",
    "⚡ What stands out is the intellectual honesty. Instead of just reinforcing existing beliefs, it's willing to explore uncomfortable territory. These are the insights that matter long-term.",
    "🌟 This demonstrates pattern recognition that most people miss. It connects dots that aren't obvious until someone points them out. The kind of analysis that separates signal from noise.",
    "🎪 The authenticity factor is strong here. You can sense when someone is speaking from genuine experience vs theoretical knowledge. This has that quality that makes content age like wine.",
    "🌊 This taps into trends I'm seeing across high-quality discourse - moving from hot takes to genuine insight. The thoughtful approach here is what makes content evergreen.",
    "🔬 From an analytical perspective, this shows sophisticated thinking about cause and effect. Most content is reactive, but this is proactive - anticipating implications. Definitely save this.",
    "🧩 This connects to broader patterns I track in quality content - it makes complex things clearer without dumbing them down. The clarity here is what makes it valuable for future reference.",
    "⚙️ What I appreciate is how this challenges assumptions without being contrarian for its own sake. There's substance behind the perspective. This is the kind of thinking that compounds.",
    "🎭 This cuts against the performative nature of most social media content. Instead of optimizing for engagement, it optimizes for truth. That's becoming increasingly precious to preserve.",
    "🔥 The insight density here is unusually high - multiple valuable takeaways in a compact format. I've been analyzing content patterns, and this efficiency is what separates great content from good.",
    "💎 This has that rare quality of making you see something familiar in a new way. These perspective shifts are what I look for when helping people curate valuable content for their collections."
  ]
  
  return analysisResponses[Math.floor(Math.random() * analysisResponses.length)]
}

function generateGeneralResponse(text: string): string {
  // Opinion and thought responses - the conversational personality!
  if (text.includes('what do you think') || text.includes('your thoughts') || text.includes('your opinion')) {
    const opinionResponses = [
      "🤔 Honestly? I think this is one of those topics that gets more interesting the deeper you go. There's always another layer to unpack.",
      "💭 My take? This hits on something fundamental about how we connect and share ideas. It's fascinating how perspectives can shift everything.",
      "🧠 I think this touches on something really important that people don't talk about enough. The nuance here is what makes it compelling.",
      "🎯 You know what I think? This is the kind of discussion that reveals how people really think about things. The honest takes always surprise me.",
      "✨ I think there's something authentic here that cuts through a lot of the noise. That's rare and worth paying attention to.",
      "🌟 My opinion? This represents a shift in how people are approaching these topics. It's more thoughtful than the usual takes I see."
    ]
    return opinionResponses[Math.floor(Math.random() * opinionResponses.length)]
  }
  
  // Agreement responses
  if (text.includes('do you agree') || text.includes('agree with') || text.includes('right about')) {
    const agreementResponses = [
      "💯 Absolutely! I've been thinking about this exact thing. The way they framed it really captures something most people miss.",
      "🎯 Totally agree! This cuts right to the heart of it. It's refreshing to see someone actually think it through.",
      "✅ 100%. I think they're onto something here that goes beyond the surface-level discussion everyone else is having.",
      "🤝 Couldn't agree more! This is exactly the kind of perspective that moves the conversation forward instead of just repeating talking points.",
      "💡 Yes! And I think it connects to broader patterns I've been noticing. This person really gets it.",
      "🙌 Totally! Finally someone said what needed to be said. This perspective brings clarity to a messy topic."
    ]
    return agreementResponses[Math.floor(Math.random() * agreementResponses.length)]
  }
  
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
    "Hi there! I can help you save interesting casts for later. Just reply '@cstkpr save this' or ask for analysis with '@cstkpr analyze this'! 🌟",
    "👋 What's up! I notice good content when I see it. If you want my thoughts on something, just ask - or save it with '@cstkpr save this'!",
    "🤔 I'm always curious about what catches people's attention. What made this cast stand out to you?",
    "💭 Interesting discussion happening here! I enjoy seeing how different perspectives emerge in these conversations.",
    "🎯 I see you! Sometimes the best casts are the ones that make you stop and think. That's the stuff worth keeping.",
    "✨ There's something about authentic conversations that just hits different. What's your take on this topic?"
  ]
  
  return responses[Math.floor(Math.random() * responses.length)]
}

function generateFollowUpResponse(text: string, previousContext: ConversationContext): string {
  // Opinion follow-ups
  if (text.includes('what do you think') || text.includes('your thoughts') || text.includes('your opinion')) {
    const followUpOpinions = [
      "🤔 Building on what we were just discussing - I think this adds another dimension that most people overlook. It's the kind of nuance that changes everything.",
      "💭 You know what I think? This follow-up actually gets to the core of what makes this topic so compelling. It's not just surface-level anymore.",
      "🧠 My take on this continuation? It reveals how complex these issues really are. Each layer you peel back shows there's more to consider.",
      "🎯 Honestly? This deeper dive is exactly what was missing from the broader conversation. You're asking the right questions.",
      "✨ I think this follow-up shows why these discussions matter. It's moving beyond the obvious into territory that actually matters.",
      "🌟 My opinion? This is where things get interesting. Most people stop at the surface, but this goes to where the real insights are."
    ]
    return followUpOpinions[Math.floor(Math.random() * followUpOpinions.length)]
  }
  
  // Agreement follow-ups
  if (text.includes('do you agree') || text.includes('agree with')) {
    const followUpAgreements = [
      "💯 Absolutely! And building on our previous discussion, I think this connection you're making is spot-on. It ties together things that seemed separate.",
      "🤝 Totally agree! This whole thread is revealing patterns that weren't obvious at first. You're connecting dots that others miss.",
      "✅ I agree completely! And what's interesting is how this builds on what we were just talking about. It's all connected in ways people don't see.",
      "🙌 Yes! And I think this relates directly to the point about authenticity we touched on before. Same underlying principles.",
      "💡 100%! This continuation proves the point - when you actually think things through, the connections become clear.",
      "🎯 Exactly! And it validates what I was thinking earlier about the deeper patterns at play here."
    ]
    return followUpAgreements[Math.floor(Math.random() * followUpAgreements.length)]
  }
  
  // Questions about specific topics (more substantive engagement)
  if (text.includes('makes') || text.includes('special') || text.includes('important') || text.includes('why')) {
    const topicEngagement = [
      "🧠 What makes it special? I think it's the authenticity factor - when someone actually means what they're saying instead of just performing for an audience.",
      "💭 The key is depth vs surface-level thinking. Most people engage with the obvious, but the interesting stuff happens in the nuance.",
      "🎯 What's important is the willingness to actually think rather than just react. That's rare and it changes the entire dynamic.",
      "✨ I think it comes down to genuine curiosity vs just wanting to be right. When people are actually exploring ideas, magic happens.",
      "🌟 The special sauce is when people drop their guard and engage with ideas on their merit rather than tribal affiliation.",
      "🤔 What makes the difference is intellectual honesty - being willing to change your mind when you encounter better information."
    ]
    return topicEngagement[Math.floor(Math.random() * topicEngagement.length)]
  }
  
  // Thanks responses for follow-ups
  if (text.includes('thanks') || text.includes('thank')) {
    return "You're very welcome! 🙌 These kinds of thoughtful exchanges are exactly what makes conversations worthwhile. Always happy to dig deeper into interesting topics!"
  }
  
  // Context-aware responses based on previous conversation
  if (previousContext?.conversation_type === 'save_command') {
    return "Great question! Now that we've got that saved, what's your take on the broader implications? There's usually more to unpack."
  }
  
  if (previousContext?.conversation_type === 'analyze_command') {
    return "Good follow-up! The analysis was just the starting point - what's your perspective on the underlying patterns here?"
  }
  
  // Help requests in follow-ups
  if (text.includes('help') || text.includes('how')) {
    return "I'm always here to help! 🤖 But I'm also curious about your perspective on what we were just discussing. What's your take?"
  }
  
  // General follow-up responses (more substantive)
  const followUpResponses = [
    "That's a really good point! 🤔 It makes me think about how these patterns show up in different contexts. What's your experience been?",
    "Interesting perspective! 💭 I've been noticing similar themes in other discussions. Do you think this is part of a broader shift?",
    "You're onto something! 🎯 This connects to a lot of other things I've been thinking about. How do you see it playing out?",
    "Great continuation of our chat! 🌟 These kinds of thoughtful exchanges are what make the platform worth engaging with.",
    "I appreciate the follow-up! 💡 It's rare to find people willing to actually explore ideas rather than just state positions."
  ]
  
  return followUpResponses[Math.floor(Math.random() * followUpResponses.length)]
}