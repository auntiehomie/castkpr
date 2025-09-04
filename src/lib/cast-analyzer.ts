import { ContentParser } from './supabase'
import type { ParsedData } from './supabase'

// Types for external API responses
interface NeynarCastResponse {
  cast: {
    hash: string
    text: string
    timestamp: string
    author: {
      fid: number
      username: string
      display_name?: string
      pfp_url?: string
      experimental?: {
        neynar_user_score?: number
      }
    }
    reactions: {
      likes_count: number
      recasts_count: number
    }
    replies: {
      count: number
    }
    mentioned_profiles?: Array<{
      fid: number
      username: string
      display_name?: string
      experimental?: {
        neynar_user_score?: number
      }
    }>
    embeds?: Array<{
      url?: string
      cast_id?: {
        fid: number
        hash: string
      }
    }>
    channel?: {
      id: string
      name: string
    }
  }
}

// Enhanced user quality analysis interface
interface UserQualityAnalysis {
  neynar_user_score: number | null
  quality_tier: 'high' | 'medium' | 'low' | 'unknown'
  quality_confidence: number
  quality_reasons: string[]
}

// Enhanced ParsedData interface for cast analyzer features
interface EnhancedParsedData extends ParsedData {
  topics?: string[]
  technical_terms?: string[]
  sentence_count?: number
  has_questions?: boolean
  has_exclamations?: boolean
  user_quality_analysis?: UserQualityAnalysis
  quality_score?: number
}

// Interface for our analyzed cast data
export interface AnalyzedCast {
  hash: string
  text: string
  timestamp: string
  author: {
    fid: number
    username: string
    display_name?: string
    pfp_url?: string
  }
  reactions: {
    likes_count: number
    recasts_count: number
  }
  replies: {
    count: number
  }
  parsed_data: EnhancedParsedData
  cast_url: string
  channel?: {
    id: string
    name: string
  }
  embeds?: string[]
  mentions?: Array<{
    fid: number
    username: string
    display_name?: string
  }>
}

/**
 * Analyzes user quality based on Neynar user score and other factors
 */
function analyzeUserQuality(
  neynar_user_score: number | undefined,
  follower_count?: number,
  following_count?: number,
  power_badge?: boolean
): UserQualityAnalysis {
  const score = neynar_user_score || null
  const reasons: string[] = []
  let qualityTier: 'high' | 'medium' | 'low' | 'unknown' = 'unknown'
  let confidence = 0.5
  
  if (score === null) {
    reasons.push('No Neynar user score available')
    return {
      neynar_user_score: null,
      quality_tier: 'unknown',
      quality_confidence: 0.1,
      quality_reasons: reasons
    }
  }
  
  // Neynar score analysis (primary factor)
  if (score >= 0.9) {
    qualityTier = 'high'
    confidence = 0.95
    reasons.push(`Excellent Neynar score (${score.toFixed(2)}) - top ~2.5k accounts`)
  } else if (score >= 0.7) {
    qualityTier = 'high'
    confidence = 0.85
    reasons.push(`High Neynar score (${score.toFixed(2)}) - top ~27.5k accounts`)
  } else if (score >= 0.5) {
    qualityTier = 'medium'
    confidence = 0.7
    reasons.push(`Moderate Neynar score (${score.toFixed(2)}) - recommended threshold`)
  } else if (score >= 0.3) {
    qualityTier = 'medium'
    confidence = 0.6
    reasons.push(`Below average Neynar score (${score.toFixed(2)})`)
  } else {
    qualityTier = 'low'
    confidence = 0.8
    reasons.push(`Low Neynar score (${score.toFixed(2)}) - may indicate spam or low-value content`)
  }
  
  // Additional quality signals (secondary factors)
  if (power_badge) {
    reasons.push('Has power badge - verified high-quality account')
    confidence = Math.min(confidence + 0.1, 0.98)
  }
  
  if (follower_count && following_count) {
    const ratio = follower_count / Math.max(following_count, 1)
    if (ratio > 2 && follower_count > 100) {
      reasons.push('Strong follower-to-following ratio indicating quality content')
      confidence = Math.min(confidence + 0.05, 0.98)
    } else if (ratio < 0.1 && following_count > 1000) {
      reasons.push('Low follower-to-following ratio may indicate spam behavior')
      confidence = Math.max(confidence - 0.1, 0.1)
      if (qualityTier === 'high') qualityTier = 'medium'
    }
  }
  
  return {
    neynar_user_score: score,
    quality_tier: qualityTier,
    quality_confidence: confidence,
    quality_reasons: reasons
  }
}

