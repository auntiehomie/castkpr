// src/components/RecentCasts.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'
import CastCard from './CastCard'
import Link from 'next/link'

interface RecentCastsProps {
  userId?: string
  onViewAllClick?: () => void
}

export default function RecentCasts({ userId = 'demo-user', onViewAllClick }: RecentCastsProps) {
  const [casts, setCasts] = useState<SavedCast[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecentCasts = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Fetching recent casts for user:', userId)
      
      // Fetch 3 most recent casts
      const recentCasts = await CastService.getUserCasts(userId, 3)
      console.log('📦 Fetched casts:', recentCasts.length)
      
      // Log first cast for debugging
      if (recentCasts.length > 0) {
        console.log('📝 Sample cast data:', {
          id: recentCasts[0].id,
          cast_content: recentCasts[0].cast_content?.substring(0, 50) + '...',
          username: recentCasts[0].username,
          author_display_name: recentCasts[0].author_display_name,
          parsed_data_keys: recentCasts[0].parsed_data ? Object.keys(recentCasts[0].parsed_data) : 'no parsed_data'
        })
      }
      
      setCasts(recentCasts)
    } catch (err) {
      console.error('❌ Error fetching recent casts:', err)
      setError('Failed to load recent casts')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const handleCastUpdate = (updatedCast: SavedCast): void => {
    console.log('🔄 Updating cast in recent casts:', updatedCast.id)
    setCasts(prevCasts => 
      prevCasts.map(cast => 
        cast.id === updatedCast.id ? updatedCast : cast
      )
    )
  }

  const handleCastDelete = async (castId: string): Promise<void> => {
    try {
      console.log('🗑️ Deleting cast from recent casts:', castId)
      await CastService.deleteCast(castId, userId)
      setCasts(casts.filter(cast => cast.id !== castId))
    } catch (err) {
      console.error('❌ Error deleting cast:', err)
      setError('Failed to delete cast')
    }
  }

  useEffect(() => {
    fetchRecentCasts()
  }, [fetchRecentCasts])

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Recent Casts</h2>
        </div>
        
        {/* Loading skeletons */}
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
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
            onClick={fetchRecentCasts}
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
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Recent Casts</h2>
        
        {casts.length > 0 && (
          <div className="flex items-center gap-3">
            {onViewAllClick ? (
              <button
                onClick={onViewAllClick}
                className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
              >
                View All →
              </button>
            ) : (
              <Link 
                href="/dashboard"
                className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
              >
                View All →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Casts */}
      {casts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-white mb-2">No saved casts yet</h3>
          <p className="text-gray-400 mb-6">
            Start saving casts by replying "@cstkpr save this" to any cast on Farcaster
          </p>
          
          {/* Enhanced instructions */}
          <div className="bg-white/5 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-semibold text-white mb-2">🤖 Enhanced CastKPR Commands:</h4>
            <ol className="text-sm text-gray-300 text-left space-y-1">
              <li>• <code className="bg-black/30 px-1 rounded">@cstkpr save this</code> - Save with AI quality analysis</li>
              <li>• <code className="bg-black/30 px-1 rounded">@cstkpr opinion</code> - Get AI opinion on content</li>
              <li>• <code className="bg-black/30 px-1 rounded">@cstkpr analyze</code> - Deep content analysis</li>
              <li>• <code className="bg-black/30 px-1 rounded">@cstkpr trending</code> - See what's hot in community</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {casts.map((cast: SavedCast) => {
            // Debug log for each cast
            console.log(`🎯 Rendering cast ${cast.id}:`, {
              content_preview: cast.cast_content?.substring(0, 30) + '...',
              username: cast.username,
              fid: cast.fid,
              has_parsed_data: !!cast.parsed_data
            })
            
            return (
              <CastCard 
                key={cast.id} 
                cast={cast} 
                compact={true}
                userId={userId}
                onUpdate={handleCastUpdate}
                onDelete={handleCastDelete}
                showAnalytics={false} // Keep it simple for recent casts
              />
            )
          })}
        </div>
      )}

      {/* Footer with stats */}
      {casts.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              Showing {casts.length} of your most recent saved casts
            </p>
            
            {/* Quick stats if we have enhanced data */}
            {casts.some(cast => cast.parsed_data) && (
              <div className="text-xs text-gray-500">
                🧠 Enhanced with AI analysis
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}