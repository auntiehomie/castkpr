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
  static async updateCast(castId: string, userId: string, updates: { notes?: string; category?: string; tags?: string[] }): Promise<SavedCast> {
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

  // Get casts in a collection
  static async getCollectionCasts(collectionId: string): Promise<Array<{
    cast_id: string;
    added_at: string;
    saved_casts: SavedCast;
  }>> {
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
      console.error('Error fetching collection casts:', error)
      throw error
    }

    // Transform the data to ensure saved_casts is a single object
    const transformedData = (data || []).map(item => ({
      cast_id: item.cast_id,
      added_at: item.added_at,
      saved_casts: Array.isArray(item.saved_casts) ? item.saved_casts[0] : item.saved_casts
    })).filter(item => item.saved_casts) // Filter out any items without saved_casts

    return transformedData as Array<{
      cast_id: string;
      added_at: string;
      saved_casts: SavedCast;
    }>
  }

  // Delete a collection
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

  // Update collection
  static async updateCollection(collectionId: string, userId: string, updates: { name?: string; description?: string; is_public?: boolean }): Promise<Collection> {
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
}

// User management functions
export class UserService {
  // Create or update user profile
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
        onConflict: 'fid',
        ignoreDuplicates: false
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
      if (error.code === 'PGRST116') { // No rows returned
        return null
      }
      console.error('Error fetching user by FID:', error)
      throw error
    }

    return data
  }

  // Get user activity stats
  static async getUserActivity(userId: string): Promise<{
    totalSaves: number
    averagePerWeek: number
    topTags: string[]
    streak: number
  }> {
    // Get saves from last 30 days
    const { data: weeklyStats } = await supabase
      .from('saved_casts')
      .select('created_at, tags')
      .eq('saved_by_user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const saves = weeklyStats || []

    return {
      totalSaves: saves.length,
      averagePerWeek: Math.round(saves.length / 4),
      topTags: this.getTopTags(saves),
      streak: this.calculateSaveStreak(saves)
    }
  }

  private static getTopTags(saves: Array<{ tags: string[] }>): string[] {
    const tagCounts: Record<string, number> = {}
    saves.forEach(save => {
      save.tags?.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })
    
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag)
  }

  private static calculateSaveStreak(saves: Array<{ created_at: string }>): number {
    // Calculate consecutive days with saves
    const dates = saves.map(s => new Date(s.created_at).toDateString())
    const uniqueDates = [...new Set(dates)].sort()
    
    let streak = 0
    
    for (let i = uniqueDates.length - 1; i >= 0; i--) {
      const date = new Date(uniqueDates[i])
      const daysDiff = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDiff === streak) {
        streak++
      } else {
        break
      }
    }
    
    return streak
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