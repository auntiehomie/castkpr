import { AIContextService, UserAIProfileService, AILearningService, CastService } from './supabase'
import type { AIContext, UserAIProfile, SavedCast } from './supabase'

export interface ResponseContext {
  castContent: string
  authorUsername: string
  mentionedUser: string
  command: string
  parentCast?: SavedCast
  userProfile?: UserAIProfile
  relevantContexts?: AIContext[]
}

export interface AIResponse {
  content: string
  confidence: number
  reasoning: string
  usedContexts: string[]
  responseType: 'success' | 'error' | 'help' | 'stats' | 'conversational'
}

export class AIResponseService {
  // Generate an AI-powered response based on context
  static async generateResponse(context: ResponseContext): Promise<AIResponse> {
    try {
      console.log('🤖 Generating AI response for:', context.command)
      
      // Get user AI profile for personalization
      const userProfile = context.userProfile || 
        await UserAIProfileService.getProfile(context.mentionedUser)
      
      // Find relevant AI contexts based on cast content
      const relevantContexts = await this.findRelevantContexts(context.castContent)
      
      // Generate response based on command type
      let response: AIResponse
      
      switch (context.command.toLowerCase()) {
        case 'save this':
        case 'save':
          response = await this.generateSaveResponse(context, relevantContexts, userProfile)
          break
        
        case 'help':
          response = await this.generateHelpResponse(context, userProfile)
          break
        
        case 'stats':
          response = await this.generateStatsResponse(context, userProfile)
          break
        
        case 'search':
          response = await this.generateSearchResponse(context, relevantContexts)
          break
        
        default:
          response = await this.generateConversationalResponse(context, relevantContexts, userProfile)
          break
      }
      
      // Log this interaction for learning
      await AILearningService.logLearning('response_generation', {
        command: context.command,
        userProfile: userProfile?.user_id || 'unknown',
        contextsUsed: response.usedContexts,
        confidence: response.confidence,
        responseType: response.responseType
      })
      
      return response
      
    } catch (error) {
      console.error('Error generating AI response:', error)
      return this.generateErrorResponse(context)
    }
  }
  
  // Generate response for save commands
  private static async generateSaveResponse(
    context: ResponseContext, 
    relevantContexts: AIContext[], 
    userProfile: UserAIProfile | null
  ): Promise<AIResponse> {
    
    if (!context.parentCast) {
      return {
        content: "🤔 I don't see a cast to save. Reply to a cast with '@cstkpr save this' to save it!",
        confidence: 1.0,
        reasoning: "No parent cast found to save",
        usedContexts: [],
        responseType: 'error'
      }
    }
    
    // Analyze the cast content for personalized response
    const castTopics = this.extractTopicsFromText(context.parentCast.cast_content)
    const userInterests = userProfile?.interests || []
    const matchingInterests = castTopics.filter(topic => userInterests.includes(topic))
    
    let responseContent = "✅ Cast saved successfully! "
    
    // Add personalized insights based on user profile and contexts
    if (matchingInterests.length > 0) {
      responseContent += `I noticed this relates to your interests: ${matchingInterests.slice(0, 3).join(', ')}. `
    }
    
    // Add relevant context insights
    if (relevantContexts.length > 0) {
      const topContext = relevantContexts[0]
      responseContent += `This connects to the "${topContext.topic}" topic I've been learning about. `
    }
    
    // Add engagement prediction based on historical data
    const avgEngagement = userProfile?.interaction_patterns?.avgEngagement || 0
    if (avgEngagement > 10) {
      responseContent += "Based on your save history, this type of content tends to perform well!"
    }
    
    return {
      content: responseContent,
      confidence: 0.9,
      reasoning: "Successfully saved cast with personalized insights",
      usedContexts: relevantContexts.map(ctx => ctx.topic),
      responseType: 'success'
    }
  }
  
