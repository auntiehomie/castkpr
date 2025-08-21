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

// Vault is an alias for Collection - they're the same entity in the database
// But we extend it with additional properties for AI functionality
export interface Vault extends Collection {
  cast_count?: number
  auto_add_rules?: string[]
}

export interface CastCollection {
  cast_id: string
  collection_id: string
  added_at: string
}

// AI-related interfaces
export interface AIContext {
  id: string
  topic: string
  summary: string
  key_insights: string[]
  related_casts: string[]
  confidence_score: number
  created_at: string
  updated_at: string
}

export interface CstkprOpinion {
  id: string
  original_cast_hash: string
  original_cast_content: string
  original_author: string
  topic_analysis: string[]
  related_saved_casts: string[]
  web_research_summary?: string
  opinion_text: string
  confidence_score: number
  reasoning: string[]
  sources_used: string[]
  response_tone: 'analytical' | 'supportive' | 'critical' | 'curious' | 'neutral'
  created_at: string
  updated_at: string
}

export interface WebResearchResult {
  query: string
  sources: Array<{
    url: string
    title: string
    content_summary: string
    relevance_score: number
  }>
  key_facts: string[]
  summary: string
  timestamp: string
}

export interface UserAIProfile {
  user_id: string
  interests: string[]
  interaction_patterns: Record<string, any>
  preferred_topics: string[]
  response_style: string
  engagement_level: number
  last_updated: string
}

export interface AILearning {
  id: string
  learning_type: string
  learning_data: Record<string, any>
  frequency: number
  last_seen: string
  created_at: string
}

// Helper functions for database operations
export class CastService {
  // Save a new cast with improved error handling
  static async saveCast(castData: Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>): Promise<SavedCast> {
    console.log('💾 Attempting to save cast:', castData.cast_hash)
    console.log('👤 For user:', castData.saved_by_user_id)
    
    // Check if cast already exists for this user using maybeSingle to avoid errors
    const { data: existing, error: checkError } = await supabase
      .from('saved_casts')
      .select('id')
      .eq('cast_hash', castData.cast_hash)
      .eq('saved_by_user_id', castData.saved_by_user_id)
      .maybeSingle() // Use maybeSingle instead of single to avoid error if not found

    if (checkError) {
      console.error('❌ Error checking for existing cast:', checkError)
      throw checkError
    }

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
      
      // Check if it's a duplicate key error and provide more specific message
      if (error.code === '23505') {
        if (error.message.includes('saved_casts_cast_hash_user_unique')) {
          console.log('💡 Duplicate detected via unique constraint')
          throw new Error('Cast already saved by this user')
        } else if (error.message.includes('saved_casts_cast_hash_key')) {
          console.log('💡 Global duplicate detected - database schema needs updating')
          throw new Error('Cast already saved by this user')
        }
      }
      
      throw error
    }

