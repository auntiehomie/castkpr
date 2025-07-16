'use client'

import { useState, useEffect, useCallback } from 'react'
import { CastService, SavedCast } from '@/lib/supabase'
import CastCard from './CastCard'
import Link from 'next/link'

interface RecentCastsProps {
  userId?: string
}

export default function RecentCasts({ userId = 'demo-user' }: RecentCastsProps) {
  const [casts, setCasts] = useState<SavedCast[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecentCasts = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch 3 most recent casts
      const recentCasts = await CastService.getUserCasts(userId, 3)
      setCasts(recentCasts)
    } catch (err) {
      console.error('Error fetching recent casts:', err)
      setError('Failed to load recent casts')
    } finally {
      setLoading(false)
    }
  }, [userId])

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
          <Link 
            href="/dashboard"
            className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
          >
            View All →
          </Link>
        )}
      </div>

      {/* Casts */}
      {casts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-white mb-2">No saved casts yet</h3>
          <p className="text-gray-400 mb-6">
            Start saving casts by replying &quot;@cstkpr save this&quot; to any cast on Farcaster
          </p>
          
          {/* Quick demo instructions */}
          <div className="bg-white/5 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-semibold text-white mb-2">How to save casts:</h4>
            <ol className="text-sm text-gray-300 text-left space-y-1">
              <li>1. Find an interesting cast on Farcaster</li>
              <li>2. Reply with &quot;@cstkpr save this&quot;</li>
              <li>3. Your cast will appear here automatically!</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {casts.map((cast: SavedCast) => (
            <CastCard 
              key={cast.id} 
              cast={cast} 
              compact={true}
            />
          ))}
        </div>
      )}

      {/* Footer with stats */}
      {casts.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-sm text-gray-400">
            Showing {casts.length} of your most recent saved casts
          </p>
        </div>
      )}
    </div>
  )
}