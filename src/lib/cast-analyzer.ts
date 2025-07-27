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
  parsed_data: ParsedData
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
async function fetchCastFromHub(castHash: string): Promise<unknown | null> {
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

    const data = await response.json()
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
  
  return {
    hash: castHash,
    text: fallbackText,
    timestamp: new Date().toISOString(),
    author: {
      fid: additionalInfo?.author?.fid || 0,
      username: additionalInfo?.author?.username || 'unknown',
      display_name: additionalInfo?.author?.display_name || 'Unknown User',
      pfp_url: additionalInfo?.author?.pfp_url
    },
    reactions: {
      likes_count: 0,
      recasts_count: 0
    },
    replies: {
      count: 0
    },
    parsed_data: ContentParser.parseContent(fallbackText),
    cast_url: `https://warpcast.com/~/conversations/${castHash}`,
    embeds: [],
    mentions: []
  }
}

/**
 * Extracts additional topics from cast content using simple keyword matching
 */
function extractTopics(text: string): string[] {
  const topics: string[] = []
  const lowerText = text.toLowerCase()
  
  // Define topic keywords
  const topicMap: Record<string, string[]> = {
    'crypto': ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft', 'web3', 'blockchain'],
    'tech': ['ai', 'ml', 'machine learning', 'artificial intelligence', 'coding', 'programming', 'dev'],
    'social': ['community', 'social', 'networking', 'friends', 'family'],
    'business': ['startup', 'business', 'entrepreneur', 'funding', 'investment'],
    'art': ['art', 'design', 'creative', 'painting', 'music', 'artist'],
    'sports': ['sports', 'football', 'basketball', 'soccer', 'game', 'team'],
    'news': ['news', 'breaking', 'announcement', 'update', 'politics'],
    'meme': ['meme', 'funny', 'lol', 'joke', 'humor', '😂', '🤣']
  }
  
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      topics.push(topic)
    }
  }
  
  return topics
}

/**
 * Enhanced content parsing with additional analysis
 */
function enhancedContentParsing(text: string, mentions?: Array<{ username: string }>, embeds?: Array<{ url?: string }>): ParsedData {
  const basicParsing = ContentParser.parseContent(text)
  
  return {
    ...basicParsing,
    topics: extractTopics(text),
    sentiment: analyzeSentiment(text),
    mentions: mentions?.map(m => m.username) || basicParsing.mentions,
    urls: embeds?.map(e => e.url).filter(Boolean) || basicParsing.urls
  }
}

/**
 * Simple sentiment analysis
 */
function analyzeSentiment(text: string): string {
  const positiveWords = ['good', 'great', 'awesome', 'amazing', 'love', 'excellent', 'fantastic', '❤️', '😍', '🎉', '🚀']
  const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'worse', 'disappointed', '😡', '😢', '💔', '😞']
  
  const lowerText = text.toLowerCase()
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
  
  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
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
        parsed_data: enhancedContentParsing(
          cast.text, 
          cast.mentioned_profiles,
          cast.embeds
        ),
        cast_url: `https://warpcast.com/~/conversations/${castHash}`,
        channel: cast.channel,
        embeds: cast.embeds?.map(e => e.url).filter(Boolean) || [],
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