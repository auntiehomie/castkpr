// src/lib/intelligence.ts
import { CastService, supabase } from './supabase'
import type { SavedCast } from './supabase'

export interface CastInsight {
  quality_score: number
  trending_score: number
  topics: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
  save_worthiness: number
  similar_casts: string[]
}

export interface TrendingTopic {
  topic: string
  save_count: number
  engagement_avg: number
  recent_growth: number
  sample_casts?: string[]
}

export class CastIntelligence {
  
  // Analyze what makes a cast "save-worthy" based on existing data
  static async analyzeCastQuality(castContent: string, engagement?: {
    likes: number
    replies: number
    recasts: number
  }): Promise<CastInsight> {
    
    try {
      // Get similar saved casts for comparison
      const similarCasts = await this.findSimilarSavedCasts(castContent)
      
      // Calculate quality score based on patterns in saved casts
      const qualityScore = await this.calculateQualityScore(castContent, engagement, similarCasts)
      
      // Extract topics and sentiment
      const topics = this.extractTopics(castContent)
      const sentiment = this.analyzeSentiment(castContent)
      
      // Calculate trending score
      const trendingScore = await this.calculateTrendingScore(topics)
      
      return {
        quality_score: qualityScore,
        trending_score: trendingScore,
        topics,
        sentiment,
        save_worthiness: (qualityScore * 0.7) + (trendingScore * 0.3),
        similar_casts: similarCasts.map(c => c.cast_hash)
      }
    } catch (error) {
      console.error('Error analyzing cast quality:', error)
      return {
        quality_score: 0.5,
        trending_score: 0,
        topics: [],
        sentiment: 'neutral',
        save_worthiness: 0.5,
        similar_casts: []
      }
    }
  }

