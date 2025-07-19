// src/components/CollectionManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { CollectionService, type Collection } from '@/lib/supabase'

export default function CollectionManager({ userId }: { userId: string }) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollection, setNewCollection] = useState({ name: '', description: '', isPublic: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCollections()
  }, [userId])

  const fetchCollections = async () => {
    try {
      setLoading(true)
      const userCollections = await CollectionService.getUserCollections(userId)
      setCollections(userCollections)
    } catch (err) {
      console.error('Failed to fetch collections:', err)
      setError('Failed to load collections')
    } finally {
      setLoading(false)
    }
  }

  const createCollection = async () => {
    if (!newCollection.name.trim()) return

    try {
      const collection = await CollectionService.createCollection(
        newCollection.name,
        newCollection.description,
        userId,
        newCollection.isPublic
      )
      setCollections([...collections, collection])
      setNewCollection({ name: '', description: '', isPublic: false })
      setShowCreateModal(false)
    } catch (error) {
      console.error('Failed to create collection:', error)
      setError('Failed to create collection')
    }
  }

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          <span className="ml-2 text-white">Loading collections...</span>
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
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">My Collections</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          + New Collection
        </button>
      </div>

      {/* Collections Grid */}
      {collections.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold text-white mb-2">No collections yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first collection to organize your saved casts
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Create Your First Collection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="bg-white/10 rounded-lg p-4 hover:bg-white/15 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white truncate">{collection.name}</h3>
                {collection.is_public && (
                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded flex-shrink-0">
                    Public
                  </span>
                )}
              </div>
              {collection.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{collection.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>0 casts</span>
                <span>{new Date(collection.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Create New Collection</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Collection name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Crypto Alpha, AI Insights..."
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({...newCollection, name: e.target.value})}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  maxLength={50}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  placeholder="What kind of casts will you save here?"
                  value={newCollection.description}
                  onChange={(e) => setNewCollection({...newCollection, description: e.target.value})}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 h-20 resize-none"
                  maxLength={200}
                />
              </div>
              
              <label className="flex items-center gap-3 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCollection.isPublic}
                  onChange={(e) => setNewCollection({...newCollection, isPublic: e.target.checked})}
                  className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                />
                <span className="text-sm">
                  Make this collection public
                  <span className="block text-xs text-gray-400">Others can discover and view this collection</span>
                </span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createCollection}
                disabled={!newCollection.name.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}