import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export class AITaggingService {
  // Generate smart tags for a cast
  static async generateTags(castContent: string, authorUsername?: string): Promise<string[]> {
    try {
      const prompt = `Analyze this Farcaster cast and generate 3-7 relevant tags that would help categorize and find this content later.

Cast Content: "${castContent}"
Author: ${authorUsername || 'Unknown'}

Generate tags that are:
- Descriptive of the main topics/themes
- Useful for searching and filtering
- Consistent with common social media tagging
- Mix of broad categories and specific topics
- Include technical terms if relevant

Return only a JSON array of strings, like: ["technology", "defi", "ethereum", "tutorial"]

Examples:
- A cast about NFTs → ["nft", "crypto", "art", "blockchain"]
- A cast about cooking → ["food", "cooking", "recipe", "lifestyle"]  
- A cast about farcaster → ["farcaster", "social", "protocol", "decentralized"]
- A cast with a link → ["link", "resource", "reference"]

Tags:`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content categorization assistant. Generate relevant, useful tags for social media content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      })

      const content = response.choices[0]?.message?.content
      if (!content) return ['general']

      try {
        const tags = JSON.parse(content)
        if (Array.isArray(tags) && tags.every(tag => typeof tag === 'string')) {
          // Clean and validate tags
          return tags
            .map(tag => tag.toLowerCase().trim())
            .filter(tag => tag.length > 1 && tag.length < 20)
            .slice(0, 7) // Max 7 tags
        }
      } catch (parseError) {
        console.error('Error parsing AI tags response:', parseError)
      }

      // Fallback: extract keywords from content
      return this.extractKeywordTags(castContent)
    } catch (error) {
      console.error('Error generating AI tags:', error)
      return this.extractKeywordTags(castContent)
    }
  }

  // Fallback keyword extraction
  static extractKeywordTags(content: string): string[] {
    const text = content.toLowerCase()
    
    // Common topic keywords
    const topicKeywords = {
      'crypto': ['bitcoin', 'ethereum', 'crypto', 'defi', 'nft', 'web3', 'blockchain'],
      'tech': ['ai', 'ml', 'api', 'code', 'dev', 'programming', 'software'],
      'social': ['farcaster', 'twitter', 'social', 'community', 'network'],
      'business': ['startup', 'founder', 'invest', 'funding', 'business'],
      'art': ['art', 'design', 'creative', 'music', 'photography'],
      'news': ['news', 'breaking', 'update', 'announce'],
      'question': ['?', 'how', 'what', 'why', 'help', 'advice'],
      'link': ['http', 'link', 'check', 'read', 'article']
    }

    const foundTags: string[] = []

    // Check for topic matches
    for (const [category, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        foundTags.push(category)
      }
    }

    // Add basic content type tags
    if (text.includes('http')) foundTags.push('link')
    if (text.includes('?')) foundTags.push('question')
    if (text.length > 200) foundTags.push('long-form')
    if (text.length < 50) foundTags.push('short')

    return foundTags.length > 0 ? foundTags : ['general']
  }

  // Enhanced cast analysis with tags
  static async analyzeAndTag(castContent: string, authorUsername?: string) {
    try {
      const [tags, analysis] = await Promise.all([
        this.generateTags(castContent, authorUsername),
        this.analyzeCastContent(castContent)
      ])

      return {
        tags,
        analysis,
        category: this.determineCategory(tags),
        sentiment: analysis.sentiment,
        topics: analysis.topics
      }
    } catch (error) {
      console.error('Error in AI analysis:', error)
      return {
        tags: this.extractKeywordTags(castContent),
        category: 'general',
        sentiment: 'neutral',
        topics: []
      }
    }
  }

  // Analyze cast content for deeper insights
  static async analyzeCastContent(content: string) {
    try {
      const prompt = `Analyze this social media post and provide insights:

Content: "${content}"

Provide a JSON response with:
{
  "sentiment": "positive|negative|neutral",
  "topics": ["topic1", "topic2"],
  "contentType": "question|announcement|discussion|link|opinion",
  "engagement_potential": "high|medium|low",
  "summary": "brief summary in 1-2 sentences"
}

Analysis:`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system', 
            content: 'You are a social media content analyst. Provide structured analysis of posts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.2,
      })

      const analysisContent = response.choices[0]?.message?.content
      if (analysisContent) {
        return JSON.parse(analysisContent)
      }
    } catch (error) {
      console.error('Error in content analysis:', error)
    }

    return {
      sentiment: 'neutral',
      topics: [],
      contentType: 'general',
      engagement_potential: 'medium',
      summary: content.slice(0, 100) + '...'
    }
  }

  // Determine main category from tags
  static determineCategory(tags: string[]): string {
    const categoryMap = {
      'technology': ['tech', 'ai', 'crypto', 'blockchain', 'code', 'dev'],
      'social': ['social', 'community', 'farcaster', 'network'],
      'business': ['business', 'startup', 'invest', 'funding'],
      'creative': ['art', 'design', 'creative', 'music'],
      'educational': ['tutorial', 'learning', 'guide', 'tip'],
      'news': ['news', 'update', 'breaking', 'announce'],
      'discussion': ['question', 'opinion', 'thoughts', 'debate']
    }

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (tags.some(tag => keywords.includes(tag))) {
        return category
      }
    }

    return 'general'
  }

  // Bulk tag existing casts
  static async bulkTagCasts(casts: Array<{id: string, cast_content: string, username: string}>) {
    const results = []
    
    for (const cast of casts) {
      try {
        const analysis = await this.analyzeAndTag(cast.cast_content, cast.username)
        results.push({
          id: cast.id,
          tags: analysis.tags,
          category: analysis.category,
          sentiment: analysis.sentiment
        })
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error processing cast ${cast.id}:`, error)
        results.push({
          id: cast.id,
          tags: ['general'],
          category: 'general',
          sentiment: 'neutral'
        })
      }
    }
    
    return results
  }
}