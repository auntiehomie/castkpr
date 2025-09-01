'use client'

import { useState, useEffect, useMemo } from 'react'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'

interface CombinedAnalyticsProps {
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
  engagement_potential?: 'low' | 'medium' | 'high' | 'very-high'
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

function MCPInsightsSection({ userId, savedCasts }: { userId: string; savedCasts: SavedCast[] }) {
  const [activeTab, setActiveTab] = useState<'analyze' | 'compare' | 'opinion' | 'bulk'>('analyze')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  // Form states
  const [selectedCast, setSelectedCast] = useState('')
  const [selectedCast1, setSelectedCast1] = useState('')
  const [selectedCast2, setSelectedCast2] = useState('')
  const [perspective, setPerspective] = useState('general')

  // Get cast options for dropdowns
  const castOptions = savedCasts.slice(0, 50).map(cast => ({
    value: cast.cast_hash,
    label: `@${cast.username}: ${cast.cast_content.slice(0, 60)}${cast.cast_content.length > 60 ? '...' : ''}`,
    fullContent: cast.cast_content,
    username: cast.username,
    timestamp: cast.cast_timestamp
  }))

  const analyzeCast = async () => {
    if (!selectedCast) return
    
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/mcp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cast_hash: selectedCast, user_id: userId })
      })
      
      const data = await response.json()
      setResult(data.success ? data.analysis : { error: data.error })
    } catch (error) {
      setResult({ error: 'Failed to analyze cast' })
    } finally {
      setLoading(false)
    }
  }

  const compareCasts = async () => {
    if (!selectedCast1 || !selectedCast2) return
    
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/mcp/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cast_hash_1: selectedCast1, 
          cast_hash_2: selectedCast2,
          user_id: userId 
        })
      })
      
      const data = await response.json()
      setResult(data.success ? data.comparison : { error: data.error })
    } catch (error) {
      setResult({ error: 'Failed to compare casts' })
    } finally {
      setLoading(false)
    }
  }

  const getOpinion = async () => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/mcp/opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: perspective,
          user_id: userId 
        })
      })
      
      const data = await response.json()
      setResult(data.success ? data.opinion : { error: data.error })
    } catch (error) {
      setResult({ error: 'Failed to get opinion' })
    } finally {
      setLoading(false)
    }
  }

  // Bulk analyze all saved casts
  const analyzeAllCasts = async () => {
    if (savedCasts.length === 0) return
    
    setLoading(true)
    setResult(null)
    try {
      const results = []
      // Analyze up to 10 recent casts to avoid overwhelming the API
      const castsToAnalyze = savedCasts.slice(0, 10)
      
      for (const cast of castsToAnalyze) {
        try {
          const response = await fetch('/api/mcp/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cast_hash: cast.cast_hash, user_id: userId })
          })
          
          const data = await response.json()
          if (data.success) {
            results.push({
              cast: cast,
              analysis: data.analysis
            })
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error('Error analyzing cast:', cast.cast_hash, error)
        }
      }
      
      setResult({ bulk_analysis: results, total_analyzed: results.length })
    } catch (error) {
      setResult({ error: 'Failed to analyze casts' })
    } finally {
      setLoading(false)
    }
  }

  if (savedCasts.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h3 className="text-xl font-bold text-white mb-4">🤖 MCP-Powered Insights</h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📊</div>
          <h4 className="text-lg font-semibold text-white mb-2">No Saved Casts</h4>
          <p className="text-gray-400">
            Save some casts first to use MCP insights and analysis tools
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <h3 className="text-xl font-bold text-white mb-6">🤖 MCP-Powered Insights</h3>
      
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-black/20 rounded-lg p-1">
        {[
          { id: 'analyze', label: 'Analyze Cast', icon: '🔍' },
          { id: 'compare', label: 'Compare Casts', icon: '⚖️' },
          { id: 'bulk', label: 'Bulk Analysis', icon: '📊' },
          { id: 'opinion', label: 'Get Opinion', icon: '💭' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 px-3 rounded-md transition-colors text-sm font-medium ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'analyze' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Select Cast to Analyze
              </label>
              <select
                value={selectedCast}
                onChange={(e) => setSelectedCast(e.target.value)}
                className="w-full p-3 bg-black/30 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Choose a saved cast...</option>
                {castOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={analyzeCast}
              disabled={loading || !selectedCast}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-600 hover:to-purple-700 transition-all"
            >
              {loading ? '🔄 Analyzing...' : '🔍 Analyze Selected Cast'}
            </button>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                First Cast to Compare
              </label>
              <select
                value={selectedCast1}
                onChange={(e) => setSelectedCast1(e.target.value)}
                className="w-full p-3 bg-black/30 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Choose first cast...</option>
                {castOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Second Cast to Compare
              </label>
              <select
                value={selectedCast2}
                onChange={(e) => setSelectedCast2(e.target.value)}
                className="w-full p-3 bg-black/30 border border-gray-600 rounded-md text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">Choose second cast...</option>
                {castOptions.filter(option => option.value !== selectedCast1).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={compareCasts}
              disabled={loading || !selectedCast1 || !selectedCast2}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              {loading ? '🔄 Comparing...' : '⚖️ Compare Selected Casts'}
            </button>
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 className="font-semibold text-white mb-2">📊 Bulk Analysis</h4>
              <p className="text-gray-300 text-sm mb-4">
                Analyze your top {Math.min(savedCasts.length, 10)} saved casts using MCP-powered insights. 
                This will provide comprehensive analysis for each cast.
              </p>
              <div className="text-xs text-gray-400">
                • Analyzes up to 10 most recent casts<br/>
                • Each analysis includes content insights, sentiment, and topics<br/>
                • Results are processed individually with rate limiting
              </div>
            </div>
            <button
              onClick={analyzeAllCasts}
              disabled={loading || savedCasts.length === 0}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-green-700 transition-all"
            >
              {loading ? '🔄 Analyzing All Casts...' : `📊 Analyze Top ${Math.min(savedCasts.length, 10)} Casts`}
            </button>
          </div>
        )}

        {activeTab === 'opinion' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Topic or Perspective
              </label>
              <input
                type="text"
                value={perspective}
                onChange={(e) => setPerspective(e.target.value)}
                placeholder="What topic would you like an opinion on?"
                className="w-full p-3 bg-black/30 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <button
              onClick={getOpinion}
              disabled={loading || !perspective}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-green-700 transition-all"
            >
              {loading ? '🔄 Thinking...' : '💭 Get Opinion'}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="mt-6">
          {result.error ? (
            <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/30">
              <div className="text-red-400">
                ❌ Error: {result.error}
              </div>
            </div>
          ) : result.bulk_analysis ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                <h4 className="text-lg font-semibold text-white mb-2">
                  📊 Bulk Analysis Results
                </h4>
                <p className="text-green-300 text-sm">
                  Successfully analyzed {result.total_analyzed} of your saved casts
                </p>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {result.bulk_analysis.map((item: any, index: number) => (
                  <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-sm text-gray-400 flex-shrink-0">
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-purple-300 font-medium">
                          @{item.cast.username}
                        </div>
                        <div className="text-sm text-gray-300 line-clamp-2">
                          {item.cast.cast_content}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-200 bg-black/30 rounded p-3 whitespace-pre-wrap">
                      {typeof item.analysis === 'string' ? item.analysis : JSON.stringify(item.analysis, null, 2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-black/40 rounded-lg border border-gray-600">
              <h4 className="text-lg font-semibold text-white mb-3">
                🔍 Analysis Results
              </h4>
              <div className="text-gray-200 bg-black/30 rounded p-3 whitespace-pre-wrap text-sm">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CombinedAnalytics({ userId = 'demo-user' }: CombinedAnalyticsProps) {
  const [savedCasts, setSavedCasts] = useState<SavedCast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'insights'>('overview')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const savedCasts = await CastService.getUserCasts(userId, 200) // Get more for better analytics
        setSavedCasts(savedCasts)
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
    if (!savedCasts.length) {
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
    const enhancedCasts = savedCasts.filter(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      return parsedData?.quality_score !== undefined
    })

    // Calculate average quality
    const qualityScores = enhancedCasts.map(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      return parsedData.quality_score || 0
    })
    const averageQuality = qualityScores.length > 0 
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length 
      : 0

    // Topic analysis
    const topicCounts = new Map<string, number>()
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const topics = parsedData?.topics || []
      topics.forEach(topic => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
      })
    })

    const topTopics = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)

    // Sentiment analysis
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const sentiment = parsedData?.sentiment || 'neutral'
      sentimentCounts[sentiment]++
    })

    // Content type analysis
    const contentTypeCounts: Record<string, number> = {}
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const contentType = parsedData?.content_type || 'unknown'
      contentTypeCounts[contentType] = (contentTypeCounts[contentType] || 0) + 1
    })

    // Engagement analysis
    const engagementCounts: Record<string, number> = {}
    enhancedCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const engagement = parsedData?.engagement_potential || 'unknown'
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
    const latestCasts = savedCasts
      .sort((a, b) => new Date(b.cast_timestamp).getTime() - new Date(a.cast_timestamp).getTime())
      .slice(0, 5)

    // Saving trends (simplified)
    const savingTrends: Array<{ date: string; count: number; avgQuality: number }> = []

    return {
      totalCasts: savedCasts.length,
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
  }, [savedCasts])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/20 backdrop-blur-lg rounded-xl p-6 border border-red-500/30">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white mb-2">Analytics Error</h3>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
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
              <li>1. Reply "@@cstkpr save this" to casts on Farcaster</li>
              <li>2. Use "@@cstkpr analyze this" for enhanced insights</li>
              <li>3. Return here to see your analytics!</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">📊 Analytics</h1>
        
        {/* Section Toggle */}
        <div className="flex space-x-1 bg-black/20 rounded-lg p-1">
          <button
            onClick={() => setActiveSection('overview')}
            className={`py-2 px-4 rounded-md transition-colors text-sm font-medium ${
              activeSection === 'overview'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            📈 Overview
          </button>
          <button
            onClick={() => setActiveSection('insights')}
            className={`py-2 px-4 rounded-md transition-colors text-sm font-medium ${
              activeSection === 'insights'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            🤖 MCP Insights
          </button>
        </div>
      </div>

      {activeSection === 'overview' && (
        <>
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
        </>
      )}

      {activeSection === 'insights' && (
        <MCPInsightsSection userId={userId} savedCasts={savedCasts} />
      )}
    </div>
  )
}
