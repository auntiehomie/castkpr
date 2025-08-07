import { NextRequest, NextResponse } from 'next/server'
import { CastService, BotConversationService, supabase } from '@/lib/supabase'
import type { SavedCast, ParsedData } from '@/lib/supabase'

// Type definitions for webhook data
interface CastAuthor {
  fid: number
  username: string
  display_name?: string
  pfp_url?: string
}

interface MentionedProfile {
  username?: string
  fid?: number
}

interface WebhookCast {
  text: string
  author: CastAuthor
  parent_author?: CastAuthor
  parent_hash?: string
  mentioned_profiles?: MentionedProfile[]
}

interface WebhookBody {
  type: string
  data: WebhookCast
}

interface BotResponse {
  commandType: string
  response: string
  contextData: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Webhook received!')
    
    const body = await request.json() as WebhookBody
    
    if (body.type !== 'cast.created') {
      return NextResponse.json({ message: 'Event type not handled' })
    }
    
    const cast = body.data
    console.log('📝 Processing cast from:', cast.author.username)
    
    // Check for mentions
    const mentions = cast.mentioned_profiles || []
    const mentionsBot = mentions.some((profile: MentionedProfile) => {
      return profile.username === 'cstkpr'
    })
    
    if (!mentionsBot) {
      return NextResponse.json({ message: 'Bot not mentioned' })
    }
    
    const text = cast.text.toLowerCase()
    const userId = cast.author.username
    const parentHash = cast.parent_hash
    
    console.log('💬 Cast text:', text)
    console.log('👆 Parent hash:', parentHash)
    
    // Determine command type and generate response
    const { commandType, response, contextData } = await generateBotResponse(text, userId, parentHash ?? null, cast)
    
    // Save the conversation using service role bypass
    try {
      await saveConversationWithBypass({
        user_id: userId,
        user_fid: cast.author.fid,
        parent_cast_hash: parentHash || undefined,
        user_message: cast.text,
        bot_response: response,
        command_type: commandType,
        context_data: contextData
      })
      console.log('✅ Conversation saved successfully')
    } catch (conversationError) {
      console.error('❌ Failed to save conversation, but continuing:', conversationError)
      // Don't fail the entire webhook if conversation saving fails
    }
    
    // Handle save command specifically
    if (commandType === 'save' && parentHash) {
      try {
        await handleSaveCommand(cast, parentHash)
        console.log('✅ Cast saved successfully')
      } catch (saveError) {
        console.error('❌ Failed to save cast:', saveError)
        // Continue even if save fails
      }
    }
    
    // TODO: Send response back to Farcaster
    // You'll need to implement the actual reply mechanism here
    // This could be via Neynar API, direct Farcaster API, etc.
    
