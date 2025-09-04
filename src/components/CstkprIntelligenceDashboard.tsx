'use client'
import React, { useState, useEffect } from 'react'
import { CstkprIntelligenceService } from '@/lib/supabase'
import type { CstkprOpinion } from '@/lib/supabase'

interface OpinionStats {
  totalOpinions: number
  averageConfidence: number
  topTopics: string[]
  toneDistribution: Record<string, number>
  recentActivity: string
}

interface CstkprIntelligenceDashboardProps {
  className?: string
}

export default function CstkprIntelligenceDashboard({ className = '' }: CstkprIntelligenceDashboardProps) {
  const [stats, setStats] = useState<OpinionStats | null>(null)
  const [recentOpinions, setRecentOpinions] = useState<CstkprOpinion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOpinion, setSelectedOpinion] = useState<CstkprOpinion | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [statsData, opinionsData] = await Promise.all([
        CstkprIntelligenceService.getOpinionStats(),
        CstkprIntelligenceService.getRecentOpinions(10)
      ])
      
      setStats(statsData)
      setRecentOpinions(opinionsData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeTestCast = async () => {
    if (analyzing) return
    
    try {
      setAnalyzing(true)
      console.log('🧠 Testing @cstkpr intelligence...')
      
      // Test cast example
      const testCast = {
        hash: `test-${Date.now()}`,
        content: "What do you think about the recent ETH pump? I'm bullish but worried about market volatility. @cstkpr",
        author: "test-user"
      }
      
      console.log('📝 Analyzing test cast:', testCast)
      
      // Test the analysis without database operations for now
      try {
        const opinion = await CstkprIntelligenceService.analyzeCastAndFormOpinion(
          testCast.hash,
          testCast.content,
          testCast.author,
          false // Disable web research for testing
        )
        
        console.log('✅ Generated opinion:', opinion)
        
        // Reload dashboard data to show the new opinion
        await loadDashboardData()
        setSelectedOpinion(opinion)
        
        // Show success message
        alert(`✅ Test analysis complete! Opinion generated with ${Math.round(opinion.confidence_score * 100)}% confidence.`)
        
      } catch (dbError) {
        console.warn('⚠️ Database operation failed, testing core analysis logic...', dbError)
        
        // Test just the opinion generation without saving
        const topics = CstkprIntelligenceService.extractCastTopics(testCast.content)
        const mockOpinion = await CstkprIntelligenceService.generateOpinion(
          testCast.content,
          testCast.author,
          topics,
          [], // No related casts
          null, // No web research
          '', // No user quality insight
          [] // No similar casts
        )
        
        console.log('✅ Core analysis working:', mockOpinion)
        alert(`✅ Core analysis system working! Generated opinion with ${Math.round(mockOpinion.confidence * 100)}% confidence.\n\n⚠️ Note: Database table needs to be created for full functionality.`)
      }
      
    } catch (error) {
      console.error('❌ Error analyzing test cast:', error)
      
      // Show detailed error to user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`❌ Test analysis failed: ${errorMessage}\n\nCheck the browser console for more details.`)
    } finally {
      setAnalyzing(false)
    }
  }

  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`
  }

  const getToneColor = (tone: string): string => {
    const colors = {
      analytical: 'bg-blue-100 text-blue-800',
      supportive: 'bg-green-100 text-green-800',
      critical: 'bg-red-100 text-red-800',
      curious: 'bg-purple-100 text-purple-800',
      neutral: 'bg-gray-100 text-gray-800'
    }
    return colors[tone as keyof typeof colors] || colors.neutral
  }

  const getToneEmoji = (tone: string): string => {
    const emojis = {
      analytical: '🔍',
      supportive: '👍',
      critical: '⚠️',
      curious: '🤔',
      neutral: '⚖️'
    }
    return emojis[tone as keyof typeof emojis] || '🤖'
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">🧠</div>
            <div>
              <h2 className="text-2xl font-bold text-white">@cstkpr Intelligence</h2>
              <p className="text-indigo-100">AI-powered cast analysis and opinions</p>
            </div>
          </div>
          <button
            onClick={analyzeTestCast}
            disabled={analyzing}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {analyzing ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing...</span>
              </div>
            ) : (
              'Test Analysis'
            )}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="p-6 border-b">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.totalOpinions}</div>
              <div className="text-sm text-blue-500">Total Opinions</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatConfidence(stats.averageConfidence)}
              </div>
              <div className="text-sm text-green-500">Avg Confidence</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.topTopics.length}</div>
              <div className="text-sm text-purple-500">Active Topics</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-orange-600">{stats.recentActivity}</div>
              <div className="text-sm text-orange-500">Last Activity</div>
            </div>
          </div>

          {/* Top Topics */}
          {stats.topTopics.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">🏷️ Top Discussion Topics</h3>
              <div className="flex flex-wrap gap-2">
                {stats.topTopics.map((topic, index) => (
                  <span
                    key={topic}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      index === 0 ? 'bg-indigo-100 text-indigo-800' :
                      index === 1 ? 'bg-blue-100 text-blue-800' :
                      index === 2 ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tone Distribution */}
          {Object.keys(stats.toneDistribution).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">🎭 Response Tone Analysis</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(stats.toneDistribution).map(([tone, count]) => (
                  <div key={tone} className={`p-3 rounded-lg ${getToneColor(tone)}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{getToneEmoji(tone)}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                    <div className="text-xs capitalize mt-1">{tone}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Opinions */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">💭 Recent Opinions</h3>
          <button
            onClick={loadDashboardData}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            Refresh
          </button>
        </div>

        {recentOpinions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🤖</div>
            <p>No opinions generated yet</p>
            <p className="text-sm">Try the "Test Analysis" button to see @cstkpr in action!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentOpinions.map((opinion) => (
              <div
                key={opinion.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedOpinion?.id === opinion.id ? 'border-indigo-300 bg-indigo-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedOpinion(selectedOpinion?.id === opinion.id ? null : opinion)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getToneEmoji(opinion.response_tone)}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getToneColor(opinion.response_tone)}`}>
                      {opinion.response_tone}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatConfidence(opinion.confidence_score)} confidence
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(opinion.created_at).toLocaleDateString()}
                  </div>
                </div>

                <p className="text-gray-800 mb-2">{opinion.opinion_text}</p>
                
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>💬 Original: "{opinion.original_cast_content.slice(0, 50)}..."</span>
                  <span>👤 @{opinion.original_author}</span>
                </div>

                {/* Expanded details */}
                {selectedOpinion?.id === opinion.id && (
                  <div className="mt-4 pt-4 border-t bg-white rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Topics */}
                      {opinion.topic_analysis && opinion.topic_analysis.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">🏷️ Topics Analyzed</h4>
                          <div className="flex flex-wrap gap-1">
                            {opinion.topic_analysis.map((topic) => (
                              <span key={topic} className="bg-gray-100 px-2 py-1 rounded text-xs">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sources */}
                      {opinion.sources_used && opinion.sources_used.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">📚 Sources Used</h4>
                          <div className="text-sm text-gray-600">
                            {opinion.sources_used.map((source, idx) => (
                              <div key={idx} className="mb-1">• {source}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reasoning */}
                      {opinion.reasoning && opinion.reasoning.length > 0 && (
                        <div className="md:col-span-2">
                          <h4 className="font-medium mb-2">🧠 Reasoning Process</h4>
                          <div className="text-sm text-gray-600">
                            {opinion.reasoning.map((reason, idx) => (
                              <div key={idx} className="mb-1">
                                <span className="text-indigo-600">{idx + 1}.</span> {reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Web Research */}
                      {opinion.web_research_summary && (
                        <div className="md:col-span-2">
                          <h4 className="font-medium mb-2">🌐 Web Research Summary</h4>
                          <p className="text-sm text-gray-600">{opinion.web_research_summary}</p>
                        </div>
                      )}
                    </div>

                    {/* Feedback buttons */}
                    <div className="flex items-center justify-end mt-4 pt-4 border-t space-x-2">
                      <span className="text-xs text-gray-500 mr-2">Was this opinion helpful?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          CstkprIntelligenceService.updateOpinionConfidence(opinion.id, true)
                        }}
                        className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-xs transition-colors"
                      >
                        👍 Yes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          CstkprIntelligenceService.updateOpinionConfidence(opinion.id, false)
                        }}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs transition-colors"
                      >
                        👎 No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
