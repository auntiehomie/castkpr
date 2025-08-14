export class CastIntelligence {
  static async getTrendingTopics(period: 'day' | 'week' | 'month' = 'week'): Promise<{ topic: string; count: number }[]> {
    // Mock data for testing
    return [
      { topic: 'ai', count: 15 },
      { topic: 'crypto', count: 12 },
      { topic: 'farcaster', count: 10 },
      { topic: 'web3', count: 8 },
      { topic: 'miniapps', count: 6 }
    ]
  }
}