/**
 * Fetches cast data from Neynar API
 */
async function fetchCastFromNeynar(castHash: string): Promise<NeynarCastResponse | null> {
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
  
  if (!NEYNAR_API_KEY) {
    console.warn('⚠️ NEYNAR_API_KEY not found in environment variables')
    return null
  }

  try {
    console.log('🔍 Fetching cast from Neynar API:', castHash)
    
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
      console.error('❌ Neynar API error:', response.status, response.statusText)
      return null
    }

    const data = await response.json() as NeynarCastResponse
    console.log('✅ Successfully fetched cast from Neynar')
    return data

  } catch (error) {
    console.error('❌ Error fetching from Neynar API:', error)
    return null
  }
}

/**
 * Fetches cast data from Farcaster Hub (free alternative)
 */
async function fetchCastFromHub(castHash: string): Promise<Record<string, unknown> | null> {
  try {
    console.log('🔍 Fetching cast from Farcaster Hub:', castHash)
    
    // Convert hex hash to bytes for Hub API
    const hashBytes = castHash.startsWith('0x') ? castHash.slice(2) : castHash
    
    const response = await fetch(
      `https://hub.farcaster.xyz:2281/v1/castById?fid=1&hash=${hashBytes}`,
      {
        headers: {
          'accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error('❌ Hub API error:', response.status, response.statusText)
      return null
    }

    const data = await response.json() as Record<string, unknown>
    console.log('✅ Successfully fetched cast from Hub')
    return data

  } catch (error) {
    console.error('❌ Error fetching from Hub API:', error)
    return null
  }
}

/**
 * Creates a fallback cast structure when API calls fail
 */
function createFallbackCast(castHash: string, additionalInfo?: Partial<AnalyzedCast>): AnalyzedCast {
  console.log('🔄 Creating fallback cast structure')
  
  const fallbackText = additionalInfo?.text || `Cast saved from Farcaster - Hash: ${castHash}`
  
  // Create unknown user quality analysis for fallback
  const fallbackUserQuality: UserQualityAnalysis = {
    neynar_user_score: null,
    quality_tier: 'unknown',
    quality_confidence: 0.1,
    quality_reasons: ['No API data available']
  }
  
  return {
    hash: castHash,
    text: fallbackText,
    timestamp: additionalInfo?.timestamp || new Date().toISOString(),
    author: {
      fid: additionalInfo?.author?.fid || 0,
      username: additionalInfo?.author?.username || 'unknown',
      display_name: additionalInfo?.author?.display_name || 'Unknown User',
      pfp_url: additionalInfo?.author?.pfp_url
    },
    reactions: {
      likes_count: additionalInfo?.reactions?.likes_count || 0,
      recasts_count: additionalInfo?.reactions?.recasts_count || 0
    },
    replies: {
      count: additionalInfo?.replies?.count || 0
    },
    parsed_data: enhancedContentParsing(
      fallbackText,
      additionalInfo?.mentions?.map(m => ({ username: m.username })),
      additionalInfo?.embeds?.map(e => ({ url: e })),
      fallbackUserQuality,
      additionalInfo?.reactions?.likes_count || 0,
      additionalInfo?.reactions?.recasts_count || 0,
      additionalInfo?.replies?.count || 0
    ),
    cast_url: additionalInfo?.cast_url || `https://warpcast.com/~/conversations/${castHash}`,
    embeds: additionalInfo?.embeds || [],
    mentions: additionalInfo?.mentions || []
  }
}

/**
 * ENHANCED: Extract topics from cast content with better categorization
 */
function extractTopics(text: string): string[] {
  const topics: string[] = []
  const lowerText = text.toLowerCase()
  
  // Enhanced topic keywords with more comprehensive coverage
  const topicMap: Record<string, string[]> = {
    // Crypto & Web3
    'crypto': ['crypto', 'cryptocurrency', 'digital currency'],
    'bitcoin': ['bitcoin', 'btc'],
    'ethereum': ['ethereum', 'eth', 'ether'],
    'defi': ['defi', 'decentralized finance', 'yield farming', 'liquidity', 'staking'],
    'nft': ['nft', 'non-fungible', 'collectible', 'digital art'],
    'web3': ['web3', 'blockchain', 'dapp', 'smart contract'],
    'dao': ['dao', 'decentralized autonomous', 'governance'],
    
    // Technology
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'gpt', 'llm'],
    'programming': ['code', 'coding', 'programming', 'developer', 'dev', 'software'],
    'startup': ['startup', 'entrepreneur', 'funding', 'vc', 'investment'],
    'saas': ['saas', 'software as a service', 'b2b'],
    
    // Social & Culture
    'farcaster': ['farcaster', 'warpcast', 'cast', 'frame', 'miniapp'],
    'social-media': ['social', 'community', 'networking', 'viral'],
    'meme': ['meme', 'funny', 'lol', 'joke', 'humor', '😂', '🤣', 'based'],
    
    // Content Types
    'announcement': ['announcing', 'launch', 'release', 'new', 'introducing'],
    'question': ['question', '?', 'what', 'how', 'why', 'when', 'where'],
    'opinion': ['think', 'believe', 'opinion', 'thoughts', 'imo', 'imho'],
    'news': ['news', 'breaking', 'update', 'reported'],
    
    // Finance & Business
    'finance': ['finance', 'trading', 'market', 'price', 'bull', 'bear'],
    'business': ['business', 'company', 'revenue', 'growth', 'strategy'],
    
    // Creative & Art
    'art': ['art', 'design', 'creative', 'painting', 'artist', 'aesthetic'],
    'music': ['music', 'song', 'artist', 'album', 'concert'],
    
    // Other
    'sports': ['sports', 'game', 'team', 'player', 'season'],
    'travel': ['travel', 'trip', 'vacation', 'city', 'country'],
    'food': ['food', 'recipe', 'restaurant', 'cooking', 'meal']
  }
  
  // Check for topic matches using lowerText
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      topics.push(topic)
    }
  }
  
  // If no specific topics found, categorize by structure/content
  if (topics.length === 0) {
    if (text.includes('?')) topics.push('question')
    else if (text.includes('!')) topics.push('announcement')
    else if (lowerText.includes('gm') || lowerText.includes('good morning')) topics.push('greeting')
    else if (lowerText.includes('gn') || lowerText.includes('good night')) topics.push('greeting')
    else topics.push('discussion')
  }
  
  return [...new Set(topics)] // Remove duplicates
}