  // Find trending topics based on recently saved casts
  static async getTrendingTopics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<TrendingTopic[]> {
    try {
      const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30
      const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: recentCasts, error } = await supabase
        .from('saved_casts')
        .select('*')
        .gte('created_at', since)
        .limit(1000) // Add reasonable limit
      
      if (error) {
        console.error('Error fetching recent casts:', error)
        return []
      }
      
      if (!recentCasts || recentCasts.length === 0) {
        console.log('No recent casts found')
        return []
      }
      
      // Analyze hashtags and topics
      const topicCounts = new Map<string, {
        count: number
        totalEngagement: number
        casts: string[]
      }>()
      
      recentCasts.forEach(cast => {
        const hashtags = cast.parsed_data?.hashtags || []
        const topics = cast.parsed_data?.topics || []
        const allTopics = [...hashtags, ...topics]
        
        // Safe engagement calculation with null checking
        const engagement = (cast.likes_count || 0) + (cast.replies_count || 0) + (cast.recasts_count || 0)
        
        allTopics.forEach(topic => {
          if (topic && typeof topic === 'string' && topic.length > 1) {
            const cleanTopic = topic.toLowerCase().trim()
            const current = topicCounts.get(cleanTopic) || { count: 0, totalEngagement: 0, casts: [] }
            topicCounts.set(cleanTopic, {
              count: current.count + 1,
              totalEngagement: current.totalEngagement + engagement,
              casts: [...current.casts, cast.cast_hash].slice(0, 3) // Keep only first 3
            })
          }
        })
      })
      
      // Convert to trending topics and sort by save count
      return Array.from(topicCounts.entries())
        .filter(([topic, data]) => data.count >= 2) // Must appear at least twice
        .map(([topic, data]) => ({
          topic,
          save_count: data.count,
          engagement_avg: data.count > 0 ? data.totalEngagement / data.count : 0,
          recent_growth: data.count, // Could calculate growth vs previous period
          sample_casts: data.casts
        }))
        .sort((a, b) => b.save_count - a.save_count)
        .slice(0, 20)
        
    } catch (error) {
      console.error('Error getting trending topics:', error)
      return []
    }
  }

  // Generate cstkpr's opinion on a cast
  static async generateOpinion(castContent: string, author?: string): Promise<string> {
    try {
      const insight = await this.analyzeCastQuality(castContent)
      const trendingTopics = await this.getTrendingTopics()
      
      // Check if cast topics are trending
      const castTopics = insight.topics
      const trendingTopicNames = trendingTopics.map(t => t.topic)
      const isOnTrend = castTopics.some(topic => trendingTopicNames.includes(topic))
      
      // Generate opinion based on analysis
      if (insight.save_worthiness > 0.8) {
        return this.generatePositiveOpinion(insight, isOnTrend)
      } else if (insight.save_worthiness > 0.5) {
        return this.generateNeutralOpinion(insight, isOnTrend)
      } else {
        return this.generateSuggestion(insight)
      }
    } catch (error) {
      console.error('Error generating opinion:', error)
      return "🤖 I'm having trouble analyzing this cast right now, but feel free to save it if it interests you!"
    }
  }

  // Get recommendations based on user's saved casts
  static async getPersonalizedRecommendations(userId: string): Promise<{
    topics: string[]
    similar_users: string[]
    recommended_hashtags: string[]
  }> {
    try {
      const userCasts = await CastService.getUserCasts(userId, 100)
      
      if (userCasts.length === 0) {
        return {
          topics: [],
          similar_users: [],
          recommended_hashtags: []
        }
      }
      
      // Analyze user preferences
      const userTopics = new Map<string, number>()
      const userHashtags = new Map<string, number>()
      
      userCasts.forEach(cast => {
        const hashtags = cast.parsed_data?.hashtags || []
        const topics = cast.parsed_data?.topics || []
        
        hashtags.forEach(tag => {
          if (tag && typeof tag === 'string') {
            userHashtags.set(tag, (userHashtags.get(tag) || 0) + 1)
          }
        })
        
        topics.forEach(topic => {
          if (topic && typeof topic === 'string') {
            userTopics.set(topic, (userTopics.get(topic) || 0) + 1)
          }
        })
      })
      
      // Find users with similar interests
      const { data: allUsers, error } = await supabase
        .from('saved_casts')
        .select('saved_by_user_id, parsed_data')
        .neq('saved_by_user_id', userId)
        .limit(500) // Reasonable limit
      
      if (error) {
        console.error('Error fetching similar users:', error)
      }
      
      // Calculate similarity scores (simplified)
      const similarUsers = this.findSimilarUsers(userTopics, allUsers || [])
      
      return {
        topics: Array.from(userTopics.keys()).slice(0, 5),
        similar_users: similarUsers.slice(0, 3),
        recommended_hashtags: Array.from(userHashtags.keys()).slice(0, 10)
      }
      
    } catch (error) {
      console.error('Error getting personalized recommendations:', error)
      return {
        topics: [],
        similar_users: [],
        recommended_hashtags: []
      }
    }
  }

  // Private helper methods
  private static async findSimilarSavedCasts(content: string): Promise<SavedCast[]> {
    try {
      // Use simple text similarity for now - could use embeddings later
      const keywords = this.extractKeywords(content)
      
      if (keywords.length === 0) return []
      
      // Use ilike for case-insensitive search instead of textSearch
      const { data, error } = await supabase
        .from('saved_casts')
        .select('*')
        .ilike('cast_content', `%${keywords[0]}%`)
        .limit(5)
      
      if (error) {
        console.error('Error finding similar casts:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error in findSimilarSavedCasts:', error)
      return []
    }
  }

  private static async calculateQualityScore(
    content: string, 
    engagement?: { likes: number; replies: number; recasts: number },
    similarCasts: SavedCast[] = []
  ): Promise<number> {
    try {
      let score = 0.5 // Base score
      
      // Length factor (not too short, not too long)
      const wordCount = content.split(' ').length
      if (wordCount > 10 && wordCount < 100) score += 0.1
      
      // URL factor (links often indicate value)
      if (content.includes('http')) score += 0.1
      
      // Engagement factor
      if (engagement) {
        const totalEngagement = engagement.likes + engagement.replies + engagement.recasts
        if (totalEngagement > 10) score += 0.2
        if (totalEngagement > 50) score += 0.1
      }
      
      // Similar casts factor (if similar content was saved before, it's likely good)
      if (similarCasts.length > 0) {
        const avgEngagement = similarCasts.reduce((sum, cast) => 
          sum + (cast.likes_count || 0) + (cast.replies_count || 0) + (cast.recasts_count || 0), 0
        ) / similarCasts.length
        
        if (avgEngagement > 20) score += 0.2
      }
      
      return Math.min(score, 1.0)
    } catch (error) {
      console.error('Error calculating quality score:', error)
      return 0.5
    }
  }

  private static async calculateTrendingScore(topics: string[]): Promise<number> {
    try {
      if (topics.length === 0) return 0
      
      const trendingTopics = await this.getTrendingTopics()
      const trendingTopicNames = trendingTopics.map(t => t.topic.toLowerCase())
      
      const matchingTopics = topics.filter(topic => 
        trendingTopicNames.includes(topic.toLowerCase())
      )
      
      return matchingTopics.length / Math.max(topics.length, 1)
    } catch (error) {
      console.error('Error calculating trending score:', error)
      return 0
    }
  }

  private static extractTopics(content: string): string[] {
    try {
      // Extract hashtags
      const hashtags = [...content.matchAll(/#(\w+)/g)].map(match => match[1])
      
      // Extract potential topics (simplified keyword extraction)
      const keywords = this.extractKeywords(content)
      
      return [...hashtags, ...keywords].slice(0, 5)
    } catch (error) {
      console.error('Error extracting topics:', error)
      return []
    }
  }

  private static extractKeywords(content: string): string[] {
    try {
      // Simple keyword extraction - could use NLP library
      const words = content.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(word => word.length > 3)
        .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'will'].includes(word))
      
      return [...new Set(words)].slice(0, 3)
    } catch (error) {
      console.error('Error extracting keywords:', error)
      return []
    }
  }

  private static analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    try {
      // Simple sentiment analysis - could use ML model
      const positiveWords = ['great', 'awesome', 'love', 'amazing', 'good', 'best', 'happy']
      const negativeWords = ['bad', 'hate', 'terrible', 'awful', 'worst', 'sad', 'angry']
      
      const lowerContent = content.toLowerCase()
      const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length
      const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length
      
      if (positiveCount > negativeCount) return 'positive'
      if (negativeCount > positiveCount) return 'negative'
      return 'neutral'
    } catch (error) {
      console.error('Error analyzing sentiment:', error)
      return 'neutral'
    }
  }

  private static generatePositiveOpinion(insight: CastInsight, isOnTrend: boolean): string {
    const opinions = [
      `🔥 This looks like quality content! I see ${insight.topics.length} relevant topics and it matches patterns from highly-saved casts.`,
      `💎 Strong save candidate! The content quality scores high based on what the community typically saves.`,
      `⭐ This has all the markers of content worth preserving - good topics, quality writing.`
    ]
    
    let opinion = opinions[Math.floor(Math.random() * opinions.length)]
    
    if (isOnTrend) {
      opinion += ` Plus it touches on trending topics right now!`
    }
    
    return opinion
  }

  private static generateNeutralOpinion(insight: CastInsight, isOnTrend: boolean): string {
    return `🤔 This could be worth saving depending on your interests. It covers topics like ${insight.topics.slice(0, 2).join(', ')}. Quality score is decent but not exceptional.`
  }

  private static generateSuggestion(insight: CastInsight): string {
    return `💡 While this cast doesn't match typical "highly saved" patterns, it might still be valuable if it's relevant to your specific interests. Consider what makes it meaningful to you!`
  }

  private static findSimilarUsers(userTopics: Map<string, number>, allUserData: any[]): string[] {
    try {
      // Simplified similarity calculation
      const userSimilarity = new Map<string, number>()
      
      allUserData.forEach(userData => {
        if (!userData.saved_by_user_id || !userData.parsed_data) return
        
        const otherTopics = userData.parsed_data?.topics || []
        const otherHashtags = userData.parsed_data?.hashtags || []
        const otherAllTopics = [...otherTopics, ...otherHashtags]
        
        let similarity = 0
        otherAllTopics.forEach(topic => {
          if (topic && userTopics.has(topic)) {
            similarity += 1
          }
        })
        
        if (similarity > 0) {
          const currentSim = userSimilarity.get(userData.saved_by_user_id) || 0
          userSimilarity.set(userData.saved_by_user_id, currentSim + similarity)
        }
      })
      
      return Array.from(userSimilarity.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([userId]) => userId)
        .slice(0, 5)
    } catch (error) {
      console.error('Error finding similar users:', error)
      return []
    }
  }
}