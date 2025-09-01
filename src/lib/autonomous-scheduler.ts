// src/lib/autonomous-scheduler.ts
// Utility functions for scheduling autonomous casts

export class AutonomousCastScheduler {
  
  // Check if it's a good time to post (avoid spam, respect community hours)
  static isGoodTimeToPost(): boolean {
    const now = new Date()
    const hour = now.getHours() // Use local time instead of UTC
    const dayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday
    
    // Post during active hours (6 AM - 11 PM local time)
    const isActiveHour = hour >= 6 && hour <= 23
    
    // Peak times in local timezone (9-11 AM, 2-5 PM, 7-9 PM local)
    const isPeakTime = (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 17) || (hour >= 19 && hour <= 21)
    
    // Weekdays are generally better, but peak times on weekends are okay
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
    
    // Allow posting during active hours, with preference for peak times and weekdays
    return isActiveHour && (isWeekday || isPeakTime)
  }

  // Calculate posting frequency based on engagement and community activity
  static getRecommendedPostingInterval(): number {
    // Return hours between posts
    const baseInterval = 6 // Every 6 hours as baseline
    const now = new Date()
    const hour = now.getHours() // Use local time
    
    // Post more frequently during peak hours
    if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 17) || (hour >= 19 && hour <= 21)) {
      return 4 // 4 hours during peak times
    }
    
    // Less frequent during off-peak
    if (hour >= 22 || hour <= 6) {
      return 12 // 12 hours during night/early morning
    }
    
    return baseInterval
  }

  // Generate cron schedule for autonomous posting
  static generateCronSchedule(): string {
    // Post 4 times per day at strategic times
    // 9 AM, 2 PM, 7 PM, 11 PM UTC (covers different global timezones)
    return '0 9,14,19,23 * * *' // Every day at 9:00, 14:00, 19:00, 23:00 UTC
  }

  // Get optimal posting times for today
  static getOptimalPostingTimes(): Date[] {
    const now = new Date()
    const times: Date[] = []
    
    // Morning: 9-11 AM UTC
    times.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0))
    times.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30))
    
    // Afternoon: 2-5 PM UTC  
    times.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0))
    times.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 30))
    
    // Evening: 7-9 PM UTC
    times.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0))
    times.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30))
    
    // Late evening: 11 PM UTC (good for US West Coast)
    times.push(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0))
    
    return times.filter(time => time > now) // Only future times
  }

  // Webhook URL for triggering autonomous posts
  static getWebhookUrl(baseUrl: string): string {
    return `${baseUrl}/api/cron/autonomous-cast`
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
      service: 'cron-job.org or EasyCron',
      schedule: this.generateCronSchedule(),
      url: 'https://castkpr.vercel.app/api/cron/autonomous-cast?secret=YOUR_SECRET',
      method: 'GET',
      headers: {
        'User-Agent': 'CastKPR-Cron/1.0'
      },
      description: 'Triggers CastKPR to generate and post autonomous content based on trending topics and saved cast analysis'
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
        'Connect observations about trending topics',
        'Reference patterns observed in saved casts',
        'Provide value through unique AI perspective on content curation'
      ],
      donts: [
        'Simply respond to or quote other casts',
        'Use excessive emojis or markdown formatting',
        'Be promotional about CastKPR features',
        'Post generic motivational content',
        'Spam or post too frequently',
        'Copy other bots or accounts',
        'Generate empty or low-value observations'
      ],
      topics: [
        'Information organization and discovery',
        'Social media behavior and trends',
        'Digital content management',
        'AI and technology insights',
        'Community building observations',
        'Content curation thoughts',
        'Data analysis and patterns',
        'Future of social media',
        'Information consumption habits',
        'General cultural commentary'
      ],
      style: [
        'Thoughtful and observational',
        'Genuine perspective as an AI that helps organize content',
        'Conversational tone, not corporate',
        'Clear and concise language',
        'No emojis or markdown formatting',
        '80-280 characters optimal length',
        'Engaging but not clickbait',
        'Authentic AI voice with unique insights'
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
      /follow me/i,
      /subscribe/i,
      /like and share/i
    ]

    for (const pattern of spamPatterns) {
      if (pattern.test(trimmed)) {
        return { valid: false, reason: 'Contains spam-like patterns' }
      }
    }

    // Check for authenticity (avoid generic content)
    const genericPatterns = [
      /good morning everyone/i,
      /have a great day/i,
      /hope everyone is doing well/i,
      /what do you think/i // This is overused
    ]

    for (const pattern of genericPatterns) {
      if (pattern.test(trimmed)) {
        return { valid: false, reason: 'Content appears generic or overused' }
      }
    }

    return { valid: true }
  }

  // Get engagement metrics for timing decisions
  static getEngagementScore(): number {
    const now = new Date()
    const hour = now.getUTCHours()
    const dayOfWeek = now.getUTCDay()
    
    let score = 0.5 // Base score
    
    // Hour-based scoring
    if (hour >= 9 && hour <= 11) score += 0.3 // Morning peak
    if (hour >= 14 && hour <= 17) score += 0.4 // Afternoon peak  
    if (hour >= 19 && hour <= 21) score += 0.3 // Evening peak
    if (hour >= 6 && hour <= 8) score += 0.1 // Early morning
    if (hour >= 22 && hour <= 23) score += 0.2 // Late evening
    
    // Day-based scoring
    if (dayOfWeek >= 1 && dayOfWeek <= 5) score += 0.2 // Weekdays
    if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) score += 0.1 // Mid-week bonus
    
    return Math.min(score, 1.0) // Cap at 1.0
  }
}