/**
 * ENHANCED: More nuanced sentiment analysis
 */
function analyzeSentiment(text: string): string {
  const lowerText = text.toLowerCase()
  
  // Enhanced sentiment keywords
  const sentimentMap = {
    positive: [
      'good', 'great', 'awesome', 'amazing', 'love', 'excellent', 'fantastic', 
      'excited', 'happy', 'bullish', 'optimistic', 'incredible', 'wonderful',
      'perfect', 'brilliant', 'outstanding', 'remarkable', 'impressive',
      '❤️', '😍', '🎉', '🚀', '💪', '🔥', '✨', '🌟'
    ],
    negative: [
      'bad', 'terrible', 'hate', 'awful', 'worse', 'disappointed', 'frustrated',
      'angry', 'sad', 'bearish', 'pessimistic', 'horrible', 'disgusting',
      'pathetic', 'useless', 'broken', 'failed', 'disaster',
      '😡', '😢', '💔', '😞', '😭', '😤', '🤮', '💩'
    ],
    neutral: [
      'okay', 'fine', 'average', 'normal', 'standard', 'typical', 'regular',
      'wondering', 'thinking', 'considering', 'maybe', 'possibly'
    ]
  }
  
  let positiveScore = 0
  let negativeScore = 0
  let neutralScore = 0
  
  // Count sentiment indicators
  sentimentMap.positive.forEach(word => {
    if (lowerText.includes(word)) positiveScore++
  })
  
  sentimentMap.negative.forEach(word => {
    if (lowerText.includes(word)) negativeScore++
  })
  
  sentimentMap.neutral.forEach(word => {
    if (lowerText.includes(word)) neutralScore++
  })
  
  // Determine overall sentiment
  if (positiveScore > negativeScore && positiveScore > neutralScore) {
    return positiveScore >= 2 ? 'very-positive' : 'positive'
  } else if (negativeScore > positiveScore && negativeScore > neutralScore) {
    return negativeScore >= 2 ? 'very-negative' : 'negative'
  } else if (neutralScore > 0 || (positiveScore === negativeScore && positiveScore > 0)) {
    return 'neutral'
  }
  
  // Default based on punctuation and structure
  if (text.includes('!')) return 'positive'
  if (text.includes('?')) return 'curious'
  
  return 'neutral'
}