  // Generate help response
  private static async generateHelpResponse(
    context: ResponseContext, 
    userProfile: UserAIProfile | null
  ): Promise<AIResponse> {
    
    const baseHelp = `🤖 CastKPR Bot Commands:
    
📝 **Save Commands:**
• Reply "@cstkpr save this" to any cast
• I'll automatically parse URLs, hashtags, mentions

🔍 **Search & Stats:**
• "@cstkpr stats" - Your saving statistics
• "@cstkpr search [topic]" - Find saved casts

💡 **Tips:**
• I learn from your interactions to give better responses
• Check your dashboard at castkpr.com for full management`
    
    let personalizedTips = ""
    
    if (userProfile) {
      const { interests, interaction_patterns } = userProfile
      
      if (interests.length > 0) {
        personalizedTips += `\n\n🎯 **Based on your interests (${interests.slice(0, 3).join(', ')}):**\n`
        personalizedTips += "• I'll highlight relevant content when you save casts\n"
        personalizedTips += "• Try searching for these topics in your saved casts"
      }
      
      if (interaction_patterns?.castCount > 10) {
        personalizedTips += `\n\n📊 **You've saved ${interaction_patterns.castCount} casts!** Consider organizing them into collections.`
      }
    }
    
    return {
      content: baseHelp + personalizedTips,
      confidence: 1.0,
      reasoning: "Generated comprehensive help with personalization",
      usedContexts: [],
      responseType: 'help'
    }
  }
  
  // Generate stats response
  private static async generateStatsResponse(
    context: ResponseContext, 
    userProfile: UserAIProfile | null
  ): Promise<AIResponse> {
    
    try {
      const userStats = await CastService.getUserStats(context.mentionedUser)
      const userCasts = await CastService.getUserCasts(context.mentionedUser, 100)
      
      let statsContent = `📊 **Your CastKPR Stats:**\n\n`
      statsContent += `💾 **Total Saved Casts:** ${userStats.totalCasts}\n`
      
      if (userCasts.length > 0) {
        // Calculate engagement stats
        const totalEngagement = userCasts.reduce((sum, cast) => 
          sum + (cast.likes_count || 0) + (cast.replies_count || 0) + (cast.recasts_count || 0), 0
        )
        const avgEngagement = totalEngagement / userCasts.length
        
        statsContent += `📈 **Avg Engagement:** ${avgEngagement.toFixed(1)} per cast\n`
        
        // Top topics
        const allTopics = userCasts.flatMap(cast => cast.parsed_data?.topics || [])
        const topicCounts = allTopics.reduce((acc: Record<string, number>, topic) => {
          acc[topic] = (acc[topic] || 0) + 1
          return acc
        }, {})
        
        const topTopics = Object.entries(topicCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([topic, count]) => `${topic} (${count})`)
        
        if (topTopics.length > 0) {
          statsContent += `🏷️ **Top Topics:** ${topTopics.join(', ')}\n`
        }
        
        // Recent activity
        const recentCasts = userCasts.filter(cast => 
          new Date(cast.cast_timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        )
        
        statsContent += `🕒 **This Week:** ${recentCasts.length} casts saved\n`
      }
      
      if (userProfile) {
        statsContent += `\n🎯 **AI Insights:**\n`
        statsContent += `• Engagement Level: ${(userProfile.engagement_level * 100).toFixed(1)}%\n`
        statsContent += `• Preferred Style: ${userProfile.response_style}\n`
        
        if (userProfile.interests.length > 0) {
          statsContent += `• Key Interests: ${userProfile.interests.slice(0, 3).join(', ')}`
        }
      }
      
      return {
        content: statsContent,
        confidence: 0.95,
        reasoning: "Generated comprehensive user statistics",
        usedContexts: [],
        responseType: 'stats'
      }
      
    } catch (error) {
      console.error('Error generating stats response:', error)
      return {
        content: "📊 I couldn't fetch your stats right now, but you can always check your full dashboard at castkpr.com!",
        confidence: 0.5,
        reasoning: "Error fetching user statistics",
        usedContexts: [],
        responseType: 'error'
      }
    }
  }
  
  // Generate search response
  private static async generateSearchResponse(
    context: ResponseContext, 
    relevantContexts: AIContext[]
  ): Promise<AIResponse> {
    
    // Extract search query from the original cast
    const words = context.castContent.split(' ')
    const searchIndex = words.findIndex(word => word.toLowerCase().includes('search'))
    const searchQuery = words.slice(searchIndex + 1).join(' ').trim()
    
    if (!searchQuery) {
      return {
        content: "🔍 Please specify what you'd like to search for! Example: '@cstkpr search crypto'",
        confidence: 1.0,
        reasoning: "No search query provided",
        usedContexts: [],
        responseType: 'error'
      }
    }
    
    try {
      const searchResults = await CastService.searchCasts(context.mentionedUser, searchQuery)
      
      let responseContent = `🔍 **Search Results for "${searchQuery}":**\n\n`
      
      if (searchResults.length === 0) {
        responseContent += "No matching casts found. Try a different search term or check your saved casts at castkpr.com"
        
        // Suggest related topics from AI contexts
        if (relevantContexts.length > 0) {
          responseContent += `\n\n💡 **Related topics you might be interested in:**\n`
          responseContent += relevantContexts.slice(0, 3).map(ctx => `• ${ctx.topic}`).join('\n')
        }
      } else {
        responseContent += `Found ${searchResults.length} matching casts!\n\n`
        
        // Show top 3 results with engagement data
        searchResults.slice(0, 3).forEach((cast, index) => {
          const engagement = (cast.likes_count || 0) + (cast.replies_count || 0) + (cast.recasts_count || 0)
          responseContent += `${index + 1}. @${cast.username} (${engagement} interactions)\n`
          responseContent += `   "${cast.cast_content.slice(0, 100)}${cast.cast_content.length > 100 ? '...' : ''}"\n\n`
        })
        
        responseContent += `📱 View all results at castkpr.com/dashboard`
      }
      
      return {
        content: responseContent,
        confidence: 0.85,
        reasoning: `Search completed for query: ${searchQuery}`,
        usedContexts: relevantContexts.map(ctx => ctx.topic),
        responseType: searchResults.length > 0 ? 'success' : 'error'
      }
      
    } catch (error) {
      console.error('Error performing search:', error)
      return {
        content: `🔍 Search encountered an error. Please try again or search directly at castkpr.com/dashboard`,
        confidence: 0.3,
        reasoning: "Search operation failed",
        usedContexts: [],
        responseType: 'error'
      }
    }
  }
  
  // Generate conversational response
  private static async generateConversationalResponse(
    context: ResponseContext, 
    relevantContexts: AIContext[], 
    userProfile: UserAIProfile | null
  ): Promise<AIResponse> {
    
    // Analyze the content for conversation cues
    const content = context.castContent.toLowerCase()
    const isGreeting = /hello|hi|hey|gm|good morning/.test(content)
    const isQuestion = content.includes('?') || /what|how|why|when|where/.test(content)
    const isThanks = /thanks|thank you|thx/.test(content)
    
    let responseContent = ""
    let responseType: AIResponse['responseType'] = 'conversational'
    
    if (isGreeting) {
      responseContent = userProfile 
        ? `👋 Hey @${context.mentionedUser}! Good to see you again. `
        : `👋 Hello! I'm CastKPR, your cast-saving assistant. `
      
      if (userProfile?.interests && userProfile.interests.length > 0) {
        responseContent += `I see you're interested in ${userProfile.interests.slice(0, 2).join(' and ')}. `
      }
      
      responseContent += `Reply "@cstkpr save this" to any cast to save it!`
      
    } else if (isThanks) {
      responseContent = "🙏 You're welcome! Happy to help you organize your favorite casts. "
      
      if (relevantContexts.length > 0) {
        responseContent += `I'm always learning about topics like ${relevantContexts[0].topic} to give you better insights.`
      }
      
    } else if (isQuestion) {
      responseContent = "🤔 I'm here to help with saving and organizing casts! "
      
      if (relevantContexts.length > 0) {
        const context = relevantContexts[0]
        responseContent += `I notice you mentioned "${context.topic}" - ${context.summary} `
      }
      
      responseContent += `\n\nTry: "@cstkpr help" for commands or "@cstkpr save this" to save any cast.`
      
    } else {
      // Default conversational response
      responseContent = "🤖 I'm CastKPR! I help you save and organize Farcaster casts. "
      
      if (relevantContexts.length > 0) {
        const relatedTopics = relevantContexts.slice(0, 2).map(ctx => ctx.topic)
        responseContent += `I see you're discussing ${relatedTopics.join(' and ')} - interesting topics! `
      }
      
      responseContent += `Reply "@cstkpr save this" to any cast you want to remember.`
    }
    
    return {
      content: responseContent,
      confidence: 0.7,
      reasoning: "Generated contextual conversational response",
      usedContexts: relevantContexts.map(ctx => ctx.topic),
      responseType
    }
  }
  
  // Generate error response
  private static generateErrorResponse(context: ResponseContext): AIResponse {
    return {
      content: "⚠️ Something went wrong, but I'm still learning! Try '@cstkpr help' for available commands or visit castkpr.com",
      confidence: 0.1,
      reasoning: "Fallback error response",
      usedContexts: [],
      responseType: 'error'
    }
  }
  
  // Find relevant AI contexts based on content
  private static async findRelevantContexts(content: string): Promise<AIContext[]> {
    try {
      const topics = this.extractTopicsFromText(content)
      const contexts: AIContext[] = []
      
      // Search for contexts matching detected topics
      for (const topic of topics) {
        const context = await AIContextService.getContext(topic)
        if (context) {
          contexts.push(context)
        }
      }
      
      // If no direct matches, search for similar contexts
      if (contexts.length === 0) {
        const searchResults = await AIContextService.searchContexts(content.slice(0, 100))
        contexts.push(...searchResults.slice(0, 3))
      }
      
      return contexts.sort((a, b) => b.confidence_score - a.confidence_score)
      
    } catch (error) {
      console.error('Error finding relevant contexts:', error)
      return []
    }
  }
  
  // Extract topics from text (simplified NLP)
  private static extractTopicsFromText(text: string): string[] {
    const topicKeywords = [
      'crypto', 'nft', 'defi', 'web3', 'blockchain', 'ethereum', 'bitcoin',
      'art', 'music', 'gaming', 'sports', 'politics', 'tech', 'ai', 'ml',
      'startup', 'venture', 'investment', 'trading', 'market', 'finance',
      'social', 'community', 'meme', 'culture', 'philosophy', 'science'
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
  
  // Update user profile based on interaction
  static async updateUserProfileFromInteraction(
    userId: string, 
    castContent: string, 
    command: string,
    engagementData?: { likes: number; replies: number; recasts: number }
  ): Promise<void> {
    try {
      const topics = this.extractTopicsFromText(castContent)
      
      if (topics.length > 0) {
        await UserAIProfileService.updateUserInterests(userId, topics)
      }
      
      // Update interaction patterns
      const existingProfile = await UserAIProfileService.getProfile(userId)
      const currentPatterns = existingProfile?.interaction_patterns || {}
      
      // Track command usage
      const commandCounts = currentPatterns.commandCounts || {}
      commandCounts[command] = (commandCounts[command] || 0) + 1
      
      // Track engagement if provided
      if (engagementData) {
        const totalEngagement = engagementData.likes + engagementData.replies + engagementData.recasts
        const engagementHistory = currentPatterns.engagementHistory || []
        engagementHistory.push(totalEngagement)
        
        // Keep only last 50 interactions
        if (engagementHistory.length > 50) {
          engagementHistory.splice(0, engagementHistory.length - 50)
        }
        
        currentPatterns.engagementHistory = engagementHistory
      }
      
      currentPatterns.commandCounts = commandCounts
      currentPatterns.lastInteraction = new Date().toISOString()
      
      // Calculate engagement level
      const engagementLevel = existingProfile?.engagement_level || 0
      const newEngagementLevel = Math.min(engagementLevel + 0.1, 1.0)
      
      await UserAIProfileService.upsertProfile({
        user_id: userId,
        interests: existingProfile?.interests || topics,
        interaction_patterns: currentPatterns,
        preferred_topics: existingProfile?.preferred_topics || topics,
        response_style: existingProfile?.response_style || 'conversational',
        engagement_level: newEngagementLevel,
        last_updated: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Error updating user profile from interaction:', error)
    }
  }
}