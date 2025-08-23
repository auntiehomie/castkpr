/**
 * Example usage of Neynar User Quality Score integration in CastKPR
 * 
 * This file demonstrates how to use the enhanced user quality analysis
 * features based on Neynar's user quality scores.
 */

import { CastService, NeynarQualityService, CstkprIntelligenceService } from './supabase'
import type { SavedCast } from './supabase'

// Example 1: Filter casts by user quality
export async function getHighQualityCasts(): Promise<SavedCast[]> {
  // Get all recent casts
  const allCasts = await CastService.getAllRecentCasts(100)
  
  // Filter for high-quality users only (score >= 0.7, top ~27.5k accounts)
  const highQualityCasts = NeynarQualityService.filterByQuality(
    allCasts,
    0.7, // Minimum Neynar score
    ['high'] // Only high-quality tiers
  )
  
  console.log(`📊 Filtered from ${allCasts.length} to ${highQualityCasts.length} high-quality casts`)
  return highQualityCasts
}

// Example 2: Get quality statistics for your saved casts
export async function analyzeCastQualityStats(): Promise<void> {
  const allCasts = await CastService.getAllRecentCasts(200)
  const stats = NeynarQualityService.getQualityStats(allCasts)
  
  console.log('📈 Cast Quality Statistics:')
  console.log(`Total casts: ${stats.totalCasts}`)
  console.log(`Casts with Neynar scores: ${stats.withScores}`)
  console.log(`Average Neynar score: ${stats.averageScore.toFixed(3)}`)
  console.log(`High-quality percentage: ${stats.highQualityPercentage.toFixed(1)}%`)
  console.log('Quality distribution:', stats.qualityDistribution)
}

// Example 3: Find high-quality conversations by topic
export async function findBestConversations(): Promise<void> {
  const allCasts = await CastService.getAllRecentCasts(500)
  
  const conversations = NeynarQualityService.findHighQualityConversations(
    allCasts,
    3, // Minimum 3 participants
    0.6 // Minimum average Neynar score of 0.6
  )
  
  console.log(`🗣️ Found ${conversations.length} high-quality conversations:`)
  conversations.slice(0, 5).forEach((conv, index) => {
    console.log(`${index + 1}. Topic: ${conv.topic}`)
    console.log(`   Average score: ${conv.averageScore.toFixed(3)}`)
    console.log(`   Participants: ${conv.participants}`)
    console.log(`   Casts: ${conv.casts.length}`)
    console.log()
  })
}

// Example 4: Get personalized quality threshold recommendations
export async function getRecommendedQualityThreshold(): Promise<void> {
  const allCasts = await CastService.getAllRecentCasts(300)
  const recommendation = NeynarQualityService.getRecommendedThreshold(allCasts)
  
  console.log('🎯 Quality Threshold Recommendation:')
  console.log(`Recommended threshold: ${recommendation.threshold}`)
  console.log(`Expected filter rate: ${recommendation.expectedFilterRate.toFixed(1)}%`)
  console.log(`Rationale: ${recommendation.rationale}`)
}

// Example 5: Enhanced @cstkpr opinion with user quality context
export async function generateQualityAwareOpinion(
  castContent: string,
  castAuthor: string,
  userNeynarScore: number
): Promise<void> {
  // Extract topics
  const topics = CstkprIntelligenceService.extractCastTopics(castContent)
  
  // Generate user quality insight
  const qualityTier = userNeynarScore >= 0.9 ? 'high' :
                     userNeynarScore >= 0.7 ? 'high' :
                     userNeynarScore >= 0.5 ? 'medium' : 'low'
  
  const userQualityInsight = CstkprIntelligenceService.analyzeUserQualityForOpinion(
    userNeynarScore,
    qualityTier,
    castAuthor
  )
  
  // Get related casts
  let relatedCasts: SavedCast[] = []
  if (topics.length > 0) {
    for (const topic of topics.slice(0, 2)) {
      try {
        const topicCasts = await CastService.getCastsByTopic(topic, 3)
        relatedCasts.push(...topicCasts)
      } catch (error) {
        // Topic not found, continue
      }
    }
  }
  
  // Generate opinion with quality context
  const opinion = await CstkprIntelligenceService.generateOpinion(
    castContent,
    castAuthor,
    topics,
    relatedCasts,
    null, // No web research
    userQualityInsight
  )
  
  console.log('🧠 Quality-Enhanced Opinion:')
  console.log(opinion.text)
  console.log(`\n📊 Confidence: ${Math.round(opinion.confidence * 100)}%`)
  console.log(`🎭 Tone: ${opinion.tone}`)
}

// Example 6: Rank casts by author quality
export async function getRankedCastsByQuality(): Promise<SavedCast[]> {
  const allCasts = await CastService.getAllRecentCasts(50)
  const rankedCasts = NeynarQualityService.rankByQuality(allCasts)
  
  console.log('🏆 Top 10 casts by author quality:')
  rankedCasts.slice(0, 10).forEach((cast, index) => {
    const score = cast.neynar_user_score?.toFixed(3) || 'N/A'
    const tier = cast.user_quality_tier || 'unknown'
    console.log(`${index + 1}. @${cast.username} (Score: ${score}, Tier: ${tier})`)
    console.log(`   Cast: ${cast.cast_content.substring(0, 80)}...`)
    console.log()
  })
  
  return rankedCasts
}

// Example usage function (you can run this to test)
export async function runQualityAnalysisExamples(): Promise<void> {
  console.log('🚀 Running Neynar Quality Analysis Examples...\n')
  
  try {
    console.log('1️⃣ Getting high-quality casts...')
    await getHighQualityCasts()
    console.log()
    
    console.log('2️⃣ Analyzing quality statistics...')
    await analyzeCastQualityStats()
    console.log()
    
    console.log('3️⃣ Finding best conversations...')
    await findBestConversations()
    console.log()
    
    console.log('4️⃣ Getting quality threshold recommendation...')
    await getRecommendedQualityThreshold()
    console.log()
    
    console.log('5️⃣ Generating quality-aware opinion...')
    await generateQualityAwareOpinion(
      'AI agents are becoming more sophisticated. What do you think about the future of AI in social networks?',
      'testuser',
      0.82 // High-quality user score
    )
    console.log()
    
    console.log('6️⃣ Ranking casts by quality...')
    await getRankedCastsByQuality()
    console.log()
    
    console.log('✅ All examples completed successfully!')
    
  } catch (error) {
    console.error('❌ Error running examples:', error)
  }
}

// Quality thresholds reference
export const NEYNAR_QUALITY_THRESHOLDS = {
  PREMIUM: 0.9,      // Top ~2.5k accounts (exceptional quality)
  HIGH: 0.7,         // Top ~27.5k accounts (high quality)  
  RECOMMENDED: 0.5,  // Recommended starting threshold
  MODERATE: 0.3,     // Below average but acceptable
  LOW: 0.1,         // Minimum threshold for basic filtering
  
  // Tier definitions
  TIERS: {
    HIGH: 'Users with consistent high-quality contributions',
    MEDIUM: 'Users meeting baseline quality standards', 
    LOW: 'Users with limited or low-value activity',
    UNKNOWN: 'Users without sufficient data for scoring'
  },
  
  // Use case recommendations
  USE_CASES: {
    PREMIUM_CONTENT: 0.9,        // Only the highest quality authors
    CURATED_FEEDS: 0.7,          // Well-curated content experience
    SPAM_FILTERING: 0.5,         // General spam and low-quality filtering
    INCLUSIVE_FILTERING: 0.3,    // Light filtering while staying inclusive
    RESEARCH_ANALYSIS: 0.7,      // For analyzing high-quality discussions
    AI_TRAINING_DATA: 0.8,       // High-quality data for AI training
    TRENDING_ALGORITHMS: 0.6,    // Quality boost for trending content
    RECOMMENDATION_SYSTEMS: 0.5   // Balance quality and diversity
  }
}