/**
 * NEW: Extract potentially confusing terms for educational purposes
 */
function extractTechnicalTerms(text: string): string[] {
  const technicalTerms: string[] = []
  
  // Common technical terms that users might ask about
  const termPatterns = [
    // Crypto terms
    /\b(defi|nft|dao|dapp|smart contract|blockchain|cryptocurrency|yield farming|staking|liquidity|airdrop|tokenomics|rugpull|whale|diamond hands|paper hands|hodl|fomo|fud)\b/gi,
    
    // Tech terms
    /\b(ai|ml|api|saas|mvp|b2b|b2c|vc|ipo|agm|kpi|roi|cto|ceo|cfo)\b/gi,
    
    // Social media terms
    /\b(viral|engagement|algorithm|influencer|creator|content|monetize|brand|organic reach)\b/gi,
    
    // Web3/Farcaster specific
    /\b(farcaster|warpcast|cast|frame|miniapp|hub|signer|custody|recovery|mention|channel)\b/gi
  ]
  
  termPatterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      technicalTerms.push(...matches.map(term => term.toLowerCase()))
    }
  })
  
  return [...new Set(technicalTerms)] // Remove duplicates
}

/**
 * NEW: Calculate comprehensive quality score based on multiple factors
 */
function calculateQualityScore(
  text: string,
  userQualityAnalysis: UserQualityAnalysis,
  topics: string[],
  technicalTerms: string[],
  sentiment: string,
  wordCount: number,
  sentenceCount: number,
  hasQuestions: boolean,
  hasExclamations: boolean,
  likes_count: number = 0,
  recasts_count: number = 0,
  replies_count: number = 0
): number {
  let qualityScore = 50 // Base score

  // 1. Content Length and Depth (0-20 points)
  if (wordCount >= 50) {
    qualityScore += 20 // Comprehensive content
  } else if (wordCount >= 25) {
    qualityScore += 15 // Good length
  } else if (wordCount >= 10) {
    qualityScore += 10 // Decent length
  } else if (wordCount >= 5) {
    qualityScore += 5 // Minimal content
  }
  // Very short posts get 0 bonus points

  // 2. Topic Quality and Sophistication (0-15 points)
  const valuableTopics = ['technology', 'crypto', 'ai', 'defi', 'innovation', 'research', 'education', 'science', 'business', 'economics']
  const topicQuality = topics.filter(topic => 
    valuableTopics.some(valuable => topic.toLowerCase().includes(valuable.toLowerCase()))
  ).length
  
  if (topicQuality >= 3) {
    qualityScore += 15 // Multiple high-value topics
  } else if (topicQuality >= 2) {
    qualityScore += 12 // Two valuable topics
  } else if (topicQuality >= 1) {
    qualityScore += 8 // One valuable topic
  }

  // 3. Technical Terms and Expertise (0-10 points)
  if (technicalTerms.length >= 3) {
    qualityScore += 10 // Rich technical content
  } else if (technicalTerms.length >= 2) {
    qualityScore += 7 // Some technical depth
  } else if (technicalTerms.length >= 1) {
    qualityScore += 4 // Basic technical content
  }

  // 4. Neynar User Score (Author Credibility) (0-25 points)
  if (userQualityAnalysis.neynar_user_score !== null) {
    const neynarScore = userQualityAnalysis.neynar_user_score
    if (neynarScore >= 0.9) {
      qualityScore += 25 // Top-tier author
    } else if (neynarScore >= 0.7) {
      qualityScore += 20 // High-quality author
    } else if (neynarScore >= 0.5) {
      qualityScore += 15 // Moderate-quality author
    } else if (neynarScore >= 0.3) {
      qualityScore += 10 // Below-average author
    } else {
      qualityScore += 5 // Low-quality author
    }
  } else {
    qualityScore += 10 // Default for unknown authors
  }

  // 5. Content Structure and Readability (0-10 points)
  if (sentenceCount >= 3 && wordCount >= 20) {
    qualityScore += 8 // Well-structured
  } else if (sentenceCount >= 2) {
    qualityScore += 5 // Basic structure
  }

  if (hasQuestions && !hasExclamations) {
    qualityScore += 3 // Thoughtful questioning
  } else if (hasQuestions && hasExclamations) {
    qualityScore += 1 // Mixed tone
  }

  // 6. Engagement Quality (0-10 points) - Organic vs artificial engagement
  const totalEngagement = likes_count + recasts_count + replies_count
  if (totalEngagement > 0) {
    const engagementToLength = totalEngagement / Math.max(wordCount, 1)
    if (engagementToLength > 2 && wordCount >= 10) {
      qualityScore += 10 // High organic engagement
    } else if (engagementToLength > 1) {
      qualityScore += 7 // Good engagement
    } else if (engagementToLength > 0.5) {
      qualityScore += 4 // Moderate engagement
    } else {
      qualityScore += 2 // Some engagement
    }
  }

  // 7. Sentiment Quality (0-5 points)
  if (sentiment === 'positive' || sentiment === 'very-positive') {
    qualityScore += 5 // Positive content
  } else if (sentiment === 'neutral' || sentiment === 'curious') {
    qualityScore += 3 // Balanced content
  } else if (sentiment === 'negative') {
    qualityScore += 1 // Critical but potentially valuable
  }
  // Very negative content gets 0 bonus

  // 8. Content Type Penalties
  const lowerText = text.toLowerCase()
  if (lowerText.includes('gm') && wordCount <= 3) {
    qualityScore -= 10 // Low-effort greeting
  }
  if (lowerText.match(/^[🎉🎊🔥💪✨]{2,}$/)) {
    qualityScore -= 15 // Emoji-only posts
  }
  if (text.split(' ').filter(word => word.startsWith('#')).length > 5) {
    qualityScore -= 5 // Hashtag spam
  }

  // Ensure score is within bounds
  return Math.max(0, Math.min(100, Math.round(qualityScore)))
}

