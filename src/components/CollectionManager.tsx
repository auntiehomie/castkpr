'use client'

import { useState, useEffect, useCallback } from 'react'
import { CollectionService, CastService } from '@/lib/supabase'
import type { Collection, SavedCast } from '@/lib/supabase'
import CastCard from './CastCard'
import AITaggingPanel from './AITaggingPanel'

interface CollectionManagerProps {
  userId: string
}

export default function CollectionManager({ userId }: CollectionManagerProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [collectionCasts, setCollectionCasts] = useState<SavedCast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [allCasts, setAllCasts] = useState<SavedCast[]>([])
  const [showAddCasts, setShowAddCasts] = useState(false)

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Fetching collections for user:', userId)
      const userCollections = await CollectionService.getUserCollections(userId)
      console.log('✅ Found collections:', userCollections.length)
      setCollections(userCollections)
    } catch (err) {
      console.error('❌ Error fetching collections:', err)
      setError('Failed to load collections')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchCollectionCasts = useCallback(async (collectionId: string) => {
    try {
      console.log('🔍 Fetching casts for collection:', collectionId)
      const castCollections = await CollectionService.getCollectionCasts(collectionId)
      console.log('📊 Raw collection casts data:', castCollections)
      
      // Extract the actual SavedCast objects from the response
      const casts = castCollections
        .map(cc => cc.saved_casts)
        .filter(cast => cast !== null)
      
      console.log('✅ Processed casts:', casts.length)
      setCollectionCasts(casts)
    } catch (err) {
      console.error('❌ Error fetching collection casts:', err)
      setError('Failed to load collection casts')
    }
  }, [])

  const fetchAllCasts = useCallback(async () => {
    try {
      const casts = await CastService.getUserCasts(userId, 1000)
      setAllCasts(casts)
    } catch (err) {
      console.error('Error fetching all casts:', err)
    }
  }, [userId])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newCollectionName.trim()) return

    try {
      console.log('🆕 Creating collection:', newCollectionName, 'for user:', userId)
      await CollectionService.createCollection(
        newCollectionName,
        newCollectionDescription,
        userId,
        false
      )
      
      setNewCollectionName('')
      setNewCollectionDescription('')
      setShowCreateForm(false)
      await fetchCollections()
    } catch (err) {
      console.error('Error creating collection:', err)
      setError('Failed to create collection')
    }
  }

  const handleSelectCollection = async (collection: Collection) => {
    setSelectedCollection(collection)
    await fetchCollectionCasts(collection.id)
  }

  const handleAddCastToCollection = async (castId: string) => {
    if (!selectedCollection) return

    try {
      await CollectionService.addCastToCollection(castId, selectedCollection.id)
      await fetchCollectionCasts(selectedCollection.id)
      setShowAddCasts(false)
    } catch (err) {
      console.error('Error adding cast to collection:', err)
      setError('Failed to add cast to collection')
    }
  }

  const handleShowAddCasts = async () => {
    await fetchAllCasts()
    setShowAddCasts(true)
  }

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Collections</h2>
        </div>
        
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-4 animate-pulse">
              <div className="h-6 bg-gray-600 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-600 rounded w-2/3"></div>
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
            onClick={fetchCollections}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            type="button"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Show collection details view
  if (selectedCollection) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setSelectedCollection(null)}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← Back to Collections
            </button>
            <button
              onClick={handleShowAddCasts}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Add Casts
            </button>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">{selectedCollection.name}</h2>
          {selectedCollection.description && (
            <p className="text-gray-300">{selectedCollection.description}</p>
          )}
          <p className="text-sm text-gray-400 mt-2">
            {collectionCasts.length} cast{collectionCasts.length !== 1 ? 's' : ''} in this collection
          </p>
        </div>

        {/* Add casts modal */}
        {showAddCasts && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add Casts to Collection</h3>
              <button
                onClick={() => setShowAddCasts(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-2">
              {allCasts.filter(cast => 
                !collectionCasts.some(cc => cc.id === cast.id)
              ).map(cast => (
                <div key={cast.id} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{cast.cast_content}</p>
                    <p className="text-gray-400 text-xs">@{cast.username}</p>
                  </div>
                  <button
                    onClick={() => handleAddCastToCollection(cast.id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collection casts */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          {collectionCasts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-xl font-semibold text-white mb-2">Empty Collection</h3>
              <p className="text-gray-400 mb-4">This collection doesn't have any casts yet</p>
              <button
                onClick={handleShowAddCasts}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Your First Cast
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {collectionCasts.map(cast => (
                <CastCard key={cast.id} cast={cast} compact={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main collections view
  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Collections</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {showCreateForm ? 'Cancel' : '+ New Collection'}
          </button>
        </div>

        {/* Create collection form */}
        {showCreateForm && (
          <form onSubmit={handleCreateCollection} className="mb-6 p-4 bg-white/10 rounded-lg">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Collection Name
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g., Tech Posts, Favorites, etc."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  placeholder="What's this collection about?"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 h-20"
                />
              </div>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Create Collection
              </button>
            </div>
          </form>
        )}

        {/* Collections grid */}
        {collections.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Collections Yet</h3>
            <p className="text-gray-400 mb-6">
              Create collections to organize your saved casts by topic, project, or any way you like
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Create Your First Collection
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map(collection => (
              <div
                key={collection.id}
                onClick={() => handleSelectCollection(collection)}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 transition-all hover:bg-white/15 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {collection.name}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {collection.is_public ? '🌍' : '🔒'}
                  </span>
                </div>
                
                {collection.description && (
                  <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                    {collection.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Click to view</span>
                  <span>→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Tagging Panel */}
      <AITaggingPanel userId={userId} onRetagComplete={fetchCollections} />
    </div>
  )
}