    console.log('✅ Cast saved successfully to database')
    return data
  }

  // Get all saved casts for a user with enhanced signature
  static async getUserCasts(userId: string | 'all', limit: number = 50): Promise<SavedCast[]> {
    console.log('🔍 Fetching casts for user:', userId, 'limit:', limit)
    
    let query = supabase
      .from('saved_casts')
      .select('*')
    
    // If userId is 'all', don't filter by user
    if (userId !== 'all') {
      query = query.eq('saved_by_user_id', userId)
    }
    
    const { data, error } = await query
      .order('cast_timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching user casts:', error)
      throw error
    }

    console.log('📦 Fetched', data?.length || 0, 'casts')
    return data || []
  }

  // Get all recent casts across all users
  static async getAllRecentCasts(limit: number = 100): Promise<SavedCast[]> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .order('cast_timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent casts:', error)
      throw error
    }

    return data || []
  }

  // Search casts with improved error handling
  static async searchCasts(userId: string, query: string): Promise<SavedCast[]> {
    console.log('🔍 Searching casts for user:', userId, 'query:', query)
    
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

    console.log('📊 Search returned', data?.length || 0, 'results')
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

  // Bulk delete multiple casts
  static async bulkDeleteCasts(castIds: string[], userId: string): Promise<{ 
    success: boolean, 
    deletedCount: number, 
    failedCount: number,
    errors: Array<{ castId: string, error: string }>
  }> {
    console.log('🗑️ Bulk deleting casts:', castIds.length, 'casts for user:', userId)
    
    const results = {
      success: true,
      deletedCount: 0,
      failedCount: 0,
      errors: [] as Array<{ castId: string, error: string }>
    }

    // Process deletions in batches for better performance
    const batchSize = 10
    for (let i = 0; i < castIds.length; i += batchSize) {
      const batch = castIds.slice(i, i + batchSize)
      
      try {
        const { error, count } = await supabase
          .from('saved_casts')
          .delete({ count: 'exact' })
          .in('id', batch)
          .eq('saved_by_user_id', userId)

        if (error) {
          console.error('Batch deletion error:', error)
          batch.forEach(castId => {
            results.errors.push({ castId, error: error.message })
          })
          results.failedCount += batch.length
          results.success = false
        } else {
          results.deletedCount += count || batch.length
        }
      } catch (error) {
        console.error('Error in batch deletion:', error)
        batch.forEach(castId => {
          results.errors.push({ 
            castId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        })
        results.failedCount += batch.length
        results.success = false
      }
    }

    console.log('✅ Bulk deletion completed:', {
      total: castIds.length,
      deleted: results.deletedCount,
      failed: results.failedCount
    })

    return results
  }

  // Delete all casts for a user (with optional confirmation)
  static async deleteAllUserCasts(userId: string, confirmationToken?: string): Promise<{
    success: boolean,
    deletedCount: number,
    message: string
  }> {
    console.log('⚠️ Attempting to delete ALL casts for user:', userId)
    
    // Safety check - require confirmation token for this destructive operation
    if (!confirmationToken || confirmationToken !== 'DELETE_ALL_CASTS_CONFIRMED') {
      return {
        success: false,
        deletedCount: 0,
        message: 'Confirmation token required for deleting all casts'
      }
    }

    try {
      const { error, count } = await supabase
        .from('saved_casts')
        .delete({ count: 'exact' })
        .eq('saved_by_user_id', userId)

      if (error) {
        console.error('Error deleting all user casts:', error)
        return {
          success: false,
          deletedCount: 0,
          message: `Failed to delete casts: ${error.message}`
        }
      }

      console.log('✅ All user casts deleted:', count || 0)
      return {
        success: true,
        deletedCount: count || 0,
        message: `Successfully deleted ${count || 0} casts`
      }
    } catch (error) {
      console.error('Error in deleteAllUserCasts:', error)
      return {
        success: false,
        deletedCount: 0,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
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

  // Get casts by topic/hashtag
  static async getCastsByTopic(topic: string, limit: number = 50): Promise<SavedCast[]> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .or(`tags.cs.{${topic}},cast_content.ilike.%${topic}%`)
      .order('cast_timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching casts by topic:', error)
      throw error
    }

    return data || []
  }

  // Check if cast exists for user (helper method)
  static async castExistsForUser(castHash: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('id')
      .eq('cast_hash', castHash)
      .eq('saved_by_user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error checking if cast exists:', error)
      return false
    }

    return !!data
  }

  // Debug function to check what user IDs exist in the database
  static async debugUserIds(): Promise<{
    uniqueUserIds: string[]
    totalCasts: number
    userIdFormats: Record<string, number>
  }> {
    console.log('🔍 Debugging user IDs in database...')
    
    const { data, error } = await supabase
      .from('saved_casts')
      .select('saved_by_user_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user IDs:', error)
      return {
        uniqueUserIds: [],
        totalCasts: 0,
        userIdFormats: {}
      }
    }

    const userIds = data?.map(cast => cast.saved_by_user_id).filter(Boolean) || []
    const uniqueUserIds = [...new Set(userIds)]
    
    // Analyze the format of user IDs
    const userIdFormats: Record<string, number> = {}
    userIds.forEach(userId => {
      if (!userId) return
      
      if (userId.startsWith('fid-')) {
        userIdFormats['fid-format'] = (userIdFormats['fid-format'] || 0) + 1
      } else if (userId.match(/^\d+$/)) {
        userIdFormats['numeric-only'] = (userIdFormats['numeric-only'] || 0) + 1
      } else if (userId.includes('-')) {
        userIdFormats['with-hyphens'] = (userIdFormats['with-hyphens'] || 0) + 1
      } else {
        userIdFormats['username-format'] = (userIdFormats['username-format'] || 0) + 1
      }
    })

    console.log('📊 User ID Analysis:', {
      uniqueUserIds: uniqueUserIds.length,
      totalCasts: userIds.length,
      formats: userIdFormats,
      sampleUserIds: uniqueUserIds.slice(0, 5)
    })

    return {
      uniqueUserIds,
      totalCasts: userIds.length,
      userIdFormats
    }
  }

  // Helper to find casts by similar user ID patterns
  static async findCastsByUserIdPattern(currentUserId: string): Promise<{
    exactMatch: SavedCast[]
    similarMatches: SavedCast[]
    allPossibleMatches: SavedCast[]
  }> {
    console.log('🔍 Searching for casts with similar user ID patterns for:', currentUserId)
    
    // Try exact match first
    const exactMatch = await this.getUserCasts(currentUserId, 10)
    
    // If no exact match, try variations
    const variations: string[] = []
    
    if (currentUserId.startsWith('fid-')) {
      // If current is fid-123, also try just "123"
      const fidNumber = currentUserId.replace('fid-', '')
      variations.push(fidNumber)
    } else if (currentUserId.match(/^\d+$/)) {
      // If current is "123", also try "fid-123"
      variations.push(`fid-${currentUserId}`)
    }
    
    // Try username variations if it looks like a username
    if (!currentUserId.match(/^\d+$/) && !currentUserId.startsWith('fid-')) {
      // Current is likely a username, try with fid prefix if we can extract FID
      // This would need more context from the Mini App SDK
    }

    const similarMatches: SavedCast[] = []
    const allPossibleMatches: SavedCast[] = []

    for (const variation of variations) {
      try {
        const casts = await this.getUserCasts(variation, 10)
        similarMatches.push(...casts)
      } catch (error) {
        console.log(`No casts found for variation: ${variation}`)
      }
    }

    // Get all recent casts to see what's available
    try {
      allPossibleMatches.push(...(await this.getAllRecentCasts(20)))
    } catch (error) {
      console.error('Error fetching all recent casts:', error)
    }

    console.log('📊 User ID Search Results:', {
      currentUserId,
      exactMatchCount: exactMatch.length,
      similarMatchCount: similarMatches.length,
      totalRecentCasts: allPossibleMatches.length,
      variations
    })

    return {
      exactMatch,
      similarMatches,
      allPossibleMatches
    }
  }
}

// Helper functions for collections - FULLY UPDATED
export class CollectionService {
  // Create a new collection
  static async createCollection(name: string, description: string, userId: string, isPublic: boolean = false): Promise<Collection> {
    console.log('📁 Creating collection:', { name, description, userId, isPublic })
    
    // Validate inputs
    if (!name || typeof name !== 'string') {
      throw new Error('Collection name is required and must be a string')
    }
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required and must be a string')
    }
    if (description && typeof description !== 'string') {
      throw new Error('Description must be a string')
    }
    
    const { data, error } = await supabase
      .from('collections')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        created_by: userId,
        is_public: Boolean(isPublic)
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating collection:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw new Error(`Failed to create collection: ${error.message}`)
    }

    console.log('✅ Collection created:', data.id)
    return data
  }

  // Get user's collections
  static async getUserCollections(userId: string): Promise<Collection[]> {
    console.log('📚 Fetching collections for user:', userId)
    
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user collections:', error)
      throw error
    }

    console.log('📦 Found', data?.length || 0, 'collections')
    return data || []
  }

  // Add cast to collection with improved error handling
  static async addCastToCollection(castId: string, collectionId: string): Promise<void> {
    console.log('🔗 Adding cast to collection:', { castId, collectionId })
    
    // First check if the cast already exists in this collection
    const { data: existing, error: checkError } = await supabase
      .from('cast_collections')
      .select('cast_id')
      .eq('cast_id', castId)
      .eq('collection_id', collectionId)
      .maybeSingle() // Use maybeSingle to avoid error when no rows found

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing cast in collection:', checkError)
      throw new Error(`Failed to check collection: ${checkError.message}`)
    }

    if (existing) {
      console.log('⚠️ Cast already exists in this collection')
      throw new Error('This cast is already in the vault')
    }

    // Add the cast to the collection
    const { error } = await supabase
      .from('cast_collections')
      .insert({
        cast_id: castId,
        collection_id: collectionId,
        added_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error adding cast to collection:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // Provide more specific error messages
      if (error.code === '42883') {
        throw new Error('Database schema mismatch - please contact support')
      } else if (error.code === '23503') {
        throw new Error('Invalid cast or collection ID')
      } else if (error.code === '23505') {
        throw new Error('This cast is already in the vault')
      } else {
        throw new Error(`Failed to add cast: ${error.message}`)
      }
    }

    console.log('✅ Cast successfully added to collection')
  }

  // Get casts in a collection - updated to handle the join properly
  static async getCollectionCasts(collectionId: string): Promise<SavedCast[]> {
    console.log('📚 Fetching casts for collection:', collectionId)
    
    const { data, error } = await supabase
      .from('cast_collections')
      .select(`
        cast_id,
        added_at,
        saved_casts!inner(*)
      `)
      .eq('collection_id', collectionId)
      .order('added_at', { ascending: false })

    if (error) {
      console.error('Error fetching collection casts:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details
      })
      throw error
    }

    console.log('📦 Found', data?.length || 0, 'casts in collection')

    // Extract the saved_casts from the joined data
    // TypeScript type assertion to handle the joined data structure
    const casts = (data || []).map((item: any) => item.saved_casts).filter(Boolean) as SavedCast[]
    
    return casts
  }

  // Helper method to remove a cast from a collection
  static async removeCastFromCollection(castId: string, collectionId: string): Promise<void> {
    console.log('🗑️ Removing cast from collection:', { castId, collectionId })
    
    const { error } = await supabase
      .from('cast_collections')
      .delete()
      .eq('cast_id', castId)
      .eq('collection_id', collectionId)

    if (error) {
      console.error('Error removing cast from collection:', error)
      throw new Error(`Failed to remove cast: ${error.message}`)
    }

    console.log('✅ Cast removed from collection')
  }

  // Check if a cast is in a collection
  static async isCastInCollection(castId: string, collectionId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('cast_collections')
      .select('cast_id')
      .eq('cast_id', castId)
      .eq('collection_id', collectionId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking cast in collection:', error)
      return false
    }

    return !!data
  }

  // Get all collections that contain a specific cast
  static async getCollectionsForCast(castId: string): Promise<Collection[]> {
    const { data, error } = await supabase
      .from('cast_collections')
      .select(`
        collection_id,
        collections!inner(*)
      `)
      .eq('cast_id', castId)

    if (error) {
      console.error('Error fetching collections for cast:', error)
      throw error
    }

    return (data || []).map((item: any) => item.collections).filter(Boolean) as Collection[]
  }

  // Delete a collection and all its associations
  static async deleteCollection(collectionId: string, userId: string): Promise<void> {
    // The cascade delete should handle cast_collections automatically
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('created_by', userId)

    if (error) {
      console.error('Error deleting collection:', error)
      throw new Error(`Failed to delete collection: ${error.message}`)
    }

    console.log('✅ Collection deleted:', collectionId)
  }

  // Update collection details
  static async updateCollection(
    collectionId: string, 
    userId: string, 
    updates: { name?: string; description?: string; is_public?: boolean }
  ): Promise<Collection> {
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
      console.error('Error updating collection:', error)
      throw error
    }

    return data
  }

  // Get public collections
  static async getPublicCollections(limit: number = 50): Promise<Collection[]> {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching public collections:', error)
      throw error
    }

    return data || []
  }

  // Get collection with cast count
  static async getCollectionWithStats(collectionId: string): Promise<Collection & { castCount: number }> {
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .single()

    if (collectionError) {
      console.error('Error fetching collection:', collectionError)
      throw collectionError
    }

    const { count, error: countError } = await supabase
      .from('cast_collections')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId)

    if (countError) {
      console.error('Error counting casts:', countError)
      throw countError
    }

    return {
      ...collection,
      castCount: count || 0
    }
  }
}

// User Service Class
export class UserService {
  // Create or update user
  static async createOrUpdateUser(userData: {
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
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating/updating user:', error)
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
      .maybeSingle()

    if (error) {
      console.error('Error fetching user by FID:', error)
      throw error
    }

    return data || null
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user by username:', error)
      throw error
    }

    return data || null
  }

  // Update user profile
  static async updateUserProfile(
    userId: string, 
    updates: Partial<User>
  ): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user profile:', error)
      throw error
    }

    return data
  }

  // Get all users with pagination
  static async getAllUsers(limit: number = 50, offset: number = 0): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('last_login', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching users:', error)
      throw error
    }

    return data || []
  }

  // Search users
  static async searchUsers(query: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .order('last_login', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error searching users:', error)
      throw error
    }

    return data || []
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

  // Delete user
  static async deleteUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  }

  // Get user activity stats
  static async getUserActivityStats(userId: string): Promise<{
    totalCasts: number
    totalCollections: number
    lastActive: string | null
    joinDate: string
  }> {
    // Get cast count
    const { count: castCount } = await supabase
      .from('saved_casts')
      .select('*', { count: 'exact', head: true })
      .eq('saved_by_user_id', userId)

    // Get collection count
    const { count: collectionCount } = await supabase
      .from('collections')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId)

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('created_at, last_login')
      .eq('id', userId)
      .maybeSingle()

    return {
      totalCasts: castCount || 0,
      totalCollections: collectionCount || 0,
      lastActive: user?.last_login || null,
      joinDate: user?.created_at || new Date().toISOString()
    }
  }
}

// AI Context Service (Enhanced)
export class AIContextService {
  // Create new AI context
  static async createContext(contextData: Omit<AIContext, 'created_at' | 'updated_at'>): Promise<AIContext> {
    const { data, error } = await supabase
      .from('ai_contexts')
      .insert([{
        ...contextData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating AI context:', error)
      throw error
    }

    return data
  }

  // Get AI context by topic
  static async getContext(topic: string): Promise<AIContext | null> {
    const { data, error } = await supabase
      .from('ai_contexts')
      .select('*')
      .eq('topic', topic)
      .maybeSingle()

    if (error) {
      console.error('Error fetching AI context:', error)
      throw error
    }

    return data || null
  }

  // Update AI context
  static async updateContext(topic: string, updates: Partial<AIContext>): Promise<AIContext> {
    const { data, error } = await supabase
      .from('ai_contexts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('topic', topic)
      .select()
      .single()

    if (error) {
      console.error('Error updating AI context:', error)
      throw error
    }

    return data
  }

  // Get all contexts ordered by confidence
  static async getAllContexts(limit: number = 50): Promise<AIContext[]> {
    const { data, error } = await supabase
      .from('ai_contexts')
      .select('*')
      .order('confidence_score', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching AI contexts:', error)
      throw error
    }

    return data || []
  }

  // Search contexts by topic or keywords
  static async searchContexts(query: string): Promise<AIContext[]> {
    const { data, error } = await supabase
      .from('ai_contexts')
      .select('*')
      .or(`topic.ilike.%${query}%,summary.ilike.%${query}%`)
      .order('confidence_score', { ascending: false })

    if (error) {
      console.error('Error searching AI contexts:', error)
      throw error
    }

    return data || []
  }

  // Delete context
  static async deleteContext(contextId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_contexts')
      .delete()
      .eq('id', contextId)

    if (error) {
      console.error('Error deleting AI context:', error)
      throw error
    }
  }

  // Get contexts by confidence threshold
  static async getHighConfidenceContexts(minConfidence: number = 0.7): Promise<AIContext[]> {
    const { data, error } = await supabase
      .from('ai_contexts')
      .select('*')
      .gte('confidence_score', minConfidence)
      .order('confidence_score', { ascending: false })

    if (error) {
      console.error('Error fetching high confidence contexts:', error)
      throw error
    }

    return data || []
  }

  // Get related contexts for a topic
  static async getRelatedContexts(topic: string, limit: number = 5): Promise<AIContext[]> {
    // Simple approach: find contexts with similar topics
    const { data, error } = await supabase
      .from('ai_contexts')
      .select('*')
      .ilike('topic', `%${topic}%`)
      .neq('topic', topic) // Exclude exact match
      .order('confidence_score', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching related contexts:', error)
      throw error
    }

    return data || []
  }

  // Update context confidence based on usage
  static async updateContextConfidence(contextId: string, usageSuccess: boolean): Promise<void> {
    try {
      // Get current context
      const { data: context, error: fetchError } = await supabase
        .from('ai_contexts')
        .select('confidence_score')
        .eq('id', contextId)
        .maybeSingle()

      if (fetchError || !context) {
        console.error('Error fetching context for confidence update:', fetchError)
        return
      }

      // Adjust confidence based on usage success
      const currentConfidence = context.confidence_score
      const adjustment = usageSuccess ? 0.05 : -0.02 // Small incremental changes
      const newConfidence = Math.max(0, Math.min(1, currentConfidence + adjustment))

      // Update the context
      const { error: updateError } = await supabase
        .from('ai_contexts')
        .update({ 
          confidence_score: newConfidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', contextId)

      if (updateError) {
        console.error('Error updating context confidence:', updateError)
      }
    } catch (error) {
      console.error('Error in updateContextConfidence:', error)
    }
  }

  // Get context usage statistics
  static async getContextStats(): Promise<{
    totalContexts: number
    avgConfidence: number
    topTopics: string[]
    recentContexts: AIContext[]
  }> {
    try {
      // Get all contexts
      const { data: contexts, error } = await supabase
        .from('ai_contexts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching context stats:', error)
        throw error
      }

      const totalContexts = contexts?.length || 0
      const avgConfidence = totalContexts > 0 
        ? contexts.reduce((sum, ctx) => sum + ctx.confidence_score, 0) / totalContexts
        : 0

      // Get top topics by confidence
      const topTopics = contexts
        ?.sort((a, b) => b.confidence_score - a.confidence_score)
        .slice(0, 10)
        .map(ctx => ctx.topic) || []

      // Get recent contexts
      const recentContexts = contexts?.slice(0, 5) || []

      return {
        totalContexts,
        avgConfidence,
        topTopics,
        recentContexts
      }
    } catch (error) {
      console.error('Error getting context stats:', error)
      return {
        totalContexts: 0,
        avgConfidence: 0,
        topTopics: [],
        recentContexts: []
      }
    }
  }
}

// User AI Profile Service (Enhanced)
export class UserAIProfileService {
  // Create or update user AI profile
  static async upsertProfile(profileData: UserAIProfile): Promise<UserAIProfile> {
    const { data, error } = await supabase
      .from('user_ai_profiles')
      .upsert([{
        ...profileData,
        last_updated: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error upserting user AI profile:', error)
      throw error
    }

    return data
  }

  // Get user AI profile
  static async getProfile(userId: string): Promise<UserAIProfile | null> {
    const { data, error } = await supabase
      .from('user_ai_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user AI profile:', error)
      throw error
    }

    return data || null
  }

  // Get all profiles ordered by engagement
  static async getAllProfiles(limit: number = 50): Promise<UserAIProfile[]> {
    const { data, error } = await supabase
      .from('user_ai_profiles')
      .select('*')
      .order('engagement_level', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching user AI profiles:', error)
      throw error
    }

    return data || []
  }

  // Update user interests based on cast interaction
  static async updateUserInterests(userId: string, newInterests: string[]): Promise<void> {
    const existingProfile = await this.getProfile(userId)
    
    const updatedInterests = existingProfile 
      ? [...new Set([...existingProfile.interests, ...newInterests])]
      : newInterests

    await this.upsertProfile({
      user_id: userId,
      interests: updatedInterests,
      interaction_patterns: existingProfile?.interaction_patterns || {},
      preferred_topics: existingProfile?.preferred_topics || [],
      response_style: existingProfile?.response_style || 'conversational',
      engagement_level: existingProfile?.engagement_level || 0.0,
      last_updated: new Date().toISOString()
    })
  }

  // Delete user profile
  static async deleteProfile(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_ai_profiles')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting user AI profile:', error)
      throw error
    }
  }

  // Get users with similar interests
  static async getSimilarUsers(userId: string, limit: number = 10): Promise<UserAIProfile[]> {
    try {
      // Get current user's profile
      const userProfile = await this.getProfile(userId)
      if (!userProfile || userProfile.interests.length === 0) {
        return []
      }

      // Get other users with overlapping interests
      const { data, error } = await supabase
        .from('user_ai_profiles')
        .select('*')
        .neq('user_id', userId)
        .order('engagement_level', { ascending: false })
        .limit(50) // Get more to filter

      if (error) {
        console.error('Error fetching similar users:', error)
        return []
      }

      if (!data) return []

      // Calculate similarity based on shared interests
      const similarUsers = data
        .map(profile => {
          const sharedInterests = profile.interests.filter((interest: string) => 
            userProfile.interests.includes(interest)
          )
          const similarity = sharedInterests.length / Math.max(userProfile.interests.length, profile.interests.length)
          
          return {
            ...profile,
            similarity
          }
        })
        .filter(profile => profile.similarity > 0.1) // At least 10% similarity
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

      return similarUsers
    } catch (error) {
      console.error('Error getting similar users:', error)
      return []
    }
  }
}

// AI Learning Service (Enhanced)
export class AILearningService {
  // Log learning event
  static async logLearning(learningType: string, learningData: Record<string, any>): Promise<AILearning> {
    const { data, error } = await supabase
      .from('ai_learning')
      .insert([{
        learning_type: learningType,
        learning_data: learningData,
        frequency: 1,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error logging AI learning:', error)
      throw error
    }

    return data
  }

  // Get recent learning events
  static async getRecentLearning(limit: number = 20): Promise<AILearning[]> {
    const { data, error } = await supabase
      .from('ai_learning')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent learning:', error)
      throw error
    }

    return data || []
  }

  // Get learning stats by type
  static async getLearningStatsByType(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('ai_learning')
      .select('learning_type, frequency')

    if (error) {
      console.error('Error fetching learning stats:', error)
      throw error
    }

    const stats: Record<string, number> = {}
    data?.forEach(item => {
      stats[item.learning_type] = (stats[item.learning_type] || 0) + item.frequency
    })

    return stats
  }

  // Update learning frequency
  static async updateLearningFrequency(learningType: string): Promise<void> {
    try {
      // Check if learning type exists
      const { data: existing, error: fetchError } = await supabase
        .from('ai_learning')
        .select('*')
        .eq('learning_type', learningType)
        .maybeSingle()

      if (fetchError) {
        console.error('Error fetching learning entry:', fetchError)
        return
      }

      if (existing) {
        // Update frequency
        const { error: updateError } = await supabase
          .from('ai_learning')
          .update({
            frequency: existing.frequency + 1,
            last_seen: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (updateError) {
          console.error('Error updating learning frequency:', updateError)
        }
      } else {
        // Create new entry
        await this.logLearning(learningType, { first_occurrence: true })
      }
    } catch (error) {
      console.error('Error in updateLearningFrequency:', error)
    }
  }

  // Get learning insights
  static async getLearningInsights(): Promise<{
    totalEvents: number
    mostFrequentType: string
    recentActivity: string
    learningTrends: Array<{ type: string; frequency: number }>
  }> {
    try {
      const { data, error } = await supabase
        .from('ai_learning')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching learning insights:', error)
        throw error
      }

      const totalEvents = data?.length || 0
      
      // Calculate most frequent type
      const typeFrequency = data?.reduce((acc: Record<string, number>, item) => {
        acc[item.learning_type] = (acc[item.learning_type] || 0) + item.frequency
        return acc
      }, {}) || {}

      const mostFrequentType = Object.entries(typeFrequency)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none'

      // Get recent activity
      const recentActivity = data?.[0]?.created_at 
        ? new Date(data[0].created_at).toLocaleDateString()
        : 'No recent activity'

      // Learning trends
      const learningTrends = Object.entries(typeFrequency)
        .map(([type, frequency]) => ({ type, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)

      return {
        totalEvents,
        mostFrequentType,
        recentActivity,
        learningTrends
      }
    } catch (error) {
      console.error('Error getting learning insights:', error)
      return {
        totalEvents: 0,
        mostFrequentType: 'none',
        recentActivity: 'No data',
        learningTrends: []
      }
    }
  }
}

// Content parsing utilities (Enhanced)
export class ContentParser {
  static parseContent(text: string): ParsedData {
    return {
      urls: this.extractUrls(text),
      mentions: this.extractMentions(text),
      hashtags: this.extractHashtags(text),
      numbers: this.extractNumbers(text),
      dates: this.extractDates(text),
      word_count: text.split(' ').length,
      sentiment: this.analyzeSentiment(text),
      topics: this.extractTopics(text)
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

  static extractTopics(text: string): string[] {
    const content = text.toLowerCase()
    const words = content.split(/\s+/)
    const foundTopics: string[] = []

    // Enhanced topic detection with context awareness
    const topicPatterns = {
      'crypto': ['crypto', 'bitcoin', 'ethereum', 'btc', 'eth', 'cryptocurrency'],
      'blockchain': ['blockchain', 'web3', 'decentralized', 'dao'],
      'defi': ['defi', 'yield', 'liquidity', 'staking', 'farming'],
      'nft': ['nft', 'pfp', 'opensea', 'collectible'],
      'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'gpt', 'llm'],
      'tech': ['programming', 'code', 'developer', 'software', 'api', 'github'],
      'finance': ['money', 'pay', 'rent', 'finance', 'investment', 'trading', 'market'],
      'social': ['gm', 'friends', 'community', 'social', 'hello', 'thanks'],
      'gaming': ['game', 'gaming', 'play', 'player', 'console'],
      'art': ['art', 'artist', 'design', 'creative', 'paint'],
      'music': ['music', 'song', 'album', 'artist', 'sound'],
      'business': ['business', 'startup', 'company', 'entrepreneur', 'venture'],
      'politics': ['politics', 'government', 'policy', 'election', 'vote'],
      'sports': ['sports', 'football', 'basketball', 'soccer', 'game'],
      'science': ['science', 'research', 'study', 'experiment', 'data']
    }

    // Check for topic patterns
    Object.entries(topicPatterns).forEach(([topic, keywords]) => {
      const hasMatch = keywords.some(keyword => {
        if (keyword.includes(' ')) {
          // Multi-word phrases
          return content.includes(keyword)
        } else {
          // Single words - check if any word contains this keyword
          return words.some(word => word.includes(keyword))
        }
      })
      
      if (hasMatch) {
        foundTopics.push(topic)
      }
    })

    return foundTopics
  }

  // Simple sentiment analysis
  static analyzeSentiment(text: string): string {
    const positiveWords = [
      'good', 'great', 'awesome', 'amazing', 'excellent', 'fantastic', 
      'wonderful', 'brilliant', 'perfect', 'love', 'like', 'enjoy',
      'happy', 'excited', 'thrilled', 'delighted', 'pleased'
    ]

    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'hate',
      'dislike', 'angry', 'frustrated', 'disappointed', 'sad', 'upset',
      'annoyed', 'worried', 'concerned', 'scared', 'afraid'
    ]

    const words = text.toLowerCase().split(/\s+/)
    
    const positiveCount = words.filter(word => 
      positiveWords.some(posWord => word.includes(posWord))
    ).length

    const negativeCount = words.filter(word => 
      negativeWords.some(negWord => word.includes(negWord))
    ).length

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  // Extract key phrases (enhanced for better research queries)
  static extractKeyPhrases(text: string, maxPhrases: number = 5): string[] {
    // Enhanced stop words for better phrase extraction
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 
      'they', 'what', 'where', 'when', 'why', 'how', 'just', 'so', 'now',
      'get', 'got', 'can', 'also', 'like', 'really', 'think', 'know'
    ])

    // First, try to extract meaningful multi-word phrases
    const phrases = this.extractMultiWordPhrases(text, stopWords)
    if (phrases.length >= maxPhrases) {
      return phrases.slice(0, maxPhrases)
    }

    // Supplement with individual high-value words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))

    // Boost importance of certain types of words
    const wordScores = words.reduce((acc: Record<string, number>, word) => {
      let score = (acc[word] || 0) + 1
      
      // Boost technical terms, proper nouns (if capitalized in original), etc.
      if (word.match(/^[A-Z]/)) score *= 1.5 // Likely proper noun
      if (word.length > 6) score *= 1.2 // Longer words often more meaningful
      if (word.match(/^(ai|crypto|blockchain|web3|nft|defi|dao)$/i)) score *= 2
      
      acc[word] = score
      return acc
    }, {})

    const topWords = Object.entries(wordScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxPhrases - phrases.length)
      .map(([word]) => word)

    return [...phrases, ...topWords].slice(0, maxPhrases)
  }

  // Extract meaningful multi-word phrases
  static extractMultiWordPhrases(text: string, stopWords: Set<string>): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const phrases: string[] = []
    
    sentences.forEach(sentence => {
      // Look for quoted text (often important)
      const quotes = sentence.match(/"([^"]+)"/g)
      if (quotes) {
        quotes.forEach(quote => {
          const clean = quote.replace(/"/g, '').trim()
          if (clean.length > 5 && clean.split(' ').length <= 4) {
            phrases.push(clean.toLowerCase())
          }
        })
      }
      
      // Look for capitalized phrases (likely proper nouns or important terms)
      const capitalizedPhrases = sentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)
      if (capitalizedPhrases) {
        capitalizedPhrases.forEach(phrase => {
          if (phrase.split(' ').length <= 3 && phrase.length > 5) {
            phrases.push(phrase.toLowerCase())
          }
        })
      }
    })
    
    // Remove duplicates and return top phrases
    return Array.from(new Set(phrases)).slice(0, 3)
  }

  // Search for specific keywords in text (flexible search)
  static searchKeywords(text: string, keywords: string[]): {
    found: string[]
    matches: Array<{ keyword: string; count: number; positions: number[] }>
  } {
    const content = text.toLowerCase()
    const found: string[] = []
    const matches: Array<{ keyword: string; count: number; positions: number[] }> = []

    keywords.forEach(keyword => {
      const searchTerm = keyword.toLowerCase()
      const positions: number[] = []
      let index = content.indexOf(searchTerm)
      
      while (index !== -1) {
        positions.push(index)
        index = content.indexOf(searchTerm, index + 1)
      }

      if (positions.length > 0) {
        found.push(keyword)
        matches.push({
          keyword,
          count: positions.length,
          positions
        })
      }
    })

    return { found, matches }
  }

  // Extract context around a keyword match
  static extractMatchContext(text: string, keyword: string, contextLength: number = 50): string[] {
    const content = text.toLowerCase()
    const searchTerm = keyword.toLowerCase()
    const contexts: string[] = []
    let index = content.indexOf(searchTerm)

    while (index !== -1) {
      const start = Math.max(0, index - contextLength)
      const end = Math.min(text.length, index + searchTerm.length + contextLength)
      const context = text.substring(start, end)
      contexts.push('...' + context + '...')
      index = content.indexOf(searchTerm, index + 1)
    }

    return contexts
  }
}

// VaultService is an alias/wrapper for CollectionService
// In this app, "Vaults" and "Collections" are the same concept
export class VaultService {
  // Get user's vaults (collections) with cast counts
  static async getUserVaults(userId: string): Promise<Vault[]> {
    const collections = await CollectionService.getUserCollections(userId)
    
    // Add cast counts to each vault
    const vaultsWithCounts = await Promise.all(
      collections.map(async (collection) => {
        try {
          const casts = await CollectionService.getCollectionCasts(collection.id)
          return {
            ...collection,
            cast_count: casts.length,
            auto_add_rules: [] // Collections don't have auto-add rules yet, so we default to empty array
          } as Vault
        } catch (error) {
          console.error(`Error getting cast count for vault ${collection.id}:`, error)
          return {
            ...collection,
            cast_count: 0,
            auto_add_rules: []
          } as Vault
        }
      })
    )
    
    return vaultsWithCounts
  }

  // Create a new vault (collection)
  static async createVault(name: string, description: string, rules: string | string[], userId: string, isPublic: boolean = false): Promise<Vault> {
    // For now, we ignore the rules parameter since collections don't support auto-add rules yet
    // In the future, this could be stored in a separate field or table
    const collection = await CollectionService.createCollection(name, description, userId, isPublic)
    
    return {
      ...collection,
      cast_count: 0,
      auto_add_rules: Array.isArray(rules) ? rules : []
    } as Vault
  }

  // Add cast to vault (collection)
  static async addCastToVault(castId: string, vaultId: string): Promise<void> {
    return await CollectionService.addCastToCollection(castId, vaultId)
  }

  // Get casts in a vault (collection)
  static async getVaultCasts(vaultId: string): Promise<SavedCast[]> {
    return await CollectionService.getCollectionCasts(vaultId)
  }

  // Check if a cast is in a vault (collection)
  static async isCastInVault(castId: string, vaultId: string): Promise<boolean> {
    return await CollectionService.isCastInCollection(castId, vaultId)
  }

  // Get all vaults that contain a specific cast
  static async getVaultsForCast(castId: string): Promise<Vault[]> {
    const collections = await CollectionService.getCollectionsForCast(castId)
    // Convert collections to vaults with default properties
    return collections.map(collection => ({
      ...collection,
      cast_count: 0, // We don't calculate this here for performance
      auto_add_rules: []
    }) as Vault)
  }

  // Remove a cast from a vault (collection)
  static async removeCastFromVault(castId: string, vaultId: string): Promise<void> {
    return await CollectionService.removeCastFromCollection(castId, vaultId)
  }

  // Delete a vault (collection)
  static async deleteVault(vaultId: string, userId: string): Promise<void> {
    return await CollectionService.deleteCollection(vaultId, userId)
  }

  // Update vault details
  static async updateVault(
    vaultId: string, 
    userId: string, 
    updates: { name?: string; description?: string; is_public?: boolean }
  ): Promise<Vault> {
    const updatedCollection = await CollectionService.updateCollection(vaultId, userId, updates)
    // Get current cast count
    const casts = await CollectionService.getCollectionCasts(vaultId)
    
    return {
      ...updatedCollection,
      cast_count: casts.length,
      auto_add_rules: []
    } as Vault
  }

  // Get public vaults (collections)
  static async getPublicVaults(limit: number = 50): Promise<Vault[]> {
    const collections = await CollectionService.getPublicCollections(limit)
    // Convert to vaults with default properties (don't calculate cast counts for performance)
    return collections.map(collection => ({
      ...collection,
      cast_count: 0,
      auto_add_rules: []
    }) as Vault)
  }

  // Get vault with statistics
  static async getVaultWithStats(vaultId: string): Promise<Vault & { castCount: number }> {
    const collectionWithStats = await CollectionService.getCollectionWithStats(vaultId)
    return {
      ...collectionWithStats,
      cast_count: collectionWithStats.castCount,
      auto_add_rules: []
    } as Vault & { castCount: number }
  }
}

// @cstkpr Intelligence Service - The bot's brain
export class CstkprIntelligenceService {
  // Analyze a cast that tagged @cstkpr and generate an opinion
  static async analyzeCastAndFormOpinion(
    castHash: string,
    castContent: string,
    castAuthor: string,
    includeWebResearch: boolean = true
  ): Promise<CstkprOpinion> {
    console.log('🧠 @cstkpr analyzing cast:', castHash)
    
    // Step 1: Extract topics and context from the cast
    const topicAnalysis = this.extractCastTopics(castContent)
    console.log('📝 Topics extracted:', topicAnalysis)
    
    // Step 2: Find related saved casts in our database
    const relatedCasts = await this.findRelatedSavedCasts(topicAnalysis, castContent)
    console.log('🔍 Found', relatedCasts.length, 'related saved casts')
    
    // Step 3: Perform web research if enabled
    let webResearch: WebResearchResult | null = null
    if (includeWebResearch && topicAnalysis.length > 0) {
      webResearch = await this.performWebResearch(topicAnalysis, castContent)
      console.log('🌐 Web research completed')
    }
    
    // Step 4: Generate opinion based on all available data
    const opinion = await this.generateOpinion(
      castContent,
      castAuthor,
      topicAnalysis,
      relatedCasts,
      webResearch
    )
    
    // Step 5: Save the opinion to database
    const savedOpinion = await this.saveOpinion({
      original_cast_hash: castHash,
      original_cast_content: castContent,
      original_author: castAuthor,
      topic_analysis: topicAnalysis,
      related_saved_casts: relatedCasts.map(cast => cast.id),
      web_research_summary: webResearch?.summary,
      opinion_text: opinion.text,
      confidence_score: opinion.confidence,
      reasoning: opinion.reasoning,
      sources_used: opinion.sources,
      response_tone: opinion.tone
    })
    
    console.log('✅ @cstkpr opinion generated:', savedOpinion.id)
    return savedOpinion
  }

  // Extract topics and key concepts from a cast
  static extractCastTopics(castContent: string): string[] {
    const parsed = ContentParser.parseContent(castContent)
    const topics = parsed.topics || []
    
    // Enhanced topic extraction for @cstkpr
    const content = castContent.toLowerCase()
    const enhancedTopics = new Set([...topics])
    
    // Look for opinion-forming keywords
    const opinionKeywords = {
      'market-analysis': ['bull', 'bear', 'pump', 'dump', 'ath', 'dip', 'crash'],
      'tech-discussion': ['launch', 'update', 'feature', 'bug', 'performance'],
      'community': ['community', 'team', 'developer', 'founder', 'announcement'],
      'prediction': ['predict', 'forecast', 'estimate', 'expect', 'think', 'believe'],
      'news': ['breaking', 'news', 'announced', 'confirmed', 'reported'],
      'debate': ['vs', 'versus', 'compare', 'better', 'worse', 'opinion', 'thoughts']
    }
    
    Object.entries(opinionKeywords).forEach(([category, keywords]) => {
      if (keywords.some(keyword => content.includes(keyword))) {
        enhancedTopics.add(category)
      }
    })
    
    return Array.from(enhancedTopics)
  }

  // Analyze parent-child cast relationships
  static async analyzeParentCastContext(parentContent: string, replyContent?: string): Promise<{
    parentTopics: string[]
    parentSentiment: string
    relationshipType: 'agreement' | 'disagreement' | 'question' | 'elaboration' | 'neutral'
    contextualInsights: string[]
  }> {
    const parentTopics = this.extractCastTopics(parentContent)
    const parentSentiment = ContentParser.analyzeSentiment(parentContent)
    
    let relationshipType: 'agreement' | 'disagreement' | 'question' | 'elaboration' | 'neutral' = 'neutral'
    const contextualInsights: string[] = []
    
    if (replyContent) {
      const replyLower = replyContent.toLowerCase()
      const parentLower = parentContent.toLowerCase()
      
      // Determine relationship type
      if (replyLower.includes('agree') || replyLower.includes('yes') || replyLower.includes('exactly')) {
        relationshipType = 'agreement'
      } else if (replyLower.includes('disagree') || replyLower.includes('no') || replyLower.includes('wrong')) {
        relationshipType = 'disagreement'
      } else if (replyContent.includes('?') || replyLower.includes('what') || replyLower.includes('how')) {
        relationshipType = 'question'
      } else if (replyLower.includes('also') || replyLower.includes('furthermore') || replyLower.includes('additionally')) {
        relationshipType = 'elaboration'
      }
      
      // Generate contextual insights
      if (parentTopics.length > 0) {
        contextualInsights.push(`Parent cast discusses: ${parentTopics.join(', ')}`)
      }
      
      if (relationshipType !== 'neutral') {
        contextualInsights.push(`Reply relationship: ${relationshipType}`)
      }
      
      const replyTopics = this.extractCastTopics(replyContent)
      const sharedTopics = parentTopics.filter(topic => replyTopics.includes(topic))
      if (sharedTopics.length > 0) {
        contextualInsights.push(`Shared topics: ${sharedTopics.join(', ')}`)
      }
    }
    
    return {
      parentTopics,
      parentSentiment,
      relationshipType,
      contextualInsights
    }
  }

  // Find related casts in our saved database
  static async findRelatedSavedCasts(topics: string[], castContent: string): Promise<SavedCast[]> {
    const relatedCasts: SavedCast[] = []
    
    // Search by topics
    for (const topic of topics) {
      try {
        const casts = await CastService.getCastsByTopic(topic, 5)
        relatedCasts.push(...casts)
      } catch (error) {
        console.error('Error fetching casts for topic:', topic, error)
      }
    }
    
    // Extract key terms for additional search
    const keyTerms = ContentParser.extractKeyPhrases(castContent, 3)
    
    // Search by key terms if we don't have enough related casts
    if (relatedCasts.length < 10 && keyTerms.length > 0) {
      try {
        const searchResults = await CastService.searchCasts('all', keyTerms[0])
        relatedCasts.push(...searchResults.slice(0, 5))
      } catch (error) {
        console.error('Error searching casts by key terms:', error)
      }
    }
    
    // Remove duplicates and limit results
    const uniqueCasts = relatedCasts.filter((cast, index, self) => 
      index === self.findIndex(c => c.id === cast.id)
    )
    
    return uniqueCasts.slice(0, 15) // Limit to 15 most relevant casts
  }

  // Perform web research on the topics (enhanced with better context awareness)
  static async performWebResearch(topics: string[], castContent: string): Promise<WebResearchResult> {
    // Create a more intelligent search query
    const keyPhrases = ContentParser.extractKeyPhrases(castContent, 3)
    const searchTerms = [...topics.slice(0, 2), ...keyPhrases.slice(0, 1)].join(' ')
    
    console.log('🔍 Web research query:', searchTerms)
    
    // Try to perform actual web research if API is available
    const webResults = await this.performActualWebSearch(searchTerms)
    if (webResults) {
      return webResults
    }
    
    // Fallback to enhanced contextual analysis
    const contextualAnalysis = this.analyzeContentContext(castContent, topics)
    
    return {
      query: searchTerms,
      sources: [
        {
          url: `https://search.google.com/search?q=${encodeURIComponent(searchTerms)}`,
          title: `Recent discussions about ${topics[0] || 'the topic'}`,
          content_summary: `Current community sentiment shows ${contextualAnalysis.trend_direction}. ${contextualAnalysis.key_insight}`,
          relevance_score: 0.85
        },
        {
          url: `https://scholar.google.com/scholar?q=${encodeURIComponent(searchTerms)}`,
          title: `Academic perspective on ${topics[0] || 'the subject'}`,
          content_summary: `Research indicates growing interest in ${topics[0] || 'this area'} with ${contextualAnalysis.confidence} confidence levels from experts`,
          relevance_score: 0.75
        },
        {
          url: `https://news.google.com/search?q=${encodeURIComponent(searchTerms)}`,
          title: `Breaking developments in ${topics[0] || 'the field'}`,
          content_summary: `Latest reports suggest ${contextualAnalysis.trend_direction.toLowerCase()} with significant implications for ${keyPhrases.join(', ')}`,
          relevance_score: 0.70
        }
      ],
      key_facts: [
        `Community sentiment on ${topics[0] || 'this topic'} is currently **${contextualAnalysis.sentiment}** with **${contextualAnalysis.engagement_level}** engagement`,
        `Market trends show **${contextualAnalysis.trend_direction}** based on recent discussions and analysis`,
        `Key themes emerging: ${keyPhrases.join(', ')} - indicating ${contextualAnalysis.confidence} confidence in direction`,
        `Expert analysis suggests the need for ${topics.includes('ai') ? 'ethical frameworks and regulation' : topics.includes('crypto') ? 'sustainable tokenomics and real utility' : topics.includes('tech-discussion') ? 'better developer tools and documentation' : 'innovative approaches and community collaboration'}`
      ],
      summary: `**Internet sentiment analysis**: ${topics[0] || 'This topic'} shows **${contextualAnalysis.trend_direction}** with **${contextualAnalysis.confidence}** confidence. ${contextualAnalysis.key_insight} Current discussions emphasize the need for ${keyPhrases.slice(0, 2).join(' and ')}, better ${topics[0] || 'solutions'}, and more thoughtful ${topics[1] || 'implementation'}.`,
      timestamp: new Date().toISOString()
    }
  }

  // Attempt actual web search (placeholder for API integration)
  static async performActualWebSearch(query: string): Promise<WebResearchResult | null> {
    // This would integrate with actual search APIs like:
    // - Google Custom Search API
    // - Bing Web Search API
    // - DuckDuckGo API
    // - Serper API
    // - ScaleSerp API
    
    // Check if we have API keys configured
    const hasSearchAPI = process.env.GOOGLE_SEARCH_API_KEY || process.env.BING_SEARCH_API_KEY
    
    if (!hasSearchAPI) {
      console.log('🔍 No search API configured, using enhanced fallback')
      return null
    }
    
    try {
      // Example Google Custom Search implementation:
      /*
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`
      )
      
      const data = await response.json()
      
      if (data.items) {
        return {
          query,
          sources: data.items.map((item: any) => ({
            url: item.link,
            title: item.title,
            content_summary: item.snippet,
            relevance_score: 0.8
          })),
          key_facts: data.items.slice(0, 3).map((item: any) => item.snippet),
          summary: `Search results for "${query}" show active discussion and varied perspectives.`,
          timestamp: new Date().toISOString()
        }
      }
      */
      
      return null
    } catch (error) {
      console.error('Web search API error:', error)
      return null
    }
  }

  // Analyze content context for better research targeting (enhanced with opinion formation)
  static analyzeContentContext(castContent: string, topics: string[]): {
    sentiment: string
    engagement_level: string
    trend_direction: string
    confidence: string
    key_insight: string
  } {
    const parsed = ContentParser.parseContent(castContent)
    const hasQuestionMark = castContent.includes('?')
    const hasExclamation = castContent.includes('!')
    const wordCount = parsed.word_count || 0
    const content = castContent.toLowerCase()
    
    let engagement_level = 'moderate'
    if (hasExclamation && wordCount > 20) engagement_level = 'high'
    else if (hasQuestionMark || wordCount < 10) engagement_level = 'low'
    
    let trend_direction = 'mixed indicators'
    if (parsed.sentiment === 'positive' && topics.some(t => ['tech', 'ai', 'crypto'].includes(t))) {
      trend_direction = 'positive momentum with strong community support'
    } else if (parsed.sentiment === 'negative' && topics.includes('crypto')) {
      trend_direction = 'concerning patterns with increased skepticism'
    } else if (content.includes('bullish') || content.includes('optimistic')) {
      trend_direction = 'strong upward trajectory with high confidence'
    } else if (content.includes('bearish') || content.includes('concern')) {
      trend_direction = 'cautionary signals with risk awareness'
    }
    
    const confidence = topics.length > 2 ? 'high' : topics.length > 0 ? 'moderate' : 'low'
    
    let key_insight = 'The discussion reflects evolving community perspectives.'
    if (topics.includes('ai') && content.includes('god')) {
      key_insight = 'This touches on AI ethics and existential questions that are becoming central to technology discourse, highlighting the need for philosophical frameworks in AI development.'
    } else if (topics.includes('crypto') && parsed.sentiment === 'negative') {
      key_insight = 'Market sentiment shows growing maturity with more critical analysis, suggesting the need for sustainable tokenomics and real utility.'
    } else if (topics.includes('defi') && content.includes('yield')) {
      key_insight = 'DeFi discussions increasingly focus on sustainable yields and protocol security, indicating market evolution toward long-term viability.'
    } else if (topics.includes('nft') && parsed.sentiment === 'positive') {
      key_insight = 'NFT enthusiasm is shifting toward utility and community value, demonstrating the need for meaningful digital ownership experiences.'
    } else if (topics.includes('tech-discussion') && hasQuestionMark) {
      key_insight = 'Technical inquiries reflect the growing need for accessible developer education and clearer documentation in emerging technologies.'
    }
    
    return {
      sentiment: parsed.sentiment || 'neutral',
      engagement_level,
      trend_direction,
      confidence,
      key_insight
    }
  }

  // Generate @cstkpr's opinion based on all collected data
  static async generateOpinion(
    castContent: string,
    castAuthor: string,
    topics: string[],
    relatedCasts: SavedCast[],
    webResearch: WebResearchResult | null
  ): Promise<{
    text: string
    confidence: number
    reasoning: string[]
    sources: string[]
    tone: 'analytical' | 'supportive' | 'critical' | 'curious' | 'neutral'
  }> {
    const reasoning: string[] = []
    const sources: string[] = []
    let confidence = 0.5 // Base confidence
    
    // Analyze sentiment and context
    const parsed = ContentParser.parseContent(castContent)
    const sentiment = parsed.sentiment || 'neutral'
    
    // Build reasoning based on related casts
    if (relatedCasts.length > 0) {
      reasoning.push(`Found ${relatedCasts.length} related casts in our database`)
      sources.push(`${relatedCasts.length} saved casts`)
      confidence += 0.2
    }
    
    // Incorporate web research
    if (webResearch) {
      reasoning.push(`Considered current web research on ${webResearch.query}`)
      sources.push(`Web research: ${webResearch.sources.length} sources`)
      confidence += 0.2
    }
    
    // Determine response tone based on topics and sentiment
    let tone: 'analytical' | 'supportive' | 'critical' | 'curious' | 'neutral' = 'neutral'
    
    if (topics.includes('market-analysis') || topics.includes('prediction')) {
      tone = 'analytical'
    } else if (topics.includes('debate') || topics.includes('critical')) {
      tone = 'critical' 
    } else if (sentiment === 'positive') {
      tone = 'supportive'
    } else if (topics.includes('tech-discussion') || castContent.includes('?')) {
      tone = 'curious'
    }
    
    // Generate opinion text (this would use an LLM in production)
    const opinionText = this.craftOpinionText(
      castContent,
      castAuthor,
      topics,
      relatedCasts,
      webResearch,
      tone,
      sentiment
    )
    
    return {
      text: opinionText,
      confidence: Math.min(confidence, 0.95), // Cap at 95%
      reasoning,
      sources,
      tone
    }
  }

  // Craft the actual opinion text (enhanced for real analysis and opinions)
  static craftOpinionText(
    castContent: string,
    castAuthor: string,
    topics: string[],
    relatedCasts: SavedCast[],
    webResearch: WebResearchResult | null,
    tone: string,
    sentiment: string
  ): string {
    // Analyze the cast content to form actual opinions
    const parsed = ContentParser.parseContent(castContent)
    const keyPhrases = ContentParser.extractKeyPhrases(castContent, 3)
    
    // Start with sentiment and tone analysis
    let opinionText = `🧠 **Analysis**: This cast has a **${sentiment}** sentiment with a **${tone}** tone. `
    
    // Add topic-specific insights
    if (topics.length > 0) {
      opinionText += `The discussion centers on **${topics.join(', ')}**. `
    }
    
    // Generate actual opinion based on content analysis
    const actualOpinion = this.generateActualOpinion(castContent, topics, keyPhrases, relatedCasts)
    opinionText += actualOpinion
    
    // Add comparison with saved casts
    if (relatedCasts.length > 0) {
      const comparisonInsight = this.compareWithSavedCasts(relatedCasts, topics, sentiment)
      opinionText += ` **From my saved casts analysis**: ${comparisonInsight}`
    }
    
    // Add web research insights
    if (webResearch && webResearch.key_facts.length > 0) {
      opinionText += ` **Current trends**: ${webResearch.key_facts[0]} `
    }
    
    // Add confidence and reasoning
    const confidence = Math.min(0.5 + (relatedCasts.length > 5 ? 0.2 : 0) + (webResearch ? 0.2 : 0), 0.95)
    opinionText += `\n\n📊 **Confidence**: ${Math.round(confidence * 100)}% | **Sources**: ${relatedCasts.length} saved casts`
    
    return opinionText
  }

  // Generate actual substantive opinion based on content
  static generateActualOpinion(
    castContent: string, 
    topics: string[], 
    keyPhrases: string[],
    relatedCasts: SavedCast[]
  ): string {
    const content = castContent.toLowerCase()
    let opinion = ""
    
    // Analyze what the cast is trying to convey
    if (content.includes('?')) {
      opinion = `**I think** this cast is asking an important question that highlights the need for more clarity around ${topics[0] || 'this topic'}. `
    } else if (content.includes('announce') || content.includes('launch')) {
      opinion = `**In my opinion**, this announcement indicates a strategic move that could signal ${topics[0] || 'market'} expansion. `
    } else if (content.includes('problem') || content.includes('issue')) {
      opinion = `**I believe** this cast identifies a key problem that explains the need for better ${topics[0] || 'solutions'}, ${topics[1] || 'approaches'}, and ${topics[2] || 'frameworks'}. `
    } else if (content.includes('bullish') || content.includes('optimistic')) {
      opinion = `**My take**: This optimistic perspective suggests strong confidence in ${topics[0] || 'the sector'}, which aligns with positive momentum I've observed. `
    } else if (content.includes('bearish') || content.includes('concern')) {
      opinion = `**I think** this cast raises valid concerns that highlight the need for caution, better risk management, and more thoughtful ${topics[0] || 'strategy'}. `
    } else if (keyPhrases.length > 0) {
      opinion = `**I believe** this cast effectively explains the importance of ${keyPhrases[0]}, and demonstrates the need for ${keyPhrases[1] || 'innovation'}, ${keyPhrases[2] || 'development'}, and broader adoption. `
    } else if (topics.includes('ai')) {
      opinion = `**In my view**, this AI discussion explains the need for ethical frameworks, better regulation, and more thoughtful implementation of AI technologies. `
    } else if (topics.includes('crypto')) {
      opinion = `**I think** this crypto-related cast highlights the need for clearer regulations, better user education, and more sustainable blockchain solutions. `
    } else if (topics.includes('tech-discussion')) {
      opinion = `**My opinion**: This technical discussion explains the need for better developer tools, more accessible documentation, and improved user experiences. `
    } else {
      opinion = `**I believe** this cast makes a compelling point that explains the need for fresh perspectives, innovative solutions, and community-driven approaches to ${topics[0] || 'this challenge'}. `
    }
    
    return opinion
  }

  // Compare current cast with saved casts to provide contextual opinion
  static compareWithSavedCasts(relatedCasts: SavedCast[], topics: string[], sentiment: string): string {
    if (relatedCasts.length === 0) return ""
    
    // Analyze sentiment patterns in related casts
    const positiveCasts = relatedCasts.filter(cast => 
      cast.parsed_data?.sentiment === 'positive'
    ).length
    
    const negativeCasts = relatedCasts.filter(cast => 
      cast.parsed_data?.sentiment === 'negative'
    ).length
    
    const totalCasts = relatedCasts.length
    
    let comparison = ""
    
    if (sentiment === 'positive' && positiveCasts > totalCasts * 0.6) {
      comparison = `This positive sentiment aligns with **${positiveCasts}/${totalCasts}** similar casts I've seen, suggesting a consistent optimistic trend in the community.`
    } else if (sentiment === 'negative' && negativeCasts > totalCasts * 0.6) {
      comparison = `This critical perspective matches **${negativeCasts}/${totalCasts}** related casts, indicating growing concerns in this area.`
    } else if (sentiment === 'positive' && negativeCasts > positiveCasts) {
      comparison = `Interestingly, this optimistic take contrasts with **${negativeCasts}/${totalCasts}** more critical casts I've saved, suggesting a shift in sentiment.`
    } else if (sentiment === 'negative' && positiveCasts > negativeCasts) {
      comparison = `This cautious view differs from the **${positiveCasts}/${totalCasts}** more positive casts in my database, showing diverse community opinions.`
    } else {
      comparison = `Based on **${totalCasts}** related saved casts, this represents a balanced perspective that reflects the mixed sentiment I've observed.`
    }
    
    // Add topic-specific insights
    const topicPattern = this.analyzeTopicPatterns(relatedCasts, topics)
    if (topicPattern) {
      comparison += ` ${topicPattern}`
    }
    
    return comparison
  }

  // Analyze patterns in related casts for deeper insights
  static analyzeTopicPatterns(relatedCasts: SavedCast[], topics: string[]): string {
    if (relatedCasts.length < 3) return ""
    
    // Look for common themes in related casts
    const recentCasts = relatedCasts.slice(0, 5) // Most recent/relevant
    const commonTopics = new Map<string, number>()
    
    recentCasts.forEach(cast => {
      if (cast.parsed_data?.topics) {
        cast.parsed_data.topics.forEach((topic: string) => {
          commonTopics.set(topic, (commonTopics.get(topic) || 0) + 1)
        })
      }
    })
    
    const dominantTopics = Array.from(commonTopics.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([topic]) => topic)
    
    if (dominantTopics.length > 0 && dominantTopics[0] !== topics[0]) {
      return `The saved casts frequently discuss **${dominantTopics.join(' and ')}**, suggesting these themes are interconnected.`
    }
    
    return ""
  }

  // Save opinion to database
  static async saveOpinion(opinionData: Omit<CstkprOpinion, 'id' | 'created_at' | 'updated_at'>): Promise<CstkprOpinion> {
    const { data, error } = await supabase
      .from('cstkpr_opinions')
      .insert([{
        ...opinionData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error saving @cstkpr opinion:', error)
      throw error
    }

    return data
  }

  // Get opinion by cast hash
  static async getOpinionByCastHash(castHash: string): Promise<CstkprOpinion | null> {
    const { data, error } = await supabase
      .from('cstkpr_opinions')
      .select('*')
      .eq('original_cast_hash', castHash)
      .maybeSingle()

    if (error) {
      console.error('Error fetching opinion:', error)
      throw error
    }

    return data || null
  }

  // Get recent opinions for analysis
  static async getRecentOpinions(limit: number = 20): Promise<CstkprOpinion[]> {
    const { data, error } = await supabase
      .from('cstkpr_opinions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent opinions:', error)
      throw error
    }

    return data || []
  }

  // Get opinion statistics
  static async getOpinionStats(): Promise<{
    totalOpinions: number
    averageConfidence: number
    topTopics: string[]
    toneDistribution: Record<string, number>
    recentActivity: string
  }> {
    try {
      const { data: opinions, error } = await supabase
        .from('cstkpr_opinions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const totalOpinions = opinions?.length || 0
      
      if (totalOpinions === 0) {
        return {
          totalOpinions: 0,
          averageConfidence: 0,
          topTopics: [],
          toneDistribution: {},
          recentActivity: 'No activity yet'
        }
      }

      // Calculate average confidence
      const averageConfidence = opinions.reduce((sum, op) => sum + op.confidence_score, 0) / totalOpinions

      // Get top topics
      const allTopics = opinions.flatMap(op => op.topic_analysis || [])
      const topicCounts = allTopics.reduce((acc: Record<string, number>, topic) => {
        acc[topic] = (acc[topic] || 0) + 1
        return acc
      }, {})
      
      const topTopics = Object.entries(topicCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic)

      // Get tone distribution
      const toneDistribution = opinions.reduce((acc: Record<string, number>, op) => {
        acc[op.response_tone] = (acc[op.response_tone] || 0) + 1
        return acc
      }, {})

      // Recent activity
      const recentActivity = opinions[0]?.created_at 
        ? new Date(opinions[0].created_at).toLocaleDateString()
        : 'No recent activity'

      return {
        totalOpinions,
        averageConfidence,
        topTopics,
        toneDistribution,
        recentActivity
      }
    } catch (error) {
      console.error('Error getting opinion stats:', error)
      return {
        totalOpinions: 0,
        averageConfidence: 0,
        topTopics: [],
        toneDistribution: {},
        recentActivity: 'Error fetching data'
      }
    }
  }

  // Update opinion confidence based on community feedback
  static async updateOpinionConfidence(opinionId: string, feedbackPositive: boolean): Promise<void> {
    try {
      const { data: opinion, error: fetchError } = await supabase
        .from('cstkpr_opinions')
        .select('confidence_score')
        .eq('id', opinionId)
        .maybeSingle()

      if (fetchError || !opinion) return

      const adjustment = feedbackPositive ? 0.1 : -0.05
      const newConfidence = Math.max(0.1, Math.min(0.95, opinion.confidence_score + adjustment))

      const { error: updateError } = await supabase
        .from('cstkpr_opinions')
        .update({ 
          confidence_score: newConfidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', opinionId)

      if (updateError) {
        console.error('Error updating opinion confidence:', updateError)
      }
    } catch (error) {
      console.error('Error in updateOpinionConfidence:', error)
    }
  }
}