/**
 * ENHANCED: Content parsing with educational and conversational features
 */
function enhancedContentParsing(
  text: string, 
  mentions?: Array<{ username: string }>, 
  embeds?: Array<{ url?: string }>,
  userQualityAnalysis?: UserQualityAnalysis,
  likes_count: number = 0,
  recasts_count: number = 0,
  replies_count: number = 0
): EnhancedParsedData {
  const basicParsing = ContentParser.parseContent(text)
  const topics = extractTopics(text)
  const sentiment = analyzeSentiment(text)
  const technicalTerms = extractTechnicalTerms(text)
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
  const sentenceCount = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length
  const hasQuestions = text.includes('?')
  const hasExclamations = text.includes('!')

  // Calculate quality score if user analysis is available
  let qualityScore = 0
  if (userQualityAnalysis) {
    qualityScore = calculateQualityScore(
      text,
      userQualityAnalysis,
      topics,
      technicalTerms,
      sentiment,
      wordCount,
      sentenceCount,
      hasQuestions,
      hasExclamations,
      likes_count,
      recasts_count,
      replies_count
    )
  }
  
  return {
    ...basicParsing,
    topics,
    sentiment,
    mentions: mentions?.map(m => m.username) || basicParsing.mentions,
    urls: embeds?.map(e => e.url).filter((url): url is string => typeof url === 'string') || basicParsing.urls,
    // Add technical terms for educational purposes
    technical_terms: technicalTerms,
    // Enhanced word count and readability
    word_count: wordCount,
    sentence_count: sentenceCount,
    // Add question detection for better conversational handling
    has_questions: hasQuestions,
    // Add exclamation detection for sentiment
    has_exclamations: hasExclamations,
    // Add quality score
    quality_score: qualityScore,
    // Store user quality analysis
    user_quality_analysis: userQualityAnalysis
  }
}

/**
 * NEW: Get conversation-friendly summary of a cast
 */
export function getCastSummary(analysis: AnalyzedCast): string {
  const { author, text, parsed_data } = analysis
  const topics = parsed_data.topics || []
  const sentiment = parsed_data.sentiment || 'neutral'
  const wordCount = parsed_data.word_count || 0
  
  let summary = `@${author.username} `
  
  // Add sentiment descriptor
  if (sentiment.includes('positive')) {
    summary += 'enthusiastically '
  } else if (sentiment.includes('negative')) {
    summary += 'critically '
  }
  
  // Add action verb based on content
  if (text.includes('?')) {
    summary += 'asks about '
  } else if (text.includes('!')) {
    summary += 'announces something about '
  } else {
    summary += 'discusses '
  }
  
  // Add main topics
  if (topics.length > 0) {
    summary += topics.slice(0, 2).join(' and ')
  } else {
    summary += 'general topics'
  }
  
  // Add length descriptor
  if (wordCount > 50) {
    summary += ' in detail'
  } else if (wordCount > 20) {
    summary += ' briefly'
  }
  
  return summary + '.'
}

