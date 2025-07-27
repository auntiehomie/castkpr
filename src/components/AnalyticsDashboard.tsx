'use client'

import { useState, useEffect, useMemo } from 'react'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'

interface AnalyticsDashboardProps {
  userId?: string
}

interface EnhancedParsedData {
  hashtags?: string[]
  urls?: string[]
  mentions?: string[]
  word_count?: number
  topics?: string[]
  ai_category?: string
  ai_tags?: string[]
  // Enhanced analysis fields
  quality_score?: number
  sentiment?: 'positive' | 'negative' | 'neutral'
  sentiment_score?: number
  content_type?: string
  engagement_potential?: 'low' | 'medium' | 'high'
  entities?: {
    people?: string[]
    tokens?: string[]
    projects?: string[]
    companies?: string[]
  }
  confidence_score?: number
  analysis_version?: string
}

interface AnalyticsData {
  totalCasts: number
  enhancedCasts: number
  averageQuality: number
  topTopics: Array<{ topic: string; count: number }>
  sentimentDistribution: { positive: number; negative: number; neutral: number }
  contentTypeDistribution: Record<string, number>
  engagementDistribution: Record<string, number>
  qualityDistribution: { excellent: number; good: number; fair: number; poor: number }
  topTokens: Array<{ token: string; count: number }>
  topProjects: Array<{ project: string; count: number }>
  savingTrends: Array<{ date: string; count: number; avgQuality: number }>
  bestCasts: SavedCast[]
  latestCasts: SavedCast[]
}

function StatCard({ title, value, subtitle, icon, color = 'purple' }: {
  title: string
  value: string | number
  subtitle?: string
  icon: string
  color?: string
}) {
  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-300',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-300',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-300',
    yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-300',
    red: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-300',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-300'
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} backdrop-blur-lg rounded-xl p-6 border`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-sm opacity-80">{title}</div>
        </div>
      </div>
      {subtitle && (
        <div className="text-xs opacity-70 mt-2">{subtitle}</div>
      )}
    </div>
  )
}

function QualityDistributionChart({ data }: { data: { excellent: number; good: number; fair: number; poor: number } }) {
  const total = data.excellent + data.good + data.fair + data.poor
  if (total === 0) return null

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-white">Quality Score Distribution</h4>
      
      {/* Bar Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-green-300">Excellent (80+)</span>
          <span className="text-sm text-white">{data.excellent}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(data.excellent / total) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-yellow-300">Good (60-79)</span>
          <span className="text-sm text-white">{data.good}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(data.good / total) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-orange-300">Fair (40-59)</span>
          <span className="text-sm text-white">{data.fair}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(data.fair / total) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-red-300">Poor (&lt;40)</span>
          <span className="text-sm text-white">{data.poor}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-red-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(data.poor / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function SentimentChart({ data }: { data: { positive: number; negative: number; neutral: number } }) {
  const total = data.positive + data.negative + data.neutral
  if (total === 0) return null

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-white">Sentiment Distribution</h4>
      
      {/* Pie-like representation using bars */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-green-300 flex items-center gap-1">
            😊 Positive
          </span>
          <span className="text-sm text-white">{data.positive} ({Math.round((data.positive / total) * 100)}%)</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div 
            className="bg-green-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${(data.positive / total) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300 flex items-center gap-1">
            😐 Neutral
          </span>
          <span className="text-sm text-white">{data.neutral} ({Math.round((data.neutral / total) * 100)}%)</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div 
            className="bg-gray-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${(data.neutral / total) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-red-300 flex items-center gap-1">
            😞 Negative
          </span>
          <span className="text-sm text-white">{data.negative} ({Math.round((data.negative / total) * 100)}%)</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div 
            className="bg-red-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${(data.negative / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function TopListCard({ title, items, icon, color }: {
  title: string
  items: Array<{ name: string; count: number }>
  icon: string
  color: string
}) {
  if (items.length === 0) return null

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h4>
      <div className="space-y-2">
        {items.slice(0, 10).map((item, index) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm w-6">#{index + 1}</span>
              <span className={`text-${color}-300 text-sm`}>{item.name}</span>
            </div>
            <span className="text-white text-sm font-medium">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CastPreviewCard({ cast }: { cast: SavedCast }) {
  const parsedData = cast.parsed_data as EnhancedParsedData

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-sm text-gray-400">
          @{cast.username}
        </div>
        {parsedData?.quality_score && (
          <div className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
            {parsedData.quality_score}/100
          </div>
        )}
        {parsedData?.sentiment && (
          <div className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            {parsedData.sentiment === 'positive' ? '😊' : parsedData.sentiment === 'negative' ? '😞' : '😐'}
          </div>
        )}
      </div>
      <p className="text-white text-sm line-clamp-2 mb-2">
        {cast.cast_content}
      </p>
      <div className="text-xs text-gray-500">
        {formatDistanceToNow(new Date(cast.cast_timestamp), { addSuffix: true })}
      </div>
    </div>
  )
}

export default function AnalyticsDashboard({ userId = 'demo-user' }: AnalyticsDashboardProps) {
  const [casts, setCasts] = useState<SavedCast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const savedCasts = await CastService.getUserCasts(userId, 200) // Get more for better analytics
        setCasts(savedCasts)
      } catch (err) {
        console.error('Error fetching analytics data:', err)
        setError('Failed to load analytics data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId])

  const analyticsData: AnalyticsData = useMemo(() => {
    if (casts.length === 0) {
      return {
        totalCasts: 0,
        enhancedCasts: 0,
        averageQuality: 0,
        topTopics: [],
        sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
        contentTypeDistribution: {},
        engagementDistribution: {},
        qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        topTokens: [],
        topProjects: [],
        savingTrends: [],
        bestCasts: [],
        latestCasts: []
      }
    }

    // Enhanced casts with analysis data
    const enhancedCasts = casts.filter(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      return parsedData?.quality_score !== undefined
    })

    // Average quality score
    const averageQuality = enhancedCasts.length > 0
      ? enhancedCasts.reduce((sum, cast) => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          return sum + (parsedData.quality_score || 0)
        }, 0) / enhancedCasts.length
      : 0

    // Top topics
    const topicCounts = new Map<string, number>()
    casts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const topics = [
        ...(parsedData?.topics || []),
        ...(parsedData?.hashtags || [])
      ]
      topics.forEach(topic => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
      })
    })

    const topTopics = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)

    // Sentiment distribution
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const sentiment = parsedData.sentiment || 'neutral'
      sentimentCounts[sentiment]++
    })

    // Content type distribution
    const contentTypeCounts: Record<string, number> = {}
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const contentType = parsedData.content_type || 'unknown'
      contentTypeCounts[contentType] = (contentTypeCounts[contentType] || 0) + 1
    })

    // Engagement distribution
    const engagementCounts: Record<string, number> = {}
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const engagement = parsedData.engagement_potential || 'unknown'
      engagementCounts[engagement] = (engagementCounts[engagement] || 0) + 1
    })

    // Quality distribution
    const qualityDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 }
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const quality = parsedData.quality_score || 0
      if (quality >= 80) qualityDistribution.excellent++
      else if (quality >= 60) qualityDistribution.good++
      else if (quality >= 40) qualityDistribution.fair++
      else qualityDistribution.poor++
    })

    // Top tokens
    const tokenCounts = new Map<string, number>()
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const tokens = parsedData?.entities?.tokens || []
      tokens.forEach(token => {
        tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1)
      })
    })

    const topTokens = Array.from(tokenCounts.entries())
      .map(([token, count]) => ({ token, count }))
      .sort((a, b) => b.count - a.count)

    // Top projects
    const projectCounts = new Map<string, number>()
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const projects = parsedData?.entities?.projects || []
      projects.forEach(project => {
        projectCounts.set(project, (projectCounts.get(project) || 0) + 1)
      })
    })

    const topProjects = Array.from(projectCounts.entries())
      .map(([project, count]) => ({ project, count }))
      .sort((a, b) => b.count - a.count)

    // Best casts (highest quality)
    const bestCasts = enhancedCasts
      .sort((a, b) => {
        const aQuality = (a.parsed_data as EnhancedParsedData)?.quality_score || 0
        const bQuality = (b.parsed_data as EnhancedParsedData)?.quality_score || 0
        return bQuality - aQuality
      })
      .slice(0, 5)

    // Latest casts
    const latestCasts = casts
      .sort((a, b) => new Date(b.cast_timestamp).getTime() - new Date(a.cast_timestamp).getTime())
      .slice(0, 5)

    // Saving trends (simplified)
    const savingTrends: Array<{ date: string; count: number; avgQuality: number }> = []
    // This would typically be calculated from actual date ranges
    // For now, we'll create a simple representation

    return {
      totalCasts: casts.length,
      enhancedCasts: enhancedCasts.length,
      averageQuality: Math.round(averageQuality),
      topTopics,
      sentimentDistribution: sentimentCounts,
      contentTypeDistribution: contentTypeCounts,
      engagementDistribution: engagementCounts,
      qualityDistribution,
      topTokens,
      topProjects,
      savingTrends,
      bestCasts,
      latestCasts
    }
  }, [casts])

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-600 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 bg-gray-600 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-64 bg-gray-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="text-center">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-white mb-2">Analytics Error</h3>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (analyticsData.totalCasts === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Analytics Data Yet</h3>
          <p className="text-gray-400 mb-6">
            Start saving casts to see your personalized analytics dashboard
          </p>
          <div className="bg-white/5 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-semibold text-white mb-2">Get started:</h4>
            <ol className="text-sm text-gray-300 text-left space-y-1">
              <li>1. Reply "@cstkpr save this" to casts on Farcaster</li>
              <li>2. Use "@cstkpr analyze this" for enhanced insights</li>
              <li>3. Return here to see your analytics!</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-2">📊 Your Cast Analytics</h2>
        <p className="text-gray-300">
          Insights from your {analyticsData.totalCasts} saved casts
          {analyticsData.enhancedCasts > 0 && ` • ${analyticsData.enhancedCasts} with enhanced analysis`}
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Saved"
          value={analyticsData.totalCasts}
          subtitle="All saved casts"
          icon="📝"
          color="purple"
        />
        <StatCard
          title="Enhanced"
          value={analyticsData.enhancedCasts}
          subtitle="With AI analysis"
          icon="🧠"
          color="blue"
        />
        <StatCard
          title="Avg Quality"
          value={`${analyticsData.averageQuality}/100`}
          subtitle={analyticsData.averageQuality >= 80 ? 'Excellent!' : analyticsData.averageQuality >= 60 ? 'Good' : 'Keep improving'}
          icon="⭐"
          color={analyticsData.averageQuality >= 80 ? 'green' : analyticsData.averageQuality >= 60 ? 'yellow' : 'red'}
        />
        <StatCard
          title="Positive"
          value={analyticsData.sentimentDistribution.positive}
          subtitle="Positive sentiment casts"
          icon="😊"
          color="green"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quality Distribution */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <QualityDistributionChart data={analyticsData.qualityDistribution} />
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <SentimentChart data={analyticsData.sentimentDistribution} />
        </div>
      </div>

      {/* Top Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <TopListCard
          title="Top Topics"
          items={analyticsData.topTopics.map(t => ({ name: t.topic, count: t.count }))}
          icon="🏷️"
          color="purple"
        />
        
        {analyticsData.topTokens.length > 0 && (
          <TopListCard
            title="Top Tokens"
            items={analyticsData.topTokens.map(t => ({ name: `$${t.token}`, count: t.count }))}
            icon="🪙"
            color="yellow"
          />
        )}
        
        {analyticsData.topProjects.length > 0 && (
          <TopListCard
            title="Top Projects"
            items={analyticsData.topProjects.map(p => ({ name: p.project, count: p.count }))}
            icon="🚀"
            color="green"
          />
        )}
      </div>

      {/* Best and Latest Casts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Best Quality Casts */}
        {analyticsData.bestCasts.length > 0 && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span>🏆</span>
              Your Highest Quality Casts
            </h4>
            <div className="space-y-3">
              {analyticsData.bestCasts.map(cast => (
                <CastPreviewCard key={cast.id} cast={cast} />
              ))}
            </div>
          </div>
        )}

        {/* Latest Casts */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
            <span>🕒</span>
            Recently Saved
          </h4>
          <div className="space-y-3">
            {analyticsData.latestCasts.map(cast => (
              <CastPreviewCard key={cast.id} cast={cast} />
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-green-500/10 to-teal-500/10 backdrop-blur-lg rounded-xl p-6 border border-green-500/20">
        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
          <span>💡</span>
          AI-Generated Insights
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="font-medium text-green-300 mb-2">Content Patterns</h5>
            <ul className="space-y-1 text-gray-300">
              {analyticsData.averageQuality >= 80 && (
                <li>• You consistently save high-quality content</li>
              )}
              {analyticsData.sentimentDistribution.positive > analyticsData.sentimentDistribution.negative && (
                <li>• You tend to save positive, optimistic content</li>
              )}
              {analyticsData.topTopics.length > 0 && (
                <li>• Your main interests include {analyticsData.topTopics.slice(0, 3).map(t => t.topic).join(', ')}</li>
              )}
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-green-300 mb-2">Recommendations</h5>
            <ul className="space-y-1 text-gray-300">
              {analyticsData.averageQuality < 60 && (
                <li>• Try analyzing casts with "@cstkpr quality score" before saving</li>
              )}
              {analyticsData.enhancedCasts < analyticsData.totalCasts * 0.3 && (
                <li>• Use enhanced analysis for better insights</li>
              )}
              <li>• Consider adding personal notes to your saved casts</li>
              <li>• Use tags to better organize your collection</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}