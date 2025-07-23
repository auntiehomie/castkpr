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

// Enhanced CastService with auto-vault creation
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
    
    // Auto-create vaults for initial tags
    if (castData.tags && castData.tags.length > 0 && castData.saved_by_user_id) {
      this.createVaultsForTags(castData.tags, castData.saved_by_user_id, data.id).catch(error => {
        console.error('Background vault creation failed:', error)
      })
    }
    
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

  // Search casts including notes
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

  // Enhanced updateCast method that triggers auto-vault creation
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

    // Auto-create vaults for new tags
    if (updates.tags) {
      // Don't await this - run in background
      this.createVaultsForTags(updates.tags, userId, castId).catch(error => {
        console.error('Background vault creation failed:', error)
      })
    }

    return data
  }

  // Update cast with automatic vault creation (explicit method)
  static async updateCastWithAutoVaults(
    castId: string, 
    userId: string, 
    updates: { 
      notes?: string; 
      category?: string; 
      tags?: string[];
      parsed_data?: ParsedData;
    }
  ): Promise<SavedCast> {
    // First update the cast
    const updatedCast = await this.updateCast(castId, userId, updates)
    
    // If tags were updated, create vaults for new tags
    if (updates.tags) {
      await this.createVaultsForTags(updates.tags, userId, castId)
    }
    
    return updatedCast
  }

  // Create vaults for tags automatically
  static async createVaultsForTags(tags: string[], userId: string, castId: string): Promise<void> {
    try {
      console.log('🏗️ Auto-creating vaults for tags:', tags)
      
      // Get existing vaults to avoid duplicates
      const existingVaults = await CollectionService.getUserCollections(userId)
      const existingVaultNames = new Set(existingVaults.map(v => v.name.toLowerCase()))
      
      for (const tag of tags) {
        const cleanTag = tag.toLowerCase().trim()
        
        // Skip system tags and tags that already have vaults
        if (cleanTag === 'saved-via-bot' || existingVaultNames.has(cleanTag) || cleanTag.length < 2) {
          continue
        }
        
        try {
          // Create vault for this tag
          const vault = await CollectionService.createCollection(
            cleanTag,
            `AI created vault`,
            userId,
            false
          )
          
          console.log(`✅ Created vault for tag: ${cleanTag}`)
          
          // Add this cast to the new vault
          await CollectionService.addCastToCollection(castId, vault.id)
          
          // Find other casts with this tag and add them too
          const allUserCasts = await this.getUserCasts(userId, 1000)
          const castsWithTag = allUserCasts.filter(cast => {
            const allCastTags = [
              ...(cast.tags || []),
              ...(cast.parsed_data?.ai_tags || []),
              ...(cast.parsed_data?.hashtags || [])
            ].map(t => t.toLowerCase())
            
            return allCastTags.includes(cleanTag) && cast.id !== castId
          })
          
          // Add existing casts with this tag to the vault
          for (const cast of castsWithTag) {
            try {
              await CollectionService.addCastToCollection(cast.id, vault.id)
            } catch {
              // Ignore errors (probably already in collection)
              console.log(`Cast already in vault: ${cast.id}`)
            }
          }
          
          console.log(`📁 Added ${castsWithTag.length + 1} casts to vault "${cleanTag}"`)
          
        } catch (vaultError) {
          console.error(`Error creating vault for tag "${cleanTag}":`, vaultError)
          // Continue with other tags even if one fails
        }
      }
      
    } catch (error) {
      console.error('Error in auto-vault creation:', error)
      // Don't throw - this is a nice-to-have feature
    }
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

// UPDATED CollectionService (now VaultService)
export class CollectionService {
  // Create a new collection
  static async createCollection(name: string, description: string, userId: string, isPublic: boolean = false): Promise<Collection> {
    console.log('🆕 Creating vault:', { name, description, userId, isPublic })
    
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
      console.error('❌ Error creating vault:', error)
      throw error
    }

    console.log('✅ Vault created:', data)
    return data
  }

  // Get user's collections
  static async getUserCollections(userId: string): Promise<Collection[]> {
    console.log('🔍 Fetching vaults for user:', userId)
    
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching user vaults:', error)
      throw error
    }

    console.log('✅ Found vaults:', data?.length || 0)
    return data || []
  }

  // Add cast to collection
  static async addCastToCollection(castId: string, collectionId: string): Promise<void> {
    console.log('➕ Adding cast to vault:', { castId, collectionId })
    
    // Check if cast is already in collection
    const { data: existing } = await supabase
      .from('cast_collections')
      .select('*')
      .eq('cast_id', castId)
      .eq('collection_id', collectionId)
      .single()

    if (existing) {
      console.log('⚠️ Cast already in vault')
      return // Don't throw error, just silently return
    }

    const { error } = await supabase
      .from('cast_collections')
      .insert({
        cast_id: castId,
        collection_id: collectionId
      })

    if (error) {
      console.error('❌ Error adding cast to vault:', error)
      throw error
    }

    console.log('✅ Cast added to vault')
  }

  // Get casts in a collection - ALTERNATIVE APPROACH with explicit join
  static async getCollectionCasts(collectionId: string): Promise<Array<{
    cast_id: string;
    added_at: string;
    saved_casts: SavedCast;
  }>> {
    console.log('🔍 Fetching casts for vault (alternative method):', collectionId)
    
    try {
      // Use a more explicit approach: get cast IDs first, then fetch casts
      const { data: castCollections, error: ccError } = await supabase
        .from('cast_collections')
        .select('cast_id, added_at')
        .eq('collection_id', collectionId)
        .order('added_at', { ascending: false })

      if (ccError) {
        console.error('❌ Error fetching cast_collections:', ccError)
        throw new Error(`Failed to fetch vault associations: ${ccError.message}`)
      }

      console.log('✅ Found cast associations:', castCollections?.length || 0)

      if (!castCollections || castCollections.length === 0) {
        console.log('📭 No cast associations found for this vault')
        return []
      }

      // Get the actual cast data
      const castIds = castCollections.map(cc => cc.cast_id)
      
      const { data: savedCasts, error: castError } = await supabase
        .from('saved_casts')
        .select('*')
        .in('id', castIds)

      if (castError) {
        console.error('❌ Error fetching saved casts:', castError)
        throw new Error(`Failed to fetch cast data: ${castError.message}`)
      }

      console.log('✅ Found saved casts:', savedCasts?.length || 0)

      // Combine the data
      const result = castCollections.map(cc => {
        const savedCast = savedCasts?.find(sc => sc.id === cc.cast_id)
        return {
          cast_id: cc.cast_id,
          added_at: cc.added_at,
          saved_casts: savedCast
        }
      }).filter(item => item.saved_casts !== undefined)

      console.log('✅ Final processed vault casts:', result.length)
      return result as Array<{
        cast_id: string;
        added_at: string;
        saved_casts: SavedCast;
      }>
      
    } catch (error) {
      console.error('💥 Exception in getCollectionCasts (alternative):', error)
      throw error
    }
  }

  // Remove cast from collection
  static async removeCastFromCollection(castId: string, collectionId: string): Promise<void> {
    console.log('➖ Removing cast from vault:', { castId, collectionId })
    
    const { error } = await supabase
      .from('cast_collections')
      .delete()
      .eq('cast_id', castId)
      .eq('collection_id', collectionId)

    if (error) {
      console.error('❌ Error removing cast from vault:', error)
      throw error
    }

    console.log('✅ Cast removed from vault')
  }

  // Delete a collection
  static async deleteCollection(collectionId: string, userId: string): Promise<void> {
    console.log('🗑️ Deleting vault:', { collectionId, userId })
    
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
      console.error('❌ Error deleting vault:', error)
      throw error
    }

    console.log('✅ Vault deleted')
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
    console.log('📝 Updating vault:', { collectionId, userId, updates })
    
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
      console.error('❌ Error updating vault:', error)
      throw error
    }

    console.log('✅ Vault updated')
    return data
  }

  // Get collection by ID (with ownership check)
  static async getCollectionById(collectionId: string, userId: string): Promise<Collection | null> {
    console.log('🔍 Fetching vault by ID:', { collectionId, userId })
    
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .eq('created_by', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('❌ Vault not found or not owned by user')
        return null
      }
      console.error('❌ Error fetching vault:', error)
      throw error
    }

    console.log('✅ Vault found')
    return data
  }

  // Get collection stats (number of casts)
  static async getCollectionStats(collectionId: string): Promise<{ castCount: number }> {
    const { count, error } = await supabase
      .from('cast_collections')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId)

    if (error) {
      console.error('Error getting vault stats:', error)
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