/**
 * NEW: Check if cast contains educational opportunities
 */
export function hasEducationalContent(analysis: AnalyzedCast): boolean {
  const technicalTerms = analysis.parsed_data.technical_terms || []
  const topics = analysis.parsed_data.topics || []
  
  // Check for technical terms or complex topics
  return technicalTerms.length > 0 || 
         topics.some(topic => ['crypto', 'defi', 'ai', 'web3', 'dao'].includes(topic))
}

/**
 * Main function to analyze a cast by its hash
 */
export async function analyzeCast(castHash: string, fallbackInfo?: Partial<AnalyzedCast>): Promise<AnalyzedCast | null> {
  try {
    console.log('🔍 Starting cast analysis for:', castHash)

    // Try Neynar API first (most complete data)
    const castData = await fetchCastFromNeynar(castHash)
    
    if (castData?.cast) {
      console.log('✅ Using Neynar API data')
      const cast = castData.cast
      
      // Analyze user quality based on Neynar score
      const userQualityAnalysis = analyzeUserQuality(
        cast.author.experimental?.neynar_user_score,
        undefined, // follower_count not available in this response
        undefined, // following_count not available in this response
        undefined  // power_badge not available in this response
      )
      
      console.log('📊 User Quality Analysis:', {
        username: cast.author.username,
        neynar_score: userQualityAnalysis.neynar_user_score,
        quality_tier: userQualityAnalysis.quality_tier,
        confidence: userQualityAnalysis.quality_confidence
      })
      
      return {
        hash: castHash,
        text: cast.text,
        timestamp: cast.timestamp,
        author: {
          fid: cast.author.fid,
          username: cast.author.username,
          display_name: cast.author.display_name,
          pfp_url: cast.author.pfp_url
        },
        reactions: {
          likes_count: cast.reactions.likes_count,
          recasts_count: cast.reactions.recasts_count
        },
        replies: {
          count: cast.replies.count
        },
        parsed_data: {
          ...enhancedContentParsing(
            cast.text, 
            cast.mentioned_profiles,
            cast.embeds,
            userQualityAnalysis,
            cast.reactions.likes_count,
            cast.reactions.recasts_count,
            cast.replies.count
          )
        },
        cast_url: `https://warpcast.com/~/conversations/${castHash}`,
        channel: cast.channel,
        embeds: cast.embeds?.map(e => e.url).filter((url): url is string => typeof url === 'string') || [],
        mentions: cast.mentioned_profiles
      }
    }

    // Fallback to Hub API (free but less data)
    console.log('⚠️ Neynar failed, trying Hub API...')
    const hubData = await fetchCastFromHub(castHash)
    
    if (hubData) {
      console.log('✅ Using Hub API data')
      // Hub data would need to be parsed differently
      // This is a simplified implementation
      return createFallbackCast(castHash, fallbackInfo)
    }

    // Final fallback
    console.log('⚠️ All APIs failed, using fallback structure')
    return createFallbackCast(castHash, fallbackInfo)

  } catch (error) {
    console.error('❌ Error in cast analysis:', error)
    return createFallbackCast(castHash, fallbackInfo)
  }
}

/**
 * Bulk analyze multiple casts
 */
export async function analyzeCasts(castHashes: string[]): Promise<AnalyzedCast[]> {
  console.log(`🔍 Bulk analyzing ${castHashes.length} casts`)
  
  const results = await Promise.allSettled(
    castHashes.map(hash => analyzeCast(hash))
  )
  
  return results
    .filter((result): result is PromiseFulfilledResult<AnalyzedCast> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value)
}

/**
 * Utility function to validate cast hash format
 */
export function isValidCastHash(hash: string): boolean {
  const hexPattern = /^0x[a-fA-F0-9]{40}$/
  return hexPattern.test(hash)
}

/**
 * Extract cast hash from various URL formats
 */
export function extractCastHash(input: string): string | null {
  // Direct hash
  if (isValidCastHash(input)) {
    return input
  }
  
  // Warpcast URLs
  const warpcastMatch = input.match(/warpcast\.com\/.*\/conversations\/([0-9a-fA-F]+)/)
  if (warpcastMatch) {
    return `0x${warpcastMatch[1]}`
  }
  
  // Other URL patterns could be added here
  
  return null
}