    return NextResponse.json({ 
      success: true, 
      message: 'Conversation processed',
      command_type: commandType,
      response_preview: response.substring(0, 100) + '...'
    })
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Bypass RLS for bot conversation saving
async function saveConversationWithBypass(conversationData: {
  user_id: string
  user_fid: number
  parent_cast_hash?: string
  user_message: string
  bot_response: string
  command_type: string
  context_data?: Record<string, unknown>
}) {
  // Direct insert bypassing RLS by using raw SQL
  const { data, error } = await supabase.rpc('insert_bot_conversation', {
    p_user_id: conversationData.user_id,
    p_user_fid: conversationData.user_fid,
    p_parent_cast_hash: conversationData.parent_cast_hash,
    p_user_message: conversationData.user_message,
    p_bot_response: conversationData.bot_response,
    p_command_type: conversationData.command_type,
    p_context_data: conversationData.context_data || {}
  })

  if (error) {
    console.error('❌ Error saving conversation with bypass:', error)
    throw error
  }

  return data
}

async function generateBotResponse(
  text: string, 
  userId: string, 
  parentHash: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _cast: WebhookCast
): Promise<BotResponse> {
  
  // Get conversation history for context (with error handling)
  let conversationHistory: unknown[] = []
  try {
    conversationHistory = await BotConversationService.getConversationHistory(userId, parentHash || undefined, 3)
  } catch (historyError) {
    console.log('⚠️ Could not fetch conversation history, continuing without context:', historyError)
  }
  
  // Determine command type
  let commandType = 'unknown'
  let response = ''
  const contextData: Record<string, unknown> = {}
  
  if (text.includes('save this') || text.includes('save')) {
    commandType = 'save'
    response = "💾 Saved! I'll remember this cast for you. You can find it in your CastKPR dashboard."
    
  } else if (text.includes('what do you think') || text.includes('opinion') || text.includes('thoughts')) {
    commandType = 'opinion'
    
    if (parentHash) {
      // Try to get info about the parent cast, but don't fail if not found
      const savedCast = await getSavedCastByHash(parentHash)
      response = generateOpinionResponse(savedCast, conversationHistory)
      contextData.opinion_about = 'cast'
      contextData.cast_hash = parentHash
      contextData.sentiment = 'analyzed'
      contextData.cast_found = savedCast !== null
    } else {
      response = "🤔 I'd love to share my thoughts! What specific cast or topic would you like my opinion on?"
    }
    
  } else if (text.includes('explain') || text.includes('what does') || text.includes('what is')) {
    commandType = 'explain'
    
    // Extract what they want explained
    const termToExplain = extractTermToExplain(text)
    response = generateExplanation(termToExplain)
    contextData.explained_term = termToExplain
    contextData.explanation_type = 'technical'
    
  } else if (text.includes('analyze') || text.includes('breakdown')) {
    commandType = 'analyze'
    
    if (parentHash) {
      const savedCast = await getSavedCastByHash(parentHash)
      response = generateAnalysis(savedCast)
      contextData.analysis_type = 'cast_content'
      contextData.cast_hash = parentHash
      contextData.cast_found = savedCast !== null
    } else {
      response = "📊 I can analyze any cast for you! Which one would you like me to break down?"
    }
    
  } else if (text.includes('stats') || text.includes('how many')) {
    commandType = 'stats'
    try {
      const userStats = await CastService.getUserStats(userId)
      response = `📈 Your CastKPR stats: ${userStats.totalCasts} saved casts! You're building quite the collection.`
      contextData.stats = userStats
    } catch (statsError) {
      console.error('Error getting user stats:', statsError)
      response = "📈 I'm having trouble accessing your stats right now, but I'm sure you're building a great collection!"
    }
    
  } else if (text.includes('help')) {
    commandType = 'help'
    response = generateHelpResponse()
    
  } else if (conversationHistory.length > 0) {
    // This is a follow-up in an existing conversation
    commandType = 'followup'
    response = generateFollowupResponse(text, conversationHistory)
    contextData.followup_to = (conversationHistory[0] as { command_type?: string })?.command_type
    contextData.conversation_length = conversationHistory.length
    
  } else {
    commandType = 'general'
    response = "👋 Hey! I'm cstkpr, your cast-saving companion. Try '@cstkpr save this' to save a cast, or ask me for opinions, explanations, or analysis!"
  }
  
  return { commandType, response, contextData }
}

async function getSavedCastByHash(castHash: string): Promise<SavedCast | null> {
  try {
    return await CastService.getCastByHash(castHash)
  } catch (error) {
    console.log(`ℹ️ Cast ${castHash} not found in saved casts (this is normal for new casts)`)
    return null
  }
}

function generateOpinionResponse(savedCast: SavedCast | null, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _history: unknown[]): string {
  if (!savedCast) {
    // More engaging response for unsaved casts
    const responses = [
      "🤔 Interesting cast! Even though I haven't saved it yet, it definitely caught my attention.",
      "💭 This looks intriguing! I'd need to save it first to give you my full analysis, but first impressions are positive.",
      "🎯 Good find! This seems like the kind of content worth discussing deeper.",
      "💡 I can tell this has potential! Want me to save it so I can give you a more detailed take?",
      "🌟 This definitely seems worth exploring further. Mind if I save it for a proper analysis?"
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }
  
  const responses = [
    `💭 This cast hits different! The way ${savedCast.author_display_name || savedCast.username} framed it shows real insight.`,
    `🔥 Strong take! I particularly appreciate how this ties into broader themes we've been seeing.`,
    `🎯 This is exactly the kind of content that moves conversations forward. Great save!`,
    `💡 The technical depth here is impressive. This person knows their stuff.`,
    `🌟 I love casts like this - they make you think beyond the surface level.`
  ]
  
  return responses[Math.floor(Math.random() * responses.length)]
}

function generateExplanation(term: string): string {
  // You could integrate with an AI service here, or maintain a knowledge base
  const explanations: Record<string, string> = {
    'defi': '🏦 DeFi (Decentralized Finance) lets you do banking stuff like lending, borrowing, and trading without traditional banks - all powered by smart contracts!',
    'nft': '🎨 NFTs (Non-Fungible Tokens) are unique digital certificates that prove you own a specific digital item, like art, music, or collectibles.',
    'dao': '🏛️ A DAO (Decentralized Autonomous Organization) is like a company where members vote on decisions instead of having traditional management.',
    'yield farming': '🌾 Yield farming is when you lend your crypto to earn rewards - like getting interest at a bank, but usually with higher returns and risks.',
    'farcaster': '💜 Farcaster is a decentralized social network where you own your identity and data - think Twitter, but you control everything!',
    'frames': '🖼️ Frames are interactive mini-apps that live inside Farcaster casts - they let you do things like vote, mint, or play games right in your feed!'
  }
  
  const explanation = explanations[term.toLowerCase()]
  if (explanation) {
    return explanation
  }
  
  return `🤔 Great question about "${term}"! I don't have that in my knowledge base yet, but I'm always learning. Try asking in a more specific way?`
}

function generateAnalysis(savedCast: SavedCast | null): string {
  if (!savedCast) {
    return "📊 I'd love to analyze this cast! Want me to save it first with '@cstkpr save this' so I can give you a full breakdown with all the engagement metrics?"
  }
  
  const parsedData = savedCast.parsed_data as ParsedData | undefined
  const wordCount = parsedData?.word_count || 0
  const hasLinks = (parsedData?.urls?.length || 0) > 0
  const hasMentions = (parsedData?.mentions?.length || 0) > 0
  const hasHashtags = (parsedData?.hashtags?.length || 0) > 0
  
  let analysis = `📊 Cast Analysis:\n\n`
  analysis += `📝 ${wordCount} words - ${wordCount > 50 ? 'detailed take' : 'concise message'}\n`
  
  if (hasLinks && parsedData?.urls) {
    analysis += `🔗 ${parsedData.urls.length} link(s) - good supporting content\n`
  }
  if (hasMentions && parsedData?.mentions) {
    analysis += `👥 ${parsedData.mentions.length} mention(s) - engaging with community\n`
  }
  if (hasHashtags && parsedData?.hashtags) {
    analysis += `🏷️ ${parsedData.hashtags.length} hashtag(s) - good discoverability\n`
  }
  
  analysis += `\n💡 Overall: ${generateOverallAnalysis()}`
  
  return analysis
}

function generateOverallAnalysis(): string {
  const analyses = [
    "Strong content with good engagement potential!",
    "Thoughtful post that adds value to the conversation.",
    "Well-structured content that's easy to follow.",
    "Great use of the platform's features for maximum reach.",
    "This cast demonstrates deep understanding of the topic."
  ]
  
  return analyses[Math.floor(Math.random() * analyses.length)]
}

function extractTermToExplain(text: string): string {
  // Simple extraction - you could make this more sophisticated
  const patterns = [
    /what (?:does|is) ([a-zA-Z0-9\s]+?)[\?\s]/i,
    /explain ([a-zA-Z0-9\s]+?)[\?\s]/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim().toLowerCase()
    }
  }
  
  return 'that term'
}

function generateFollowupResponse(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _text: string, 
  history: unknown[]): string {
  const lastInteraction = history[0] as { command_type?: string } | undefined
  
  if (lastInteraction?.command_type === 'opinion') {
    return "🤔 You want me to dig deeper? I think there are definitely more layers to unpack here..."
  } else if (lastInteraction?.command_type === 'explain') {
    return "💡 Ah, want more details? Let me break that down further for you..."
  } else if (lastInteraction?.command_type === 'analyze') {
    return "📊 Good point! There are definitely other angles to consider in this analysis..."
  }
  
  return "👍 I see what you're getting at! Let's keep this conversation going..."
}

function generateHelpResponse(): string {
  return `🤖 cstkpr here! I can help you:

💾 Save casts: "@cstkpr save this"
🤔 Get opinions: "@cstkpr what do you think?"
📚 Explain terms: "@cstkpr explain defi"
📊 Analyze content: "@cstkpr analyze this"
📈 Your stats: "@cstkpr stats"

Just mention me and ask away! 🚀`
}

async function handleSaveCommand(cast: WebhookCast, parentHash: string): Promise<void> {
  // Your existing save logic
  const castData: Omit<SavedCast, 'id' | 'created_at' | 'updated_at'> = {
    username: `user-${cast.parent_author?.fid || 'unknown'}`,
    fid: cast.parent_author?.fid || 0,
    cast_hash: parentHash,
    cast_content: `🔗 Cast saved from Farcaster - Hash: ${parentHash}`,
    cast_timestamp: new Date().toISOString(),
    tags: ['saved-via-bot'],
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
      sentiment: 'neutral',
      topics: ['saved-cast']
    }
  }
  
  await CastService.saveCast(castData)
}