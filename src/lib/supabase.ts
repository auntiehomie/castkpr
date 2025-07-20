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
  ai_category?: string
  ai_tags?: string[]
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

// Helper functions for user management
export class UserService {
  // Create or update a user
  static async upsertUser(userData: {
    fid: number
    username: string
    display_name?: string
    pfp_url?: string
    bio?: string
  }): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        fid: userData.fid,
        username: userData.username,
        display_name: userData.display_name,
        pfp_url: userData.pfp_url,
        bio: userData.bio,
        last_login: new Date().toISOString()
      }, {
        onConflict: 'fid'
      })
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
        // No rows returned
        return null
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
        // No rows returned
        return null
      }
      console.error('Error fetching user by username:', error)
      throw error
    }

    return data
  }

  // Update user profile
  static async updateUser(fid: number, updates: {
    display_name?: string
    pfp_url?: string
    bio?: string
  }): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('fid', fid)
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      throw error
    }

    return data
  }

  // Update last login
  static async updateLastLogin(fid: number): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        last_login: new Date().toISOString()
      })
      .eq('fid', fid)

    if (error) {
      console.error('Error updating last login:', error)
      throw error
    }
  }
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

  // Search casts including notes - UPDATED
  static async searchCasts(userId: string, query: string): Promise<SavedCast[]> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('saved_by_user_id', userId)
      .or(`cast_content.ilike.%${query}%,username.ilike.%${query}%,tags.cs.{${query}},notes.ilike.%${query}%`)
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

  // Update cast notes, category, tags, or parsed_data
  static async updateCast(
    castId: string, 
    userId: string, 
    updates: { 
      notes?: string; 
      category?: string; 
      tags?: string[];
      parsed_data?: ParsedData;
    }
  ): Promise<SavedCast> {
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
}

// UPDATED CollectionService with FIXED getCollectionCasts method
export class CollectionService {
  // Create a new collection
  static async createCollection(name: string, description: string, userId: string, isPublic: boolean = false): Promise<Collection> {
    console.log('🆕 Creating collection:', { name, description, userId, isPublic })
    
    const { data, error } = await supabase
      .from('collections')
      .insert({
        name: name,
        description: description || null,
        created_by: userId,
        is_public: isPublic
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating collection:', error)
      throw error
    }

    console.log('✅ Collection created:', data)
    return data
  }

  // Get user's collections
  static async getUserCollections(userId: string): Promise<Collection[]> {
    console.log('🔍 Fetching collections for user:', userId)
    
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching user collections:', error)
      throw error
    }

    console.log('✅ Found collections:', data?.length || 0)
    return data || []
  }

  // Add cast to collection
  static async addCastToCollection(castId: string, collectionId: string): Promise<void> {
    console.log('➕ Adding cast to collection:', { castId, collectionId })
    
    // Check if cast is already in collection
    const { data: existing } = await supabase
      .from('cast_collections')
      .select('*')
      .eq('cast_id', castId)
      .eq('collection_id', collectionId)
      .single()

    if (existing) {
      console.log('⚠️ Cast already in collection')
      return // Don't throw error, just silently return
    }

    const { error } = await supabase
      .from('cast_collections')
      .insert({
        cast_id: castId,
        collection_id: collectionId
      })

    if (error) {
      console.error('❌ Error adding cast to collection:', error)
      throw error
    }

    console.log('✅ Cast added to collection')
  }

  // Get casts in a collection - FIXED VERSION
  static async getCollectionCasts(collectionId: string): Promise<Array<{
    cast_id: string;
    added_at: string;
    saved_casts: SavedCast;
  }>> {
    console.log('🔍 Fetching casts for collection:', collectionId)
    
    const { data, error } = await supabase
      .from('cast_collections')
      .select(`
        cast_id,
        added_at,
        saved_casts (*)
      `)
      .eq('collection_id', collectionId)
      .order('added_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching collection casts:', error)
      throw error
    }

    console.log('✅ Raw collection casts data:', data)

    // Process the data to handle the Supabase join result properly
    const processedData = (data || []).map(item => ({
      cast_id: item.cast_id,
      added_at: item.added_at,
      saved_casts: Array.isArray(item.saved_casts) ? item.saved_casts[0] : item.saved_casts
    })).filter(item => item.saved_casts !== null && item.saved_casts !== undefined)

    console.log('✅ Processed collection casts:', processedData.length)
    return processedData
  }

  // Remove cast from collection
  static async removeCastFromCollection(castId: string, collectionId: string): Promise<void> {
    console.log('➖ Removing cast from collection:', { castId, collectionId })
    
    const { error } = await supabase
      .from('cast_collections')
      .delete()
      .eq('cast_id', castId)
      .eq('collection_id', collectionId)

    if (error) {
      console.error('❌ Error removing cast from collection:', error)
      throw error
    }

    console.log('✅ Cast removed from collection')
  }

  // Delete a collection
  static async deleteCollection(collectionId: string, userId: string): Promise<void> {
    console.log('🗑️ Deleting collection:', { collectionId, userId })
    
    // First delete all cast associations
    const { error: castError } = await supabase
      .from('cast_collections')
      .delete()
      .eq('collection_id', collectionId)

    if (castError) {
      console.error('❌ Error deleting cast associations:', castError)
    }

    // Then delete the collection
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('created_by', userId)

    if (error) {
      console.error('❌ Error deleting collection:', error)
      throw error
    }

    console.log('✅ Collection deleted')
  }

  // Update collection
  static async updateCollection(
    collectionId: string, 
    userId: string, 
    updates: { 
      name?: string; 
      description?: string; 
      is_public?: boolean; 
    }
  ): Promise<Collection> {
    console.log('📝 Updating collection:', { collectionId, userId, updates })
    
    const { data, error } = await supabase
      .from('collections')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', collectionId)
      .eq('created_by', userId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating collection:', error)
      throw error
    }

    console.log('✅ Collection updated')
    return data
  }

  // Get collection by ID (with ownership check)
  static async getCollectionById(collectionId: string, userId: string): Promise<Collection | null> {
    console.log('🔍 Fetching collection by ID:', { collectionId, userId })
    
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .eq('created_by', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('❌ Collection not found or not owned by user')
        return null
      }
      console.error('❌ Error fetching collection:', error)
      throw error
    }

    console.log('✅ Collection found')
    return data
  }

  // Get collection stats (number of casts)
  static async getCollectionStats(collectionId: string): Promise<{ castCount: number }> {
    const { count, error } = await supabase
      .from('cast_collections')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId)

    if (error) {
      console.error('Error getting collection stats:', error)
      throw error
    }

    return { castCount: count || 0 }
  }
}

// Content parsing utilities
export class ContentParser {
  static parseContent(text: string): ParsedData {
    return {
      urls: this.extractUrls(text),
      mentions: this.extractMentions(text),
      hashtags: this.extractHashtags(text),
      numbers: this.extractNumbers(text),
      dates: this.extractDates(text),
      word_count: text.split(' ').length,
      sentiment: 'neutral' // Can integrate sentiment analysis later
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
}