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
  sample_casts: string[]
}

export class CastIntelligence {
  
  // Analyze what makes a cast "save-worthy" based on existing data
  static async analyzeCastQuality(castContent: string, engagement?: {
    likes: number
    replies: number
    recasts: number
  }): Promise<CastInsight> {
    
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
  }

  // Find trending topics based on recently saved casts
  static async getTrendingTopics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<TrendingTopic[]> {
    const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30
    const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: recentCasts } = await supabase
      .from('saved_casts')
      .select('*')
      .gte('created_at', since)
    
    if (!recentCasts) return []
    
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
      
      const engagement = cast.likes_count + cast.replies_count + cast.recasts_count
      
      allTopics.forEach(topic => {
        const current = topicCounts.get(topic) || { count: 0, totalEngagement: 0, casts: [] }
        topicCounts.set(topic, {
          count: current.count + 1,
          totalEngagement: current.totalEngagement + engagement,
          casts: [...current.casts, cast.cast_hash]
        })
      })
    })
    
    // Convert to trending topics and sort by save count
    return Array.from(topicCounts.entries())
      .map(([topic, data]) => ({
        topic,
        save_count: data.count,
        engagement_avg: data.totalEngagement / data.count,
        recent_growth: data.count, // Could calculate growth vs previous period
        sample_casts: data.casts.slice(0, 3)
      }))
      .sort((a, b) => b.save_count - a.save_count)
      .slice(0, 10)
  }

  // Generate cstkpr's opinion on a cast
  static async generateOpinion(castContent: string, author?: string): Promise<string> {
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
  }

  // Get recommendations based on user's saved casts
  static async getPersonalizedRecommendations(userId: string): Promise<{
    topics: string[]
    similar_users: string[]
    recommended_hashtags: string[]
  }> {
    const userCasts = await CastService.getUserCasts(userId, 100)
    
    // Analyze user preferences
    const userTopics = new Map<string, number>()
    const userHashtags = new Map<string, number>()
    
    userCasts.forEach(cast => {
      const hashtags = cast.parsed_data?.hashtags || []
      const topics = cast.parsed_data?.topics || []
      
      hashtags.forEach(tag => {
        userHashtags.set(tag, (userHashtags.get(tag) || 0) + 1)
      })
      
      topics.forEach(topic => {
        userTopics.set(topic, (userTopics.get(topic) || 0) + 1)
      })
    })
    
    // Find users with similar interests
    const { data: allUsers } = await supabase
      .from('saved_casts')
      .select('saved_by_user_id, parsed_data')
      .neq('saved_by_user_id', userId)
    
    // Calculate similarity scores (simplified)
    const similarUsers = this.findSimilarUsers(userTopics, allUsers || [])
    
    return {
      topics: Array.from(userTopics.keys()).slice(0, 5),
      similar_users: similarUsers.slice(0, 3),
      recommended_hashtags: Array.from(userHashtags.keys()).slice(0, 10)
    }
  }

  // Private helper methods
  private static async findSimilarSavedCasts(content: string): Promise<SavedCast[]> {
    // Use simple text similarity for now - could use embeddings later
    const keywords = this.extractKeywords(content)
    
    const { data } = await supabase
      .from('saved_casts')
      .select('*')
      .textSearch('cast_content', keywords.join(' | '))
      .limit(5)
    
    return data || []
  }

  private static async calculateQualityScore(
    content: string, 
    engagement?: { likes: number; replies: number; recasts: number },
    similarCasts: SavedCast[] = []
  ): Promise<number> {
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
        sum + cast.likes_count + cast.replies_count + cast.recasts_count, 0
      ) / similarCasts.length
      
      if (avgEngagement > 20) score += 0.2
    }
    
    return Math.min(score, 1.0)
  }

  private static async calculateTrendingScore(topics: string[]): Promise<number> {
    const trendingTopics = await this.getTrendingTopics()
    const trendingTopicNames = trendingTopics.map(t => t.topic.toLowerCase())
    
    const matchingTopics = topics.filter(topic => 
      trendingTopicNames.includes(topic.toLowerCase())
    )
    
    return matchingTopics.length / Math.max(topics.length, 1)
  }

  private static extractTopics(content: string): string[] {
    // Extract hashtags
    const hashtags = [...content.matchAll(/#(\w+)/g)].map(match => match[1])
    
    // Extract potential topics (simplified keyword extraction)
    const keywords = this.extractKeywords(content)
    
    return [...hashtags, ...keywords].slice(0, 5)
  }

  private static extractKeywords(content: string): string[] {
    // Simple keyword extraction - could use NLP library
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'will'].includes(word))
    
    return [...new Set(words)].slice(0, 3)
  }

  private static analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    // Simple sentiment analysis - could use ML model
    const positiveWords = ['great', 'awesome', 'love', 'amazing', 'good', 'best', 'happy']
    const negativeWords = ['bad', 'hate', 'terrible', 'awful', 'worst', 'sad', 'angry']
    
    const lowerContent = content.toLowerCase()
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length
    
    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
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
    // Simplified similarity calculation
    const userSimilarity = new Map<string, number>()
    
    allUserData.forEach(userData => {
      const otherTopics = userData.parsed_data?.topics || []
      const otherHashtags = userData.parsed_data?.hashtags || []
      const otherAllTopics = [...otherTopics, ...otherHashtags]
      
      let similarity = 0
      otherAllTopics.forEach(topic => {
        if (userTopics.has(topic)) {
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
  }
}