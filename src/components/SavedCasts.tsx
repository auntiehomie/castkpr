'use client'

import { useState, useEffect, useCallback } from 'react'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'
import CastCard from './CastCard'

interface SavedCastsProps {
  userId?: string
}

export default function SavedCasts({ userId = 'demo-user' }: SavedCastsProps) {
  const [casts, setCasts] = useState<SavedCast[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const fetchCasts = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      
      const savedCasts = await CastService.getUserCasts(userId, 50)
      setCasts(savedCasts)
    } catch (err) {
      console.error('Error fetching saved casts:', err)
      setError('Failed to load saved casts')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const searchCasts = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      fetchCasts()
      return
    }

    try {
      setIsSearching(true)
      setError(null)
      
      const searchResults = await CastService.searchCasts(userId, query)
      setCasts(searchResults)
    } catch (err) {
      console.error('Error searching casts:', err)
      setError('Failed to search casts')
    } finally {
      setIsSearching(false)
    }
  }, [userId, fetchCasts])

  const handleDelete = async (castId: string): Promise<void> => {
    try {
      await CastService.deleteCast(castId, userId)
      setCasts(casts.filter(cast => cast.id !== castId))
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
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Saved Casts</h2>
        <div className="text-sm text-gray-400">
          {casts.length} cast{casts.length !== 1 ? 's' : ''} saved
        </div>
      </div>

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
          💡 Tip: You can search cast content, author names, tags, and your notes!
        </p>
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
                <li>4. Click &quot;Add note...&quot; to add your thoughts!</li>
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
                userId={userId}
                onUpdate={handleCastUpdate}
              />
              {/* Delete button */}
              <button
                onClick={() => handleDelete(cast.id)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm z-10"
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
  )
}