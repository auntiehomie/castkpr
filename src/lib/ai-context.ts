// src/lib/ai-context.ts
import { CastIntelligence } from './intelligence'
import { CastService } from './supabase'
import type { SavedCast } from './supabase'

export interface ContextualData {
  community_trends: {
    trending_topics: string[]
    hot_hashtags: string[]
    emerging_themes: string[]
    save_patterns: string[]
  }
  user_insights: {
    interests: string[]
    typical_save_quality: number
    similar_users: string[]
    recommendation_fit: number
  }
  cast_analysis: {
    quality_score: number
    trending_alignment: number
    engagement_prediction: string
    content_type: string
    key_themes: string[]
  }
  external_context: {
    related_news?: string[]
    broader_trends?: string[]
    market_context?: string[]
  }
}

export class AIContextService {
  
  // Build comprehensive context for AI responses
  static async buildContext(
    targetCastContent: string,
    targetAuthor?: string,
    requesterUsername?: string
  ): Promise<ContextualData> {
    
    // Get community intelligence
    const [trendingTopics, recentSaves] = await Promise.all([
      CastIntelligence.getTrendingTopics('week'),
      this.getRecentCommunitySaves(50)
    ])
    
    // Analyze the specific cast
    const castAnalysis = await CastIntelligence.analyzeCastQuality(targetCastContent)
    
    // Get user-specific insights if available
    const userInsights = requesterUsername 
      ? await CastIntelligence.getPersonalizedRecommendations(requesterUsername)
      : null
    
    // Get external context (news, broader trends)
    const externalContext = await this.getExternalContext(castAnalysis.topics)
    
    return {
      community_trends: {
        trending_topics: trendingTopics.slice(0, 10).map(t => t.topic),
        hot_hashtags: this.extractHotHashtags(recentSaves),
        emerging_themes: this.identifyEmergingThemes(recentSaves),
        save_patterns: this.analyzeSavePatterns(recentSaves)
      },
      user_insights: {
        interests: userInsights?.topics || [],
        typical_save_quality: await this.getUserSaveQuality(requesterUsername),
        similar_users: userInsights?.similar_users || [],
        recommendation_fit: this.calculateRecommendationFit(castAnalysis, userInsights)
      },
      cast_analysis: {
        quality_score: castAnalysis.quality_score,
        trending_alignment: castAnalysis.trending_score,
        engagement_prediction: this.predictEngagement(castAnalysis),
        content_type: this.categorizeContent(targetCastContent),
        key_themes: castAnalysis.topics
      },
      external_context: externalContext
    }
  }

  // Generate AI prompt with rich context
  static buildAIPrompt(
    castContent: string,
    context: ContextualData,
    responseType: 'opinion' | 'recommendation' | 'analysis' | 'trending'
  ): string {
    
    const basePrompt = this.getBasePersonality()
    const contextSection = this.formatContextForPrompt(context)
    const taskSection = this.getTaskInstructions(responseType, castContent)
    
    return `${basePrompt}

${contextSection}

${taskSection}

Remember: Keep responses conversational, insightful, and under 280 characters for social media. Reference specific data points when relevant.`
  }

