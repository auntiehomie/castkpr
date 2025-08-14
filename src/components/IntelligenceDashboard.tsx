'use client'

import { useState, useEffect } from 'react'
import { CastService } from '@/lib/supabase'
import { IntelligenceService } from '@/lib/intelligence'
import type { IntelligenceData } from '@/lib/intelligence'

interface IntelligenceDashboardProps {
  userId?: string
}

export default function IntelligenceDashboard({ userId = 'demo-user' }: IntelligenceDashboardProps) {
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [insights, setInsights] = useState<string[]>([])

  useEffect(() => {
    async function fetchIntelligence() {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch all casts for analysis
        const casts = await CastService.getUserCasts(userId, 1000)
        
        // Process intelligence data using service
        const intelligenceData = IntelligenceService.processIntelligenceData(casts)
        setIntelligence(intelligenceData)
        
        // Generate insights
        const generatedInsights = IntelligenceService.generateInsights(intelligenceData)
        setInsights(generatedInsights)
        
      } catch (err) {
        console.error('Error fetching intelligence data:', err)
        setError('Failed to load intelligence data')
      } finally {
        setLoading(false)
      }
    }

    fetchIntelligence()
  }, [userId])

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white">Analyzing your saved casts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="text-center">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-white mb-2">Something went wrong</h3>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!intelligence) return null

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="text-3xl mb-2">📊</div>
          <div className="text-2xl font-bold text-white">{intelligence.totalCasts}</div>
          <div className="text-sm text-gray-300">Total Saved Casts</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="text-3xl mb-2">❤️</div>
          <div className="text-2xl font-bold text-white">{intelligence.engagementStats.totalLikes}</div>
          <div className="text-sm text-gray-300">Total Likes</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="text-3xl mb-2">💬</div>
          <div className="text-2xl font-bold text-white">{intelligence.engagementStats.totalReplies}</div>
          <div className="text-sm text-gray-300">Total Replies</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="text-3xl mb-2">🔄</div>
          <div className="text-2xl font-bold text-white">{intelligence.engagementStats.totalRecasts}</div>
          <div className="text-sm text-gray-300">Total Recasts</div>
        </div>
      </div>

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-6 border border-purple-400/30">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🧠 AI Insights
          </h2>
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="bg-white/10 rounded-lg p-3 text-gray-100">
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Authors */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">👥 Top Authors</h2>
          <div className="space-y-3">
            {intelligence.topAuthors.slice(0, 5).map((author, index) => (
              <div key={author.username} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <span className="text-white">@{author.username}</span>
                    {author.displayName && (
                      <div className="text-xs text-gray-400">{author.displayName}</div>
                    )}
                  </div>
                </div>
                <span className="text-gray-300">{author.count} casts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Hashtags */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">🏷️ Top Hashtags</h2>
          <div className="flex flex-wrap gap-2">
            {intelligence.topHashtags.slice(0, 10).map((hashtag) => (
              <span 
                key={hashtag.hashtag}
                className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm"
              >
                #{hashtag.hashtag} ({hashtag.count})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Word Cloud */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">💭 Most Common Words</h2>
        <div className="flex flex-wrap gap-3">
          {intelligence.wordCloudData.slice(0, 20).map((word) => (
            <span 
              key={word.word}
              className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm"
              style={{ 
                fontSize: `${Math.max(12, Math.min(24, 12 + (word.count / Math.max(...intelligence.wordCloudData.map(w => w.count))) * 12))}px` 
              }}
            >
              {word.word} ({word.count})
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}