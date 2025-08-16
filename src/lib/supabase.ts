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
}

// Helper functions for collections - FULLY UPDATED
export class CollectionService {
  // Create a new collection
  static async createCollection(name: string, description: string, userId: string, isPublic: boolean = false): Promise<Collection> {
    console.log('📁 Creating collection:', { name, userId, isPublic })
    
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
    const topicKeywords = [
      'crypto', 'nft', 'defi', 'web3', 'blockchain', 'ethereum', 'bitcoin',
      'art', 'music', 'gaming', 'sports', 'politics', 'tech', 'ai', 'ml',
      'startup', 'venture', 'investment', 'trading', 'market', 'finance',
      'social', 'community', 'meme', 'culture', 'philosophy', 'science',
      'development', 'programming', 'design', 'marketing', 'business'
    ]

    const words = text.toLowerCase().split(/\s+/)
    const foundTopics: string[] = []

    topicKeywords.forEach(keyword => {
      if (words.some(word => word.includes(keyword))) {
        foundTopics.push(keyword)
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

  // Extract key phrases (simple implementation)
  static extractKeyPhrases(text: string, maxPhrases: number = 5): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ])

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))

    // Simple frequency counting for key phrases
    const wordFreq = words.reduce((acc: Record<string, number>, word) => {
      acc[word] = (acc[word] || 0) + 1
      return acc
    }, {})

    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxPhrases)
      .map(([word]) => word)
  }
}