  // Get recent community saves for pattern analysis
  private static async getRecentCommunitySaves(limit: number): Promise<SavedCast[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data } = await supabase
      .from('saved_casts')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    return data || []
  }

  // Get external context from web/news sources
  private static async getExternalContext(topics: string[]): Promise<{
    related_news?: string[]
    broader_trends?: string[]
    market_context?: string[]
  }> {
    // This could integrate with news APIs, Google Trends, etc.
    // For now, return basic context based on topics
    
    const cryptoTopics = ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft']
    const techTopics = ['ai', 'tech', 'startup', 'coding', 'development']
    const socialTopics = ['social', 'community', 'culture', 'meme']
    
    let context: any = {}
    
    if (topics.some(t => cryptoTopics.includes(t.toLowerCase()))) {
      context.market_context = ['Crypto markets mixed this week', 'DeFi activity increasing']
    }
    
    if (topics.some(t => techTopics.includes(t.toLowerCase()))) {
      context.broader_trends = ['AI adoption accelerating', 'Tech hiring rebounds']
    }
    
    if (topics.some(t => socialTopics.includes(t.toLowerCase()))) {
      context.related_news = ['Social media usage patterns shifting', 'Community-driven content rising']
    }
    
    return context
  }

  // Extract trending hashtags from recent saves
  private static extractHotHashtags(recentSaves: SavedCast[]): string[] {
    const hashtagCounts = new Map<string, number>()
    
    recentSaves.forEach(cast => {
      const hashtags = cast.parsed_data?.hashtags || []
      hashtags.forEach(tag => {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1)
      })
    })
    
    return Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag)
  }

  // Identify emerging themes
  private static identifyEmergingThemes(recentSaves: SavedCast[]): string[] {
    // Look for topics that are suddenly appearing more frequently
    const themes = new Set<string>()
    
    recentSaves.forEach(cast => {
      const content = cast.cast_content.toLowerCase()
      
      // Simple theme detection - could be enhanced with NLP
      if (content.includes('ai') || content.includes('artificial intelligence')) themes.add('AI Discussion')
      if (content.includes('build') || content.includes('shipping')) themes.add('Building in Public')
      if (content.includes('community') || content.includes('together')) themes.add('Community Building')
      if (content.includes('learn') || content.includes('education')) themes.add('Learning & Education')
    })
    
    return Array.from(themes).slice(0, 5)
  }

  // Analyze what types of content get saved
  private static analyzeSavePatterns(recentSaves: SavedCast[]): string[] {
    const patterns = []
    
    const avgWordCount = recentSaves.reduce((sum, cast) => 
      sum + (cast.parsed_data?.word_count || 0), 0
    ) / recentSaves.length
    
    const hasLinksPercent = recentSaves.filter(cast => 
      cast.parsed_data?.urls && cast.parsed_data.urls.length > 0
    ).length / recentSaves.length * 100
    
    const avgEngagement = recentSaves.reduce((sum, cast) => 
      sum + cast.likes_count + cast.replies_count + cast.recasts_count, 0
    ) / recentSaves.length
    
    patterns.push(`Average saved content: ${Math.round(avgWordCount)} words`)
    patterns.push(`${Math.round(hasLinksPercent)}% of saves include links`)
    patterns.push(`Typical engagement: ${Math.round(avgEngagement)} interactions`)
    
    return patterns
  }

  // Calculate how well a cast fits user's typical preferences
  private static calculateRecommendationFit(
    castAnalysis: any,
    userInsights: any
  ): number {
    if (!userInsights) return 0.5
    
    // Simple overlap calculation
    const topicOverlap = castAnalysis.topics.filter((topic: string) => 
      userInsights.topics.includes(topic)
    ).length
    
    return Math.min(topicOverlap / Math.max(castAnalysis.topics.length, 1), 1.0)
  }

  // Get user's typical save quality
  private static async getUserSaveQuality(username?: string): Promise<number> {
    if (!username) return 0.5
    
    const userCasts = await CastService.getUserCasts(username, 20)
    
    if (userCasts.length === 0) return 0.5
    
    const avgEngagement = userCasts.reduce((sum, cast) => 
      sum + cast.likes_count + cast.replies_count + cast.recasts_count, 0
    ) / userCasts.length
    
    // Normalize to 0-1 scale (100+ engagement = 1.0)
    return Math.min(avgEngagement / 100, 1.0)
  }

  // Predict engagement based on cast features
  private static predictEngagement(castAnalysis: any): string {
    const score = castAnalysis.quality_score + castAnalysis.trending_score
    
    if (score > 1.5) return 'High - likely to get significant engagement'
    if (score > 1.0) return 'Medium - decent engagement expected'
    if (score > 0.5) return 'Low-Medium - niche audience appeal'
    return 'Low - may not generate much buzz'
  }

  // Categorize content type
  private static categorizeContent(content: string): string {
    const lower = content.toLowerCase()
    
    if (lower.includes('?') && lower.length < 100) return 'Question/Discussion Starter'
    if (lower.includes('http') || lower.includes('www')) return 'Link Share'
    if (lower.includes('build') || lower.includes('ship')) return 'Building Update'
    if (lower.includes('thread') || lower.includes('🧵')) return 'Thread/Long-form'
    if (lower.includes('gm') || lower.includes('good morning')) return 'Social/Greeting'
    if (lower.length > 200) return 'Long-form Content'
    
    return 'General Discussion'
  }

  // Define cstkpr's personality
  private static getBasePersonality(): string {
    return `You are cstkpr, a knowledgeable AI bot that learns from the Farcaster community's collective wisdom. You analyze patterns in what content gets saved, track emerging trends, and provide insightful opinions based on real data.

Your personality:
- Knowledgeable but not pretentious
- Data-driven but human-friendly  
- Helpful and encouraging
- Occasionally uses relevant emojis
- References specific patterns you've observed
- Admits when you're uncertain but still provides value`
  }

  // Format context for the AI prompt
  private static formatContextForPrompt(context: ContextualData): string {
    return `CURRENT COMMUNITY CONTEXT:
🔥 Trending Topics: ${context.community_trends.trending_topics.slice(0, 5).join(', ')}
📈 Hot Hashtags: ${context.community_trends.hot_hashtags.slice(0, 5).map(h => '#' + h).join(', ')}
🌟 Emerging Themes: ${context.community_trends.emerging_themes.join(', ')}
📊 Save Patterns: ${context.community_trends.save_patterns[0] || 'Building community knowledge'}

CAST ANALYSIS:
Quality Score: ${(context.cast_analysis.quality_score * 100).toFixed(0)}%
Trending Alignment: ${(context.cast_analysis.trending_alignment * 100).toFixed(0)}%
Content Type: ${context.cast_analysis.content_type}
Key Themes: ${context.cast_analysis.key_themes.join(', ')}
Engagement Prediction: ${context.cast_analysis.engagement_prediction}

${context.user_insights.interests.length > 0 ? 
  `USER CONTEXT: Interests include ${context.user_insights.interests.slice(0, 3).join(', ')}` : 
  ''}`
  }

  // Get task-specific instructions
  private static getTaskInstructions(
    responseType: string,
    castContent: string
  ): string {
    switch (responseType) {
      case 'opinion':
        return `TASK: Provide a thoughtful opinion on this cast: "${castContent}"
        
Consider the quality score, trending alignment, and how it fits current community patterns. Be specific about what makes it interesting or valuable.`

      case 'recommendation':
        return `TASK: Based on current trends and patterns, provide recommendations for content topics, hashtags, or approaches that are working well in the community right now.`

      case 'analysis':
        return `TASK: Analyze this cast: "${castContent}"
        
Break down why it might or might not be worth saving based on community patterns, trending topics, and engagement potential.`

      case 'trending':
        return `TASK: Explain what's trending in the community right now based on recent saves and engagement patterns. Highlight the most interesting emerging themes.`

      default:
        return `TASK: Provide helpful insights about: "${castContent}"`
    }
  }
}