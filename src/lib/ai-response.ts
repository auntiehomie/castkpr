// src/lib/ai-response.ts
import { AIContextService } from './ai-context'
import OpenAI from 'openai'

// You could also use Anthropic Claude, Google Gemini, etc.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export class AIResponseService {
  
  // Generate intelligent response using AI + context
  static async generateResponse(
    castContent: string,
    responseType: 'opinion' | 'recommendation' | 'analysis' | 'trending' = 'opinion',
    targetAuthor?: string,
    requesterUsername?: string
  ): Promise<string> {
    
    try {
      // Build rich context from saved casts data
      console.log('🧠 Building context for AI response...')
      const context = await AIContextService.buildContext(
        castContent,
        targetAuthor,
        requesterUsername
      )
      
      // Create AI prompt with context
      const prompt = AIContextService.buildAIPrompt(castContent, context, responseType)
      
      console.log('🤖 Generating AI response...')
      
      // Get AI response
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Fast and cost-effective
        messages: [
          {
            role: "system",
            content: prompt
          }
        ],
        max_tokens: 150, // Keep responses concise for social media
        temperature: 0.7, // Balance creativity with consistency
      })
      
      const response = completion.choices[0]?.message?.content?.trim()
      
      if (!response) {
        return this.getFallbackResponse(responseType, context)
      }
      
      // Log for learning (you could store these for further analysis)
      console.log('✅ AI response generated:', response.substring(0, 50) + '...')
      
      return response
      
    } catch (error) {
      console.error('❌ AI response generation failed:', error)
      
      // Fallback to data-driven response if AI fails
      return this.getFallbackResponse(responseType, await AIContextService.buildContext(castContent))
    }
  }

  // Enhanced opinion generation with web context
  static async generateOpinionWithWebContext(
    castContent: string,
    targetAuthor?: string,
    requesterUsername?: string
  ): Promise<string> {
    
    // Get additional web context
    const webContext = await this.getWebContext(castContent)
    
    const baseContext = await AIContextService.buildContext(
      castContent,
      targetAuthor,
      requesterUsername
    )
    
    // Enhance context with web data
    const enhancedContext = {
      ...baseContext,
      external_context: {
        ...baseContext.external_context,
        ...webContext
      }
    }
    
    const prompt = this.buildEnhancedPrompt(castContent, enhancedContext)
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.6,
      })
      
      return completion.choices[0]?.message?.content?.trim() || 
        this.getFallbackResponse('opinion', enhancedContext)
        
    } catch (error) {
      console.error('Enhanced opinion generation failed:', error)
      return this.generateResponse(castContent, 'opinion', targetAuthor, requesterUsername)
    }
  }

  // Get additional context from web sources
  private static async getWebContext(castContent: string): Promise<any> {
    // Extract topics/keywords from cast
    const keywords = this.extractKeywords(castContent)
    
    // You could integrate with:
    // - Google Trends API
    // - News API
    // - Twitter Trending API
    // - Reddit API
    // - Crypto/stock APIs
    
    // For now, simulate web context based on keywords
    const webContext: any = {}
    
    // Example: if cast mentions crypto terms
    if (keywords.some(k => ['crypto', 'bitcoin', 'ethereum', 'defi'].includes(k.toLowerCase()))) {
      webContext.market_trends = [
        'Crypto markets showing volatility this week',
        'DeFi TVL at $50B+',
        'ETH staking yields around 4%'
      ]
    }
    
    // Example: if cast mentions AI
    if (keywords.some(k => ['ai', 'artificial intelligence', 'machine learning'].includes(k.toLowerCase()))) {
      webContext.tech_trends = [
        'AI adoption accelerating across industries',
        'New LLM models releasing weekly',
        'AI safety discussions intensifying'
      ]
    }
    
    return webContext
  }

  // Build enhanced prompt with web context
  private static buildEnhancedPrompt(castContent: string, context: any): string {
    const basePrompt = AIContextService.buildAIPrompt(castContent, context, 'opinion')
    
    let webContextSection = ''
    if (context.external_context.market_trends) {
      webContextSection += `\nMARKET CONTEXT: ${context.external_context.market_trends.join(', ')}`
    }
    if (context.external_context.tech_trends) {
      webContextSection += `\nTECH CONTEXT: ${context.external_context.tech_trends.join(', ')}`
    }
    
    return basePrompt + webContextSection + 
      '\n\nIncorporate relevant external context when it adds value to your opinion.'
  }

  // Fallback response using data patterns (no AI)
  private static getFallbackResponse(responseType: string, context: any): string {
    switch (responseType) {
      case 'opinion':
        if (context.cast_analysis.quality_score > 0.7) {
          return `🔥 This hits on trending topics like ${context.community_trends.trending_topics.slice(0, 2).join(' & ')}. Quality score is ${(context.cast_analysis.quality_score * 100).toFixed(0)}% based on community patterns!`
        } else {
          return `🤔 Interesting perspective! While it doesn't match typical high-save patterns, it touches on ${context.cast_analysis.key_themes.slice(0, 2).join(' & ')}. Sometimes unique takes are worth preserving.`
        }
        
      case 'trending':
        return `🔥 Hot topics this week: ${context.community_trends.trending_topics.slice(0, 4).join(', ')}. These are getting lots of saves lately!`
        
      case 'recommendation':
        return `🎯 Based on current patterns, try content about: ${context.community_trends.trending_topics.slice(0, 3).join(', ')}. Also trending: ${context.community_trends.hot_hashtags.slice(0, 3).map(h => '#' + h).join(', ')}`
        
      default:
        return `📊 Based on community data: Quality score ${(context.cast_analysis.quality_score * 100).toFixed(0)}%, trending alignment ${(context.cast_analysis.trending_alignment * 100).toFixed(0)}%. ${context.cast_analysis.engagement_prediction}`
    }
  }

  // Extract keywords for web context
  private static extractKeywords(content: string): string[] {
    return content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'will', 'been', 'were'].includes(word))
      .slice(0, 10)
  }

  // Store responses for learning (optional)
  static async logResponse(
    castContent: string,
    response: string,
    responseType: string,
    engagement?: { likes: number, replies: number }
  ): Promise<void> {
    // You could store AI responses and their engagement
    // to learn which types of responses work better
    try {
      // Example: store in Supabase for analysis
      await supabase.from('ai_responses').insert({
        cast_content: castContent.substring(0, 500),
        response: response,
        response_type: responseType,
        engagement_likes: engagement?.likes || 0,
        engagement_replies: engagement?.replies || 0,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.log('Could not log response for learning:', error)
    }
  }
}

// Alternative providers (you can switch between them)
export class AnthropicResponseService {
  static async generateResponse(prompt: string): Promise<string> {
    // If you prefer Claude
    // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    // const response = await anthropic.messages.create({ ... })
    throw new Error('Anthropic integration not implemented yet')
  }
}

export class LocalLLMService {
  static async generateResponse(prompt: string): Promise<string> {
    // If you want to use local models like Ollama
    // const response = await fetch('http://localhost:11434/api/generate', { ... })
    throw new Error('Local LLM integration not implemented yet')
  }
}