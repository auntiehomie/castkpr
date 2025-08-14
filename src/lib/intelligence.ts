import type { SavedCast } from './supabase'

export interface IntelligenceData {
  totalCasts: number
  topAuthors: { username: string; count: number; displayName?: string }[]
  topHashtags: { hashtag: string; count: number }[]
  topMentions: { mention: string; count: number }[]
  topDomains: { domain: string; count: number }[]
  engagementStats: {
    totalLikes: number
    totalReplies: number
    totalRecasts: number
    avgLikes: number
    avgReplies: number
    avgRecasts: number
    highestEngagement: {
      cast: SavedCast
      totalEngagement: number
    } | null
  }
  savingTrends: { date: string; count: number }[]
  wordCloudData: { word: string; count: number }[]
  categoryDistribution: { category: string; count: number }[]
  timePatterns: {
    hourly: { hour: number; count: number }[]
    daily: { day: string; count: number }[]
    monthly: { month: string; count: number }[]
  }
  contentAnalysis: {
    avgWordCount: number
    totalWords: number
    urlCount: number
    mentionCount: number
    hashtagCount: number
    longestCast: SavedCast | null
    shortestCast: SavedCast | null
  }
}

export class IntelligenceService {
  /**
   * Process raw cast data into intelligence insights
   */
  static processIntelligenceData(casts: SavedCast[]): IntelligenceData {
    const totalCasts = casts.length

    return {
      totalCasts,
      topAuthors: this.analyzeTopAuthors(casts),
      topHashtags: this.analyzeTopHashtags(casts),
      topMentions: this.analyzeTopMentions(casts),
      topDomains: this.analyzeTopDomains(casts),
      engagementStats: this.analyzeEngagement(casts),
      savingTrends: this.analyzeSavingTrends(casts),
      wordCloudData: this.analyzeWordFrequency(casts),
      categoryDistribution: this.analyzeCategoryDistribution(casts),
      timePatterns: this.analyzeTimePatterns(casts),
      contentAnalysis: this.analyzeContent(casts)
    }
  }

  /**
   * Analyze top authors by frequency
   */
  private static analyzeTopAuthors(casts: SavedCast[]): { username: string; count: number; displayName?: string }[] {
    const authorCounts: Record<string, { count: number; displayName?: string }> = {}
    
    casts.forEach(cast => {
      if (!authorCounts[cast.username]) {
        authorCounts[cast.username] = { 
          count: 0, 
          displayName: cast.author_display_name 
        }
      }
      authorCounts[cast.username].count++
    })

    return Object.entries(authorCounts)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([username, data]) => ({ 
        username, 
        count: data.count,
        displayName: data.displayName 
      }))
  }

  /**
   * Analyze top hashtags
   */
  private static analyzeTopHashtags(casts: SavedCast[]): { hashtag: string; count: number }[] {
    const hashtagCounts: Record<string, number> = {}
    
    casts.forEach(cast => {
      if (cast.parsed_data?.hashtags) {
        cast.parsed_data.hashtags.forEach(hashtag => {
          hashtagCounts[hashtag] = (hashtagCounts[hashtag] || 0) + 1
        })
      }
    })

    return Object.entries(hashtagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .map(([hashtag, count]) => ({ hashtag, count }))
  }

  /**
   * Analyze top mentions
   */
  private static analyzeTopMentions(casts: SavedCast[]): { mention: string; count: number }[] {
    const mentionCounts: Record<string, number> = {}
    
    casts.forEach(cast => {
      if (cast.parsed_data?.mentions) {
        cast.parsed_data.mentions.forEach(mention => {
          mentionCounts[mention] = (mentionCounts[mention] || 0) + 1
        })
      }
    })

    return Object.entries(mentionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([mention, count]) => ({ mention, count }))
  }

  /**
   * Analyze top domains from URLs
   */
  private static analyzeTopDomains(casts: SavedCast[]): { domain: string; count: number }[] {
    const domainCounts: Record<string, number> = {}
    
    casts.forEach(cast => {
      if (cast.parsed_data?.urls) {
        cast.parsed_data.urls.forEach(url => {
          try {
            const domain = new URL(url).hostname
            domainCounts[domain] = (domainCounts[domain] || 0) + 1
          } catch {
            // Invalid URL, skip
          }
        })
      }
    })

    return Object.entries(domainCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }))
  }

  /**
   * Analyze engagement statistics
   */
  private static analyzeEngagement(casts: SavedCast[]): IntelligenceData['engagementStats'] {
    const totalLikes = casts.reduce((sum, cast) => sum + cast.likes_count, 0)
    const totalReplies = casts.reduce((sum, cast) => sum + cast.replies_count, 0)
    const totalRecasts = casts.reduce((sum, cast) => sum + cast.recasts_count, 0)
    
    // Find highest engagement cast
    let highestEngagement: { cast: SavedCast; totalEngagement: number } | null = null
    casts.forEach(cast => {
      const engagement = cast.likes_count + cast.replies_count + cast.recasts_count
      if (!highestEngagement || engagement > highestEngagement.totalEngagement) {
        highestEngagement = { cast, totalEngagement: engagement }
      }
    })

    return {
      totalLikes,
      totalReplies,
      totalRecasts,
      avgLikes: casts.length > 0 ? Math.round(totalLikes / casts.length) : 0,
      avgReplies: casts.length > 0 ? Math.round(totalReplies / casts.length) : 0,
      avgRecasts: casts.length > 0 ? Math.round(totalRecasts / casts.length) : 0,
      highestEngagement
    }
  }

  /**
   * Analyze saving trends over time
   */
  private static analyzeSavingTrends(casts: SavedCast[]): { date: string; count: number }[] {
    const dateCounts: Record<string, number> = {}
    
    casts.forEach(cast => {
      const date = new Date(cast.created_at).toISOString().split('T')[0]
      dateCounts[date] = (dateCounts[date] || 0) + 1
    })

    return Object.entries(dateCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30) // Last 30 days
      .map(([date, count]) => ({ date, count }))
  }

  /**
   * Analyze word frequency for word cloud
   */
  private static analyzeWordFrequency(casts: SavedCast[]): { word: string; count: number }[] {
    const wordCounts: Record<string, number> = {}
    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
      'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our',
      'you', 'your', 'i', 'me', 'my', 'he', 'him', 'his', 'she', 'her', 'hers'
    ])
    
    casts.forEach(cast => {
      const words = cast.cast_content
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.has(word))
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1
      })
    })

    return Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([word, count]) => ({ word, count }))
  }

  /**
   * Analyze category distribution
   */
  private static analyzeCategoryDistribution(casts: SavedCast[]): { category: string; count: number }[] {
    const categoryCounts: Record<string, number> = {}
    
    casts.forEach(cast => {
      const category = cast.category || 'uncategorized'
      categoryCounts[category] = (categoryCounts[category] || 0) + 1
    })

    return Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([category, count]) => ({ category, count }))
  }

  /**
   * Analyze time patterns
   */
  private static analyzeTimePatterns(casts: SavedCast[]): IntelligenceData['timePatterns'] {
    const hourlyCounts: Record<number, number> = {}
    const dailyCounts: Record<string, number> = {}
    const monthlyCounts: Record<string, number> = {}

    casts.forEach(cast => {
      const date = new Date(cast.cast_timestamp)
      
      // Hourly pattern
      const hour = date.getHours()
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1
      
      // Daily pattern
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
      dailyCounts[dayName] = (dailyCounts[dayName] || 0) + 1
      
      // Monthly pattern
      const monthName = date.toLocaleDateString('en-US', { month: 'long' })
      monthlyCounts[monthName] = (monthlyCounts[monthName] || 0) + 1
    })

    return {
      hourly: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: hourlyCounts[hour] || 0
      })),
      daily: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        .map(day => ({ day, count: dailyCounts[day] || 0 })),
      monthly: ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']
        .map(month => ({ month, count: monthlyCounts[month] || 0 }))
    }
  }

  /**
   * Analyze content characteristics
   */
  private static analyzeContent(casts: SavedCast[]): IntelligenceData['contentAnalysis'] {
    let totalWords = 0
    let urlCount = 0
    let mentionCount = 0
    let hashtagCount = 0
    let longestCast: SavedCast | null = null
    let shortestCast: SavedCast | null = null

    casts.forEach(cast => {
      const wordCount = cast.parsed_data?.word_count || cast.cast_content.split(/\s+/).length
      totalWords += wordCount

      // Track longest and shortest casts
      if (!longestCast || wordCount > (longestCast.parsed_data?.word_count || 0)) {
        longestCast = cast
      }
      if (!shortestCast || wordCount < (shortestCast.parsed_data?.word_count || Infinity)) {
        shortestCast = cast
      }

      // Count URLs, mentions, hashtags
      if (cast.parsed_data?.urls) urlCount += cast.parsed_data.urls.length
      if (cast.parsed_data?.mentions) mentionCount += cast.parsed_data.mentions.length
      if (cast.parsed_data?.hashtags) hashtagCount += cast.parsed_data.hashtags.length
    })

    return {
      avgWordCount: casts.length > 0 ? Math.round(totalWords / casts.length) : 0,
      totalWords,
      urlCount,
      mentionCount,
      hashtagCount,
      longestCast,
      shortestCast
    }
  }

  /**
   * Generate insights and recommendations
   */
  static generateInsights(data: IntelligenceData): string[] {
    const insights: string[] = []

    // Engagement insights
    if (data.engagementStats.avgLikes > 10) {
      insights.push("🔥 You're saving highly engaging content! Your average cast gets " + data.engagementStats.avgLikes + " likes.")
    }

    // Author diversity insights
    if (data.topAuthors.length > 0) {
      const topAuthor = data.topAuthors[0]
      const percentage = Math.round((topAuthor.count / data.totalCasts) * 100)
      if (percentage > 50) {
        insights.push(`📊 ${percentage}% of your saved casts are from @${topAuthor.username}. Consider diversifying your sources!`)
      } else {
        insights.push(`👥 You follow diverse voices! Your top author @${topAuthor.username} represents only ${percentage}% of your saves.`)
      }
    }

    // Content insights
    if (data.contentAnalysis.avgWordCount > 100) {
      insights.push("📖 You prefer long-form content with an average of " + data.contentAnalysis.avgWordCount + " words per cast.")
    } else if (data.contentAnalysis.avgWordCount < 50) {
      insights.push("⚡ You like concise content! Your saved casts average just " + data.contentAnalysis.avgWordCount + " words.")
    }

    // Hashtag insights
    if (data.topHashtags.length > 0) {
      insights.push(`🏷️ Your most saved topic is #${data.topHashtags[0].hashtag} with ${data.topHashtags[0].count} occurrences.`)
    }

    // URL insights
    if (data.contentAnalysis.urlCount > data.totalCasts * 0.5) {
      insights.push("🔗 You're a link collector! Over half your saved casts contain URLs.")
    }

    return insights
  }
}