// src/lib/autonomous-scheduler.ts
// Utility functions for scheduling autonomous casts

export class AutonomousCastScheduler {
  
  // Check if it's a good time to post (avoid spam, respect community hours)
  static isGoodTimeToPost(): boolean {
    const now = new Date()
    const hour = now.getHours() // 0-23
    const dayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday
    
    // Post during active hours (6 AM - 10 PM UTC, weekdays preferred)
    const isActiveHour = hour >= 6 && hour <= 22
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
    
    // Boost score for peak times
    const isPeakTime = (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 17) || (hour >= 19 && hour <= 21)
    
    return isActiveHour && (isWeekday || isPeakTime)
  }

  // Calculate posting frequency based on engagement and community activity
  static getRecommendedPostingInterval(): number {
    // Return hours between posts
    const baseInterval = 6 // Every 6 hours as baseline
    const now = new Date()
    const hour = now.getHours()
    
    // Post more frequently during peak hours
    if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 17) || (hour >= 19 && hour <= 21)) {
      return baseInterval * 0.75 // 4.5 hours during peak
    }
    
    // Less frequent during off-peak
    if (hour >= 22 || hour <= 6) {
      return baseInterval * 2 // 12 hours during night/early morning
    }
    
    return baseInterval
  }

  // Generate cron schedule for autonomous posting
  static generateCronSchedule(): string {
    // Post 3-4 times per day at strategic times
    // 9 AM, 2 PM, 7 PM UTC (adjust for your timezone)
    return '0 9,14,19 * * *' // Every day at 9:00, 14:00, 19:00 UTC
  }

  // Webhook URL for triggering autonomous posts
  static getWebhookUrl(baseUrl: string): string {
    return `${baseUrl}/api/autonomous-cast`
  }

  // Example of how to set up with cron service
  static getCronJobExample(): {
    service: string
    schedule: string
    url: string
    method: string
    headers: Record<string, string>
    description: string
  } {
    return {
      service: 'cron-job.org or similar',
      schedule: this.generateCronSchedule(),
      url: 'https://your-domain.com/api/autonomous-cast',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_AUTONOMOUS_CAST_SECRET',
        'Content-Type': 'application/json'
      },
      description: 'Triggers CastKPR to generate and post autonomous content based on trending casts'
    }
  }

  // Content guidelines for autonomous posts
  static getContentGuidelines(): {
    dos: string[]
    donts: string[]
    topics: string[]
    style: string[]
  } {
    return {
      dos: [
        'Share original insights about content organization and discovery',
        'Offer perspectives on how people manage their digital information', 
        'Comment on social media trends and community behavior',
        'Ask thoughtful questions about information sharing',
        'Be authentic and conversational as an AI helper',
        'Connect observations about trending topics'
      ],
      donts: [
        'Simply respond to or quote other casts',
        'Use excessive emojis or markdown formatting',
        'Be promotional about CastKPR features',
        'Post generic motivational content',
        'Spam or post too frequently',
        'Copy other bots or accounts'
      ],
      topics: [
        'Information organization and discovery',
        'Social media behavior and trends',
        'Digital content management',
        'AI and technology insights',
        'Community building observations',
        'Content curation thoughts',
        'General cultural commentary'
      ],
      style: [
        'Thoughtful and observational',
        'Genuine perspective as an AI that helps organize content',
        'Conversational tone, not corporate',
        'Clear and concise language',
        'No emojis or markdown formatting',
        '80-280 characters optimal length'
      ]
    }
  }

  // Rate limiting to prevent spam
  static shouldPostBasedOnRecentActivity(lastPostTime: Date | null, minIntervalHours: number = 4): boolean {
    if (!lastPostTime) return true
    
    const now = new Date()
    const hoursSinceLastPost = (now.getTime() - lastPostTime.getTime()) / (1000 * 60 * 60)
    
    return hoursSinceLastPost >= minIntervalHours
  }

  // Quality checks for generated content
  static validateContent(content: string): { valid: boolean; reason?: string } {
    if (!content || typeof content !== 'string') {
      return { valid: false, reason: 'Content is empty or not a string' }
    }

    const trimmed = content.trim()
    
    if (trimmed.length < 10) {
      return { valid: false, reason: 'Content too short (minimum 10 characters)' }
    }

    if (trimmed.length > 320) {
      return { valid: false, reason: 'Content too long (maximum 320 characters)' }
    }

    // Check for markdown formatting
    if (trimmed.includes('**') || trimmed.includes('*') || trimmed.includes('#') || trimmed.includes('`')) {
      return { valid: false, reason: 'Contains markdown formatting' }
    }

    // Check for excessive emojis
    const emojiCount = (trimmed.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length
    if (emojiCount > 0) {
      return { valid: false, reason: 'Contains emojis (not allowed)' }
    }

    // Check for spam patterns
    const spamPatterns = [
      /(.)\1{4,}/, // Repeated characters
      /!!!{3,}/, // Excessive exclamation
      /\?\?{3,}/, // Excessive question marks
      /check out/i, // Promotional language
      /click here/i,
      /follow me/i
    ]

    for (const pattern of spamPatterns) {
      if (pattern.test(trimmed)) {
        return { valid: false, reason: 'Contains spam-like patterns' }
      }
    }

    return { valid: true }
  }
}
