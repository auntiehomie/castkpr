'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'
import CastCard from './CastCard'

interface SavedCastsProps {
  userId?: string
}

interface TagInfo {
  tag: string
  count: number
  type: 'manual' | 'ai' | 'hashtag' | 'system' | 'analysis'
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

export default function SavedCasts({ userId = 'demo-user' }: SavedCastsProps) {
  const [casts, setCasts] = useState<SavedCast[]>([])
  const [allCasts, setAllCasts] = useState<SavedCast[]>([]) // Store unfiltered casts
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagPanel, setShowTagPanel] = useState(false)
  
  // Enhanced analysis filters
  const [qualityFilter, setQualityFilter] = useState<string>('')
  const [sentimentFilter, setSentimentFilter] = useState<string>('')
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('')
  const [engagementFilter, setEngagementFilter] = useState<string>('')
  const [showAnalysisFilters, setShowAnalysisFilters] = useState(false)

  // Calculate enhanced statistics
  const enhancedStats = useMemo(() => {
    const enhancedCasts = allCasts.filter(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      return parsedData?.quality_score !== undefined
    })

    const avgQuality = enhancedCasts.length > 0 
      ? enhancedCasts.reduce((sum, cast) => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          return sum + (parsedData.quality_score || 0)
        }, 0) / enhancedCasts.length
      : 0

    const sentimentCounts = enhancedCasts.reduce((acc, cast) => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const sentiment = parsedData.sentiment || 'neutral'
      acc[sentiment] = (acc[sentiment] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const highQualityCasts = enhancedCasts.filter(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      return (parsedData.quality_score || 0) >= 80
    }).length

    return {
      total: allCasts.length,
      enhanced: enhancedCasts.length,
      avgQuality: Math.round(avgQuality),
      sentimentCounts,
      highQuality: highQualityCasts
    }
  }, [allCasts])

  // Calculate all available tags with counts and types
  const tagStats = useMemo(() => {
    const tagMap = new Map<string, TagInfo>()

    allCasts.forEach(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData

      // Manual tags (in cast.tags but not in AI or hashtags)
      const manualTags = (cast.tags || []).filter(tag => 
        !parsedData?.hashtags?.includes(tag) && 
        !parsedData?.ai_tags?.includes(tag) &&
        !parsedData?.topics?.includes(tag) &&
        tag !== 'saved-via-bot' &&
        tag !== 'enhanced-analysis'
      )

      manualTags.forEach(tag => {
        const existing = tagMap.get(tag) || { tag, count: 0, type: 'manual' as const }
        tagMap.set(tag, { ...existing, count: existing.count + 1 })
      })

      // AI tags
      const aiTags = parsedData?.ai_tags || []
      aiTags.forEach((tag: string) => {
        const existing = tagMap.get(tag) || { tag, count: 0, type: 'ai' as const }
        tagMap.set(tag, { ...existing, count: existing.count + 1 })
      })

      // Topics from enhanced analysis
      const topics = parsedData?.topics || []
      topics.forEach((tag: string) => {
        const existing = tagMap.get(tag) || { tag, count: 0, type: 'analysis' as const }
        tagMap.set(tag, { ...existing, count: existing.count + 1 })
      })

      // Hashtags from content
      const hashtags = parsedData?.hashtags || []
      hashtags.forEach((tag: string) => {
        const existing = tagMap.get(tag) || { tag, count: 0, type: 'hashtag' as const }
        tagMap.set(tag, { ...existing, count: existing.count + 1 })
      })

      // System tags
      const systemTags = (cast.tags || []).filter(tag => 
        tag === 'saved-via-bot' || tag === 'enhanced-analysis'
      )
      systemTags.forEach(tag => {
        const existing = tagMap.get(tag) || { tag, count: 0, type: 'system' as const }
        tagMap.set(tag, { ...existing, count: existing.count + 1 })
      })
    })

    return Array.from(tagMap.values()).sort((a, b) => b.count - a.count)
  }, [allCasts])

  const fetchCasts = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      
      const savedCasts = await CastService.getUserCasts(userId, 100)
      setAllCasts(savedCasts)
      
      // Apply current filters
      let filteredCasts = savedCasts
      
      // Apply tag filters
      if (selectedTags.length > 0) {
        filteredCasts = filteredCasts.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          const castTags = new Set([
            ...(cast.tags || []),
            ...(parsedData?.hashtags || []),
            ...(parsedData?.ai_tags || []),
            ...(parsedData?.topics || [])
          ])
          
          return selectedTags.every(selectedTag => castTags.has(selectedTag))
        })
      }

      // Apply enhanced analysis filters
      if (qualityFilter) {
        filteredCasts = filteredCasts.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          const quality = parsedData?.quality_score || 0
          switch (qualityFilter) {
            case 'excellent': return quality >= 80
            case 'good': return quality >= 60 && quality < 80
            case 'fair': return quality >= 40 && quality < 60
            case 'poor': return quality < 40
            default: return true
          }
        })
      }

      if (sentimentFilter) {
        filteredCasts = filteredCasts.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          return parsedData?.sentiment === sentimentFilter
        })
      }

      if (contentTypeFilter) {
        filteredCasts = filteredCasts.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          return parsedData?.content_type === contentTypeFilter
        })
      }

      if (engagementFilter) {
        filteredCasts = filteredCasts.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          return parsedData?.engagement_potential === engagementFilter
        })
      }
      
      setCasts(filteredCasts)
    } catch (err) {
      console.error('Error fetching saved casts:', err)
      setError('Failed to load saved casts')
    } finally {
      setLoading(false)
    }
  }, [userId, selectedTags, qualityFilter, sentimentFilter, contentTypeFilter, engagementFilter])

  const searchCasts = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      fetchCasts()
      return
    }

    try {
      setIsSearching(true)
      setError(null)
      
      const searchResults = await CastService.searchCasts(userId, query)
      
      // Apply all current filters to search results
      let filteredResults = searchResults
      
      // Apply tag filters
      if (selectedTags.length > 0) {
        filteredResults = filteredResults.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          const castTags = new Set([
            ...(cast.tags || []),
            ...(parsedData?.hashtags || []),
            ...(parsedData?.ai_tags || []),
            ...(parsedData?.topics || [])
          ])
          
          return selectedTags.every(selectedTag => castTags.has(selectedTag))
        })
      }

      // Apply enhanced analysis filters to search results
      if (qualityFilter) {
        filteredResults = filteredResults.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          const quality = parsedData?.quality_score || 0
          switch (qualityFilter) {
            case 'excellent': return quality >= 80
            case 'good': return quality >= 60 && quality < 80
            case 'fair': return quality >= 40 && quality < 60
            case 'poor': return quality < 40
            default: return true
          }
        })
      }

      if (sentimentFilter) {
        filteredResults = filteredResults.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          return parsedData?.sentiment === sentimentFilter
        })
      }

      if (contentTypeFilter) {
        filteredResults = filteredResults.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          return parsedData?.content_type === contentTypeFilter
        })
      }

      if (engagementFilter) {
        filteredResults = filteredResults.filter(cast => {
          const parsedData = cast.parsed_data as EnhancedParsedData
          return parsedData?.engagement_potential === engagementFilter
        })
      }
      
      setCasts(filteredResults)
    } catch (err) {
      console.error('Error searching casts:', err)
      setError('Failed to search casts')
    } finally {
      setIsSearching(false)
    }
  }, [userId, selectedTags, qualityFilter, sentimentFilter, contentTypeFilter, engagementFilter, fetchCasts])

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag)
      } else {
        return [...prev, tag]
      }
    })
  }

  const clearAllFilters = () => {
    setSelectedTags([])
    setSearchQuery('')
    setQualityFilter('')
    setSentimentFilter('')
    setContentTypeFilter('')
    setEngagementFilter('')
  }

  const hasActiveFilters = selectedTags.length > 0 || qualityFilter || sentimentFilter || contentTypeFilter || engagementFilter

  const handleDelete = async (castId: string): Promise<void> => {
    try {
      await CastService.deleteCast(castId, userId)
      setCasts(casts.filter(cast => cast.id !== castId))
      setAllCasts(allCasts.filter(cast => cast.id !== castId))
    } catch (err) {
      console.error('Error deleting cast:', err)
      setError('Failed to delete cast')
    }
  }

  const handleCastUpdate = (updatedCast: SavedCast): void => {
    setCasts(prevCasts => 
      prevCasts.map(cast => 
        cast.id === updatedCast.id ? updatedCast : cast
      )
    )
    setAllCasts(prevCasts => 
      prevCasts.map(cast => 
        cast.id === updatedCast.id ? updatedCast : cast
      )
    )
  }

  useEffect(() => {
    fetchCasts()
  }, [fetchCasts])

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      searchCasts(searchQuery)
    }, 300) // Debounce search

    return () => clearTimeout(delayedSearch)
  }, [searchQuery, searchCasts])

  const getTagStyle = (type: string) => {
    switch (type) {
      case 'manual': return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'ai': return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'hashtag': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'system': return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
      case 'analysis': return 'bg-pink-500/20 text-pink-300 border-pink-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  const getTagIcon = (type: string) => {
    switch (type) {
      case 'manual': return '🏷️'
      case 'ai': return '🧠'
      case 'hashtag': return '#'
      case 'system': return '🤖'
      case 'analysis': return '🔍'
      default: return '🏷️'
    }
  }

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Saved Casts</h2>
        </div>
        
        {/* Loading skeletons */}
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-4 animate-pulse">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gray-600 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-600 rounded w-24"></div>
                  <div className="h-3 bg-gray-600 rounded w-32"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-600 rounded w-full"></div>
                <div className="h-4 bg-gray-600 rounded w-3/4"></div>
              </div>
            </div>
          ))}
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
          <p className="text-gray-400 mb-4">{error}</p>
          <button 
            onClick={fetchCasts}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            type="button"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Overview */}
      {enhancedStats.enhanced > 0 && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/20">
          <h3 className="text-lg font-bold text-white mb-4">📊 Your Cast Analytics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{enhancedStats.total}</div>
              <div className="text-xs text-gray-400">Total Saved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{enhancedStats.enhanced}</div>
              <div className="text-xs text-gray-400">Enhanced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{enhancedStats.avgQuality}/100</div>
              <div className="text-xs text-gray-400">Avg Quality</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{enhancedStats.sentimentCounts.positive || 0}</div>
              <div className="text-xs text-gray-400">Positive</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{enhancedStats.highQuality}</div>
              <div className="text-xs text-gray-400">High Quality</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Saved Casts</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAnalysisFilters(!showAnalysisFilters)}
              className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                showAnalysisFilters 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              🧠 Analysis Filters
            </button>
            <button
              onClick={() => setShowTagPanel(!showTagPanel)}
              className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                showTagPanel 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              🏷️ Tag Filters ({tagStats.length})
            </button>
            <div className="text-sm text-gray-400">
              {casts.length} cast{casts.length !== 1 ? 's' : ''} 
              {allCasts.length !== casts.length && ` of ${allCasts.length}`}
            </div>
          </div>
        </div>

        {/* Enhanced Analysis Filter Panel */}
        {showAnalysisFilters && (
          <div className="mb-6 p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">🧠 Analysis Filters</h3>
              <button
                onClick={() => setShowAnalysisFilters(false)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Quality Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Quality Score</label>
                <select
                  value={qualityFilter}
                  onChange={(e) => setQualityFilter(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">All Qualities</option>
                  <option value="excellent">Excellent (80+)</option>
                  <option value="good">Good (60-79)</option>
                  <option value="fair">Fair (40-59)</option>
                  <option value="poor">Poor (&lt;40)</option>
                </select>
              </div>

              {/* Sentiment Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Sentiment</label>
                <select
                  value={sentimentFilter}
                  onChange={(e) => setSentimentFilter(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">All Sentiments</option>
                  <option value="positive">😊 Positive</option>
                  <option value="neutral">😐 Neutral</option>
                  <option value="negative">😞 Negative</option>
                </select>
              </div>

              {/* Content Type Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Content Type</label>
                <select
                  value={contentTypeFilter}
                  onChange={(e) => setContentTypeFilter(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">All Types</option>
                  <option value="discussion">💬 Discussion</option>
                  <option value="announcement">📢 Announcement</option>
                  <option value="question">❓ Question</option>
                  <option value="meme">😂 Meme</option>
                  <option value="news">📰 News</option>
                  <option value="opinion">💭 Opinion</option>
                  <option value="technical">⚙️ Technical</option>
                </select>
              </div>

              {/* Engagement Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Engagement</label>
                <select
                  value={engagementFilter}
                  onChange={(e) => setEngagementFilter(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">All Levels</option>
                  <option value="high">🚀 High</option>
                  <option value="medium">📈 Medium</option>
                  <option value="low">📊 Low</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tag Filter Panel */}
        {showTagPanel && (
          <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">🏷️ Filter by Tags</h3>
              <div className="flex gap-2">
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-xs bg-red-500/20 text-red-300 px-3 py-1 rounded border border-red-500/30 hover:bg-red-500/30 transition-colors"
                  >
                    Clear Tags ({selectedTags.length})
                  </button>
                )}
                <button
                  onClick={() => setShowTagPanel(false)}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Tag Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
              {tagStats.map((tagInfo) => (
                <button
                  key={tagInfo.tag}
                  onClick={() => handleTagToggle(tagInfo.tag)}
                  className={`text-left p-2 rounded-lg border transition-all text-xs ${
                    selectedTags.includes(tagInfo.tag)
                      ? `${getTagStyle(tagInfo.type)} ring-2 ring-purple-500/50`
                      : `${getTagStyle(tagInfo.type)} hover:scale-105`
                  }`}
                  title={`${tagInfo.type} tag - ${tagInfo.count} cast${tagInfo.count !== 1 ? 's' : ''}`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span>{getTagIcon(tagInfo.type)}</span>
                    <span className="font-medium truncate">{tagInfo.tag}</span>
                  </div>
                  <div className="text-xs opacity-70">
                    {tagInfo.count} cast{tagInfo.count !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>

            {tagStats.length === 0 && (
              <p className="text-gray-400 text-center py-8">
                No tags found in your saved casts yet. Start adding manual tags or save enhanced casts!
              </p>
            )}
          </div>
        )}

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-400">Active filters:</span>
            
            {/* Tag Filters */}
            {selectedTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs flex items-center gap-1 border border-purple-500/30"
              >
                {tag}
                <span className="hover:text-red-300">×</span>
              </button>
            ))}
            
            {/* Analysis Filters */}
            {qualityFilter && (
              <button
                onClick={() => setQualityFilter('')}
                className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs flex items-center gap-1 border border-blue-500/30"
              >
                Quality: {qualityFilter}
                <span className="hover:text-red-300">×</span>
              </button>
            )}
            {sentimentFilter && (
              <button
                onClick={() => setSentimentFilter('')}
                className="bg-green-500/20 text-green-300 px-2 py-1 rounded-full text-xs flex items-center gap-1 border border-green-500/30"
              >
                Sentiment: {sentimentFilter}
                <span className="hover:text-red-300">×</span>
              </button>
            )}
            {contentTypeFilter && (
              <button
                onClick={() => setContentTypeFilter('')}
                className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-xs flex items-center gap-1 border border-yellow-500/30"
              >
                Type: {contentTypeFilter}
                <span className="hover:text-red-300">×</span>
              </button>
            )}
            {engagementFilter && (
              <button
                onClick={() => setEngagementFilter('')}
                className="bg-pink-500/20 text-pink-300 px-2 py-1 rounded-full text-xs flex items-center gap-1 border border-pink-500/30"
              >
                Engagement: {engagementFilter}
                <span className="hover:text-red-300">×</span>
              </button>
            )}
            
            <button
              onClick={clearAllFilters}
              className="bg-red-500/20 text-red-300 px-2 py-1 rounded-full text-xs border border-red-500/30"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search saved casts, notes, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {isSearching && (
              <div className="absolute right-3 top-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400"></div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            💡 Tip: Search content, authors, tags, and notes. Use filters above for enhanced analysis data!
          </p>
        </div>

        {/* Casts */}
        {casts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery || hasActiveFilters ? 'No matching casts found' : 'No saved casts yet'}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchQuery || hasActiveFilters
                ? 'Try different search terms or clear your filters'
                : 'Start saving casts by replying "@cstkpr save this" to any cast on Farcaster'
              }
            </p>
            
            {(searchQuery || hasActiveFilters) ? (
              <button
                onClick={clearAllFilters}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                type="button"
              >
                Clear All Filters
              </button>
            ) : (
              <div className="bg-white/5 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-semibold text-white mb-2">Enhanced Commands:</h4>
                <ol className="text-sm text-gray-300 text-left space-y-1">
                  <li>• @cstkpr save this - Save with analysis</li>
                  <li>• @cstkpr analyze this - Deep analysis</li>
                  <li>• @cstkpr quality score - Get quality rating</li>
                  <li>• @cstkpr sentiment - Analyze mood</li>
                </ol>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {casts.map((cast: SavedCast) => (
              <CastCard 
                key={cast.id}
                cast={cast} 
                compact={false}
                userId={userId}
                onUpdate={handleCastUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {casts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-sm text-gray-400">
              {searchQuery || hasActiveFilters
                ? `Found ${casts.length} matching cast${casts.length !== 1 ? 's' : ''} of ${allCasts.length} total`
                : `Showing all ${casts.length} saved cast${casts.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}