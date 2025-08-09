'use client'

import { useState, useEffect } from 'react'
import { CastIntelligence } from '@/lib/intelligence'
import type { TrendingTopic } from '@/lib/intelligence'

interface IntelligenceDashboardProps {
  userId?: string
}

export default function IntelligenceDashboard({ userId = 'demo-user' }: IntelligenceDashboardProps) {
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])
  const [userRecommendations, setUserRecommendations] = useState<{
    topics: string[]
    similar_users: string[]
    recommended_hashtags: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trending' | 'personal' | 'analysis'>('trending')

  useEffect(() => {
    loadIntelligenceData()
  }, [userId])

  const loadIntelligenceData = async () => {
    try {
      setLoading(true)
      
      const [trending, recommendations] = await Promise.all([
        CastIntelligence.getTrendingTopics('week'),
        CastIntelligence.getPersonalizedRecommendations(userId)
      ])
      
      setTrendingTopics(trending)
      setUserRecommendations(recommendations)
    } catch (error) {
      console.error('Error loading intelligence data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-600 rounded w-48 mb-6"></div>
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-20 bg-gray-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          🧠 CastKPR Intelligence
        </h2>
        <div className="text-sm text-gray-400">
          Learning from community saves
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-white/10 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('trending')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'trending'
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          🔥 Trending
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'personal'
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          🎯 Personal
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'analysis'
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          📊 Analysis
        </button>
      </div>

      {/* Trending Tab */}
      {activeTab === 'trending' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            📈 What's Hot This Week
          </h3>
          
          {trendingTopics.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-gray-400">
                Not enough data yet. Save more casts to see trending topics!
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {trendingTopics.slice(0, 8).map((topic, index) => (
                <div 
                  key={topic.topic}
                  className="bg-white/10 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-500/20 text-purple-300 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-white font-medium">#{topic.topic}</h4>
                      <p className="text-sm text-gray-400">
                        {topic.save_count} saves • {topic.engagement_avg.toFixed(0)} avg engagement
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 text-sm font-medium">
                      +{topic.recent_growth}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Personal Tab */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            🎯 Your Personalized Insights
          </h3>
          
          {!userRecommendations || userRecommendations.topics.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🤖</div>
              <p className="text-gray-400">
                I'm still learning your preferences. Save more casts to get personalized recommendations!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Your Interests */}
              <div className="bg-white/10 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  🏷️ Your Top Interests
                </h4>
                <div className="flex flex-wrap gap-2">
                  {userRecommendations.topics.map(topic => (
                    <span 
                      key={topic}
                      className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Recommended Hashtags */}
              {userRecommendations.recommended_hashtags.length > 0 && (
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    🔍 Recommended Hashtags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userRecommendations.recommended_hashtags.map(hashtag => (
                      <span 
                        key={hashtag}
                        className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm"
                      >
                        #{hashtag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar Users */}
              {userRecommendations.similar_users.length > 0 && (
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    👥 Users with Similar Taste
                  </h4>
                  <div className="space-y-2">
                    {userRecommendations.similar_users.map(user => (
                      <div key={user} className="text-gray-300">
                        @{user}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            📊 How CastKPR Learns
          </h3>
          
          <div className="space-y-4">
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">🎯 Quality Scoring</h4>
              <p className="text-gray-300 text-sm">
                I analyze saved casts to identify patterns: content length, engagement rates, 
                topic relevance, and similarity to previously saved high-quality content.
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">📈 Trending Detection</h4>
              <p className="text-gray-300 text-sm">
                I track which topics and hashtags are being saved most frequently over time 
                to identify emerging trends in the community.
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">🤝 Collaborative Filtering</h4>
              <p className="text-gray-300 text-sm">
                I find users with similar saving patterns to yours and recommend content 
                based on what they're finding valuable.
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">🧠 Continuous Learning</h4>
              <p className="text-gray-300 text-sm">
                Every cast you save teaches me more about quality content and helps me 
                give better opinions and recommendations to the entire community.
              </p>
            </div>
          </div>

          {/* Bot Interaction Stats */}
          <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg p-4 border border-purple-500/30">
            <h4 className="text-white font-medium mb-2">🤖 Ask CastKPR</h4>
            <p className="text-gray-300 text-sm mb-3">
              Tag me in any cast with these commands to see my intelligence in action:
            </p>
            <div className="space-y-1 text-sm">
              <div className="text-gray-300">• <code className="bg-black/30 px-1 rounded">@cstkpr opinion</code> - Get my thoughts on a cast</div>
              <div className="text-gray-300">• <code className="bg-black/30 px-1 rounded">@cstkpr trending</code> - See what's hot</div>
              <div className="text-gray-300">• <code className="bg-black/30 px-1 rounded">@cstkpr recommend</code> - Get suggestions</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}