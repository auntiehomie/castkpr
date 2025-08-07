import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// TypeScript interfaces for our database tables
export interface SavedCast {
  id: string
  username: string
  fid: number
  cast_hash: string
  cast_content: string
  cast_timestamp: string
  cast_url?: string
  author_pfp_url?: string
  author_display_name?: string
  parsed_data?: ParsedData
  saved_by_user_id?: string
  created_at: string
  updated_at: string
  tags: string[]
  category?: string
  notes?: string
  likes_count: number
  replies_count: number
  recasts_count: number
}

export interface ParsedData {
  urls?: string[]
  mentions?: string[]
  hashtags?: string[]
  numbers?: number[]
  dates?: string[]
  word_count?: number
  sentiment?: string
  topics?: string[]
  
  // AI analysis fields
  ai_category?: string
  ai_tags?: string[]
  
  // Enhanced analysis fields
  quality_score?: number
  content_type?: string
  engagement_potential?: string
  entities?: {
    people?: string[]
    tokens?: string[]
    projects?: string[]
    companies?: string[]
  }
  confidence_score?: number
  analysis_version?: string
  
  // NEW: Conversational features fields
  technical_terms?: string[]      // Terms that users might ask about
  sentence_count?: number         // For readability analysis
  has_questions?: boolean         // Contains question marks
  has_exclamations?: boolean      // Contains exclamation marks
}

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

export interface User {
  id: string
  fid: number
  username: string
  display_name?: string
  pfp_url?: string
  bio?: string
  created_at: string
  updated_at: string
  last_login?: string
}

export interface Collection {
  id: string
  name: string
  description?: string
  created_by: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface CastCollection {
  cast_id: string
  collection_id: string
  added_at: string
}

// Helper functions for database operations
export class CastService {
  // Save a new cast
  static async saveCast(castData: Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>): Promise<SavedCast> {
    console.log('💾 Attempting to save cast:', castData.cast_hash)
    
    // Check if cast already exists for this user
    const { data: existing } = await supabase
      .from('saved_casts')
      .select('id')
      .eq('cast_hash', castData.cast_hash)
      .eq('saved_by_user_id', castData.saved_by_user_id)
      .single()

    if (existing) {
      console.log('⚠️ Cast already exists for this user')
      throw new Error('Cast already saved by this user')
    }

    // Insert new cast
    const { data, error } = await supabase
      .from('saved_casts')
      .insert([castData])
      .select()
      .single()

    if (error) {
      console.error('❌ Error saving cast to database:', error)
      throw error
    }

    console.log('✅ Cast saved successfully to database')
    return data
  }

  // Get all saved casts for a user
  static async getUserCasts(userId: string, limit: number = 50): Promise<SavedCast[]> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('saved_by_user_id', userId)
      .order('cast_timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching user casts:', error)
      throw error
    }

    return data || []
  }

  // Search casts
  static async searchCasts(userId: string, query: string): Promise<SavedCast[]> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('saved_by_user_id', userId)
      .or(`cast_content.ilike.%${query}%,username.ilike.%${query}%,tags.cs.{${query}}`)
      .order('cast_timestamp', { ascending: false })

    if (error) {
      console.error('Error searching casts:', error)
      throw error
    }

    return data || []
  }

  // Get cast by hash
  static async getCastByHash(castHash: string): Promise<SavedCast> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('cast_hash', castHash)
      .single()

    if (error) {
      console.error('Error fetching cast by hash:', error)
      throw error
    }

    return data
  }

  // Delete a cast
  static async deleteCast(castId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_casts')
      .delete()
      .eq('id', castId)
      .eq('saved_by_user_id', userId)

    if (error) {
      console.error('Error deleting cast:', error)
      throw error
    }
  }

  // Update cast notes or category
  static async updateCast(castId: string, userId: string, updates: { 
    notes?: string; 
    category?: string; 
    tags?: string[];
    parsed_data?: ParsedData;
  }): Promise<SavedCast> {
    const { data, error } = await supabase
      .from('saved_casts')
      .update(updates)
      .eq('id', castId)
      .eq('saved_by_user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating cast:', error)
      throw error
    }

    return data
  }

  // Get stats for a user
  static async getUserStats(userId: string): Promise<{ totalCasts: number }> {
    const { count } = await supabase
      .from('saved_casts')
      .select('*', { count: 'exact', head: true })
      .eq('saved_by_user_id', userId)

    return { totalCasts: count || 0 }
  }

  // NEW: Get casts with educational opportunities
  static async getCastsWithEducationalContent(userId: string, limit: number = 20): Promise<SavedCast[]> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('saved_by_user_id', userId)
      .not('parsed_data->technical_terms', 'is', null)
      .order('cast_timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching educational casts:', error)
      throw error
    }

    return data || []
  }

  // NEW: Search by technical terms for educational purposes
  static async searchByTechnicalTerms(userId: string, term: string): Promise<SavedCast[]> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('saved_by_user_id', userId)
      .contains('parsed_data->technical_terms', [term.toLowerCase()])
      .order('cast_timestamp', { ascending: false })

    if (error) {
      console.error('Error searching by technical terms:', error)
      throw error
    }

    return data || []
  }
}

// Helper functions for users
export class UserService {
  // Create or update user
  static async upsertUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'fid' })
      .select()
      .single()

    if (error) {
      console.error('Error upserting user:', error)
      throw error
    }

    return data
  }

  // Get user by FID
  static async getUserByFid(fid: number): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // User not found
      }
      console.error('Error fetching user by FID:', error)
      throw error
    }

    return data
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // User not found
      }
      console.error('Error fetching user by username:', error)
      throw error
    }

    return data
  }

  // Update last login
  static async updateLastLogin(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      console.error('Error updating last login:', error)
      throw error
    }
  }
}

// Helper functions for collections
export class CollectionService {
  // Create a new collection
  static async createCollection(name: string, description: string, userId: string, isPublic: boolean = false): Promise<Collection> {
    const { data, error } = await supabase
      .from('collections')
      .insert({
        name,
        description,
        created_by: userId,
        is_public: isPublic
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating collection:', error)
      throw error
    }

    return data
  }

  // Get user's collections
  static async getUserCollections(userId: string): Promise<Collection[]> {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user collections:', error)
      throw error
    }

    return data || []
  }

  // Add cast to collection
  static async addCastToCollection(castId: string, collectionId: string): Promise<void> {
    const { error } = await supabase
      .from('cast_collections')
      .insert({
        cast_id: castId,
        collection_id: collectionId
      })

    if (error) {
      console.error('Error adding cast to collection:', error)
      throw error
    }
  }

  // Get casts in a collection
  static async getCollectionCasts(collectionId: string): Promise<Array<{
    cast_id: string;
    added_at: string;
    saved_casts: SavedCast[];
  }>> {
    const { data, error } = await supabase
      .from('cast_collections')
      .select(`
        cast_id,
        added_at,
        saved_casts (*)
      `)
      .eq('collection_id', collectionId)

    if (error) {
      console.error('Error fetching collection casts:', error)
      throw error
    }

    return (data || []) as Array<{
      cast_id: string;
      added_at: string;
      saved_casts: SavedCast[];
    }>
  }

  // Update collection
  static async updateCollection(collectionId: string, userId: string, updates: { 
    name?: string; 
    description?: string; 
    is_public?: boolean;
  }): Promise<Collection> {
    const { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', collectionId)
      .eq('created_by', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating collection:', error)
      throw error
    }

    return data
  }

  // Delete collection
  static async deleteCollection(collectionId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('created_by', userId)

    if (error) {
      console.error('Error deleting collection:', error)
      throw error
    }
  }

  // Remove cast from collection
  static async removeCastFromCollection(castId: string, collectionId: string): Promise<void> {
    const { error } = await supabase
      .from('cast_collections')
      .delete()
      .eq('cast_id', castId)
      .eq('collection_id', collectionId)

    if (error) {
      console.error('Error removing cast from collection:', error)
      throw error
    }
  }
}

// Enhanced content parsing utilities with conversational features
export class ContentParser {
  static parseContent(text: string): ParsedData {
    return {
      urls: this.extractUrls(text),
      mentions: this.extractMentions(text),
      hashtags: this.extractHashtags(text),
      numbers: this.extractNumbers(text),
      dates: this.extractDates(text),
      word_count: this.countWords(text),
      sentiment: 'neutral', // Can integrate sentiment analysis later
      
      // NEW: Enhanced parsing for conversational features
      sentence_count: this.countSentences(text),
      has_questions: text.includes('?'),
      has_exclamations: text.includes('!'),
      technical_terms: this.extractTechnicalTerms(text)
    }
  }

  static extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.match(urlRegex) || []
  }

  static extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g
    return [...text.matchAll(mentionRegex)].map(match => match[1])
  }

  static extractHashtags(text: string): string[] {
    const hashtagRegex = /#(\w+)/g
    return [...text.matchAll(hashtagRegex)].map(match => match[1])
  }

  static extractNumbers(text: string): number[] {
    const numberRegex = /\d+(?:\.\d+)?/g
    return (text.match(numberRegex) || []).map(Number)
  }

  static extractDates(text: string): string[] {
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/g
    return text.match(dateRegex) || []
  }

  // NEW: Enhanced word counting
  static countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  // NEW: Sentence counting
  static countSentences(text: string): number {
    return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length
  }

  // NEW: Extract technical terms that users might ask about
  static extractTechnicalTerms(text: string): string[] {
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
}