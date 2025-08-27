// src/components/SavedCasts.tsx
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

// Enhanced parsed data interface with safer defaults
interface EnhancedParsedData {
  hashtags?: string[]
  urls?: string[]
  mentions?: string[]
  word_count?: number
  topics?: string[]
  ai_category?: string
  ai_tags?: string[]
  // Enhanced analysis fields (might not exist in older casts)
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

export default function SavedCasts({ userId }: SavedCastsProps) {
  const [casts, setCasts] = useState<SavedCast[]>([])
  const [allCasts, setAllCasts] = useState<SavedCast[]>([]) // Store unfiltered casts
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagPanel, setShowTagPanel] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Enhancement processing state
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhancementProgress, setEnhancementProgress] = useState({ processed: 0, total: 0 })
  const [enhancementResults, setEnhancementResults] = useState<string | null>(null)
  
  // Enhanced analysis filters
  const [qualityFilter, setQualityFilter] = useState<string>('')
  const [sentimentFilter, setSentimentFilter] = useState<string>('')
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('')
  const [engagementFilter, setEngagementFilter] = useState<string>('')
  const [showAnalysisFilters, setShowAnalysisFilters] = useState(false)

  // Get current user from Farcaster Mini App context
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
          setCurrentUserId('demo-user')
          return
        }

        // Try to import and use the Mini App SDK
        try {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          
          // First check if we're in a Mini App environment
          const isInMiniApp = await sdk.isInMiniApp()
          console.log('🔍 Is in Mini App:', isInMiniApp)
          
          if (isInMiniApp) {
            // We're in a Mini App, try to get the context
            try {
              const context = await sdk.context
              console.log('📱 Got context:', context)
              
              if (context?.user) {
                const user = context.user
                const detectedUserId = user.username || `fid-${user.fid}` || 'anonymous'
                console.log('🔍 Detected current user:', detectedUserId, user)
                setCurrentUserId(detectedUserId)
                return
              } else {
                console.log('⚠️ No user in context')
                setCurrentUserId('demo-user')
              }
            } catch (contextError) {
              console.error('❌ Error getting context:', contextError)
              setCurrentUserId('demo-user')
            }
          } else {
            console.log('🌐 Not in Mini App environment, using demo user')
            setCurrentUserId('demo-user')
          }
        } catch (sdkError) {
          console.log('📱 Mini App SDK not available:', sdkError)
          setCurrentUserId('demo-user')
        }
      } catch (error) {
        console.error('❌ Error in getCurrentUser:', error)
        setCurrentUserId('demo-user')
      }
    }

    if (!userId) {
      getCurrentUser()
    } else {
      setCurrentUserId(userId)
    }
  }, [userId])

  // Calculate enhanced statistics with better error handling
  const enhancedStats = useMemo(() => {
    console.log('📊 Calculating enhanced stats for', allCasts.length, 'casts')
    
    const enhancedCasts = allCasts.filter(cast => {
      const parsedData = cast.parsed_data as EnhancedParsedData
      const hasEnhancedData = parsedData?.quality_score !== undefined
      return hasEnhancedData
    })

    console.log('🧠 Enhanced casts found:', enhancedCasts.length)

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

  // Calculate all available tags with better error handling
  const tagStats = useMemo(() => {
    console.log('🏷️ Calculating tag stats for', allCasts.length, 'casts')
    const tagMap = new Map<string, TagInfo>()

    allCasts.forEach((cast, index) => {
      try {
        const parsedData = cast.parsed_data as EnhancedParsedData

        // Safely extract tags from different sources
        const castTags = Array.isArray(cast.tags) ? cast.tags : []
        const hashtagsFromData = Array.isArray(parsedData?.hashtags) ? parsedData.hashtags : []
        const aiTagsFromData = Array.isArray(parsedData?.ai_tags) ? parsedData.ai_tags : []
        const topicsFromData = Array.isArray(parsedData?.topics) ? parsedData.topics : []

        // Manual tags (in cast.tags but not in other categories)
        const manualTags = castTags.filter(tag => 
          typeof tag === 'string' &&
          !hashtagsFromData.includes(tag) && 
          !aiTagsFromData.includes(tag) &&
          !topicsFromData.includes(tag) &&
          tag !== 'saved-via-bot' &&
          tag !== 'enhanced-analysis'
        )

        manualTags.forEach(tag => {
          const existing = tagMap.get(tag) || { tag, count: 0, type: 'manual' as const }
          tagMap.set(tag, { ...existing, count: existing.count + 1 })
        })

        // AI tags
        aiTagsFromData.forEach((tag: string) => {
          if (typeof tag === 'string') {
            const existing = tagMap.get(tag) || { tag, count: 0, type: 'ai' as const }
            tagMap.set(tag, { ...existing, count: existing.count + 1 })
          }
        })

        // Topics from enhanced analysis
        topicsFromData.forEach((tag: string) => {
          if (typeof tag === 'string') {
            const existing = tagMap.get(tag) || { tag, count: 0, type: 'analysis' as const }
            tagMap.set(tag, { ...existing, count: existing.count + 1 })
          }
        })

        // Hashtags from content
        hashtagsFromData.forEach((tag: string) => {
          if (typeof tag === 'string') {
            const existing = tagMap.get(tag) || { tag, count: 0, type: 'hashtag' as const }
            tagMap.set(tag, { ...existing, count: existing.count + 1 })
          }
        })

        // System tags
        const systemTags = castTags.filter(tag => 
          tag === 'saved-via-bot' || tag === 'enhanced-analysis'
        )
        systemTags.forEach(tag => {
          const existing = tagMap.get(tag) || { tag, count: 0, type: 'system' as const }
          tagMap.set(tag, { ...existing, count: existing.count + 1 })
        })

      } catch (tagError) {
        console.warn(`⚠️ Error processing tags for cast ${index}:`, tagError)
      }
    })

    const result = Array.from(tagMap.values()).sort((a, b) => b.count - a.count)
    console.log('🏷️ Tag stats calculated:', result.length, 'unique tags')
    return result
  }, [allCasts])

  const fetchCasts = useCallback(async (): Promise<void> => {
    if (!currentUserId) return

    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Fetching casts for user:', currentUserId)
      const savedCasts = await CastService.getUserCasts(currentUserId, 100)
      console.log('📦 Fetched', savedCasts.length, 'casts')
      
      setAllCasts(savedCasts)
      setCasts(savedCasts)
      
    } catch (err) {
      console.error('❌ Error fetching saved casts:', err)
      setError('Failed to load saved casts: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [currentUserId])

  const searchCasts = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      fetchCasts()
      return
    }

    if (!currentUserId) return

    try {
      setIsSearching(true)
      setError(null)
      
      console.log('🔍 Searching casts with query:', query)
      const searchResults = await CastService.searchCasts(currentUserId, query)
      console.log('📊 Search returned', searchResults.length, 'results')
      
      setCasts(searchResults)
      console.log('✅ Search completed')
      
    } catch (err) {
      console.error('❌ Error searching casts:', err)
      setError('Failed to search casts: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsSearching(false)
    }
  }, [currentUserId, fetchCasts])

  const handleDelete = async (castId: string): Promise<void> => {
    if (!currentUserId) return

    try {
      console.log('🗑️ Deleting cast:', castId)
      await CastService.deleteCast(castId, currentUserId)
      setCasts(casts.filter(cast => cast.id !== castId))
      setAllCasts(allCasts.filter(cast => cast.id !== castId))
      console.log('✅ Cast deleted successfully')
    } catch (err) {
      console.error('❌ Error deleting cast:', err)
      setError('Failed to delete cast')
    }
  }

  // Enhancement function to add AI analysis to existing casts
  const handleEnhanceCasts = async (): Promise<void> => {
    if (!currentUserId || isEnhancing) return

    try {
      setIsEnhancing(true)
      setEnhancementResults(null)
      setEnhancementProgress({ processed: 0, total: allCasts.length })

      let totalProcessed = 0
      let totalEnhanced = 0
      let offset = 0
      const batchSize = 20

      while (true) {
        console.log(`🔄 Processing batch starting at offset ${offset}`)
        
        const response = await fetch('/api/enhance-casts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            limit: batchSize,
            offset
          })
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Enhancement failed')
        }

        totalProcessed += result.processed
        totalEnhanced += result.enhanced
        
        setEnhancementProgress({
          processed: totalProcessed,
          total: Math.max(allCasts.length, totalProcessed)
        })

        console.log(`✅ Batch complete: ${result.enhanced}/${result.processed} enhanced`)

        // Check if we're done
        if (!result.hasMore || result.processed < batchSize) {
          break
        }

        offset = result.nextOffset
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      setEnhancementResults(
        `🎯 Enhancement complete! Enhanced ${totalEnhanced} out of ${totalProcessed} processed casts.`
      )

      // Refresh the casts to show updated analytics
      await fetchCasts()

    } catch (error) {
      console.error('❌ Enhancement failed:', error)
      setEnhancementResults(
        `❌ Enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsEnhancing(false)
    }
  }

  useEffect(() => {
    if (currentUserId) {
      fetchCasts()
    }
  }, [fetchCasts, currentUserId])

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      searchCasts(searchQuery)
    }, 300) // Debounce search

    return () => clearTimeout(delayedSearch)
  }, [searchQuery, searchCasts])

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
      {/* Current User Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-4 border border-yellow-500/20">
          <p className="text-yellow-300 text-sm">
            🔍 Debug: Current user = {currentUserId || 'Loading...'}
          </p>
        </div>
      )}

      {/* Enhanced Stats Overview */}
      {enhancedStats.total > 0 && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/20">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            📊 Your Cast Analytics
            {enhancedStats.enhanced < enhancedStats.total && (
              <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">
                {enhancedStats.enhanced} of {enhancedStats.total} enhanced
              </span>
            )}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{enhancedStats.total}</div>
              <div className="text-xs text-gray-400">Total Saved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{enhancedStats.enhanced}</div>
              <div className="text-xs text-gray-400">AI Enhanced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {enhancedStats.enhanced > 0 ? `${enhancedStats.avgQuality}/100` : 'N/A'}
              </div>
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

      {/* AI Enhancement Section */}
      {enhancedStats.total > 0 && enhancedStats.enhanced < enhancedStats.total && (
        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 backdrop-blur-lg rounded-xl p-6 border border-orange-500/20">
          <h3 className="text-lg font-bold text-white mb-3">🧠 Enhance Your Casts</h3>
          <p className="text-gray-300 text-sm mb-4">
            Add AI analysis and quality scoring to your existing {enhancedStats.total - enhancedStats.enhanced} unprocessed casts.
          </p>
          
          {!isEnhancing ? (
            <button
              onClick={handleEnhanceCasts}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
            >
              🚀 Start Enhancement Process
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                <span className="text-orange-300 text-sm">
                  Processing... {enhancementProgress.processed} of {enhancementProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${enhancementProgress.total > 0 ? (enhancementProgress.processed / enhancementProgress.total) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>
          )}
          
          {enhancementResults && (
            <div className="mt-3 p-3 bg-black/20 rounded-lg">
              <p className="text-sm text-gray-300">{enhancementResults}</p>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Saved Casts</h2>
          <div className="text-sm text-gray-400">
            {casts.length} cast{casts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search saved casts..."
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
        </div>

        {/* Casts */}
        {casts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery ? 'No matching casts found' : 'No saved casts yet'}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchQuery 
                ? 'Try a different search term'
                : 'Start saving casts by replying "@cstkpr save this" to any cast on Farcaster'
              }
            </p>
            
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                type="button"
              >
                Clear Search
              </button>
            ) : (
              <div className="bg-white/5 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-semibold text-white mb-2">How to save casts:</h4>
                <ol className="text-sm text-gray-300 text-left space-y-1">
                  <li>1. Find an interesting cast on Farcaster</li>
                  <li>2. Reply with &quot;@cstkpr save this&quot;</li>
                  <li>3. Your cast will appear here automatically!</li>
                </ol>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {casts.map((cast: SavedCast) => (
              <div key={cast.id} className="relative group">
                <CastCard 
                  cast={cast} 
                  compact={false}
                />
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(cast.id)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                  title="Delete saved cast"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {casts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-sm text-gray-400">
              {searchQuery 
                ? `Found ${casts.length} matching cast${casts.length !== 1 ? 's' : ''}`
                : `Showing all ${casts.length} saved cast${casts.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}