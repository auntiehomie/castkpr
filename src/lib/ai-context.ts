// src/lib/ai-context.ts

import { supabase } from './supabase'

// Interfaces
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

// AI Context Service
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
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
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
    // You could enhance this with more sophisticated similarity matching
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
        .single()

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

  // Cleanup old or low-confidence contexts
  static async cleanupContexts(
    minConfidence: number = 0.1, 
    maxAge: number = 90 // days
  ): Promise<{ deleted: number }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - maxAge)

      const { data: deletedContexts, error } = await supabase
        .from('ai_contexts')
        .delete()
        .or(`confidence_score.lt.${minConfidence},created_at.lt.${cutoffDate.toISOString()}`)
        .select('id')

      if (error) {
        console.error('Error cleaning up contexts:', error)
        throw error
      }

      return { deleted: deletedContexts?.length || 0 }
    } catch (error) {
      console.error('Error in cleanupContexts:', error)
      return { deleted: 0 }
    }
  }

  // Merge similar contexts
  static async mergeSimilarContexts(similarityThreshold: number = 0.8): Promise<{ merged: number }> {
    try {
      // This is a simplified version - you could enhance with more sophisticated similarity detection
      const contexts = await this.getAllContexts()
      let mergedCount = 0

      for (let i = 0; i < contexts.length; i++) {
        for (let j = i + 1; j < contexts.length; j++) {
          const context1 = contexts[i]
          const context2 = contexts[j]

          // Simple similarity check based on topic keywords
          const similarity = this.calculateTopicSimilarity(context1.topic, context2.topic)

          if (similarity > similarityThreshold) {
            // Merge context2 into context1
            const mergedInsights = [...new Set([...context1.key_insights, ...context2.key_insights])]
            const mergedCasts = [...new Set([...context1.related_casts, ...context2.related_casts])]
            const avgConfidence = (context1.confidence_score + context2.confidence_score) / 2

            await this.updateContext(context1.topic, {
              key_insights: mergedInsights,
              related_casts: mergedCasts,
              confidence_score: Math.min(avgConfidence + 0.1, 1.0), // Boost confidence for merged contexts
              summary: `${context1.summary} (Merged with ${context2.topic})`
            })

            // Delete the second context
            await this.deleteContext(context2.id)
            mergedCount++

            // Remove merged context from array to avoid duplicate processing
            contexts.splice(j, 1)
            j-- // Adjust index after removal
          }
        }
      }

      return { merged: mergedCount }
    } catch (error) {
      console.error('Error merging similar contexts:', error)
      return { merged: 0 }
    }
  }

  // Helper method to calculate topic similarity
  private static calculateTopicSimilarity(topic1: string, topic2: string): number {
    const words1 = topic1.toLowerCase().split(/\s+/)
    const words2 = topic2.toLowerCase().split(/\s+/)
    
    const intersection = words1.filter(word => words2.includes(word))
    const union = [...new Set([...words1, ...words2])]
    
    return intersection.length / union.length
  }
}

// Export the main types and service
export default AIContextService