'use client'

import { useState, useEffect, useCallback } from 'react'
import { CollectionService, CastService, supabase } from '@/lib/supabase'
import type { Collection, SavedCast } from '@/lib/supabase'
import CastCard from './CastCard'

interface VaultManagerProps {
  userId: string
}

interface VaultWithCasts extends Collection {
  castCount: number
  recentCasts: SavedCast[]
}

export default function VaultManager({ userId }: VaultManagerProps) {
  const [vaults, setVaults] = useState<VaultWithCasts[]>([])
  const [selectedVault, setSelectedVault] = useState<VaultWithCasts | null>(null)
  const [vaultCasts, setVaultCasts] = useState<SavedCast[]>([])
  const [allCasts, setAllCasts] = useState<SavedCast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showAddCastModal, setShowAddCastModal] = useState(false)
  const [newVaultName, setNewVaultName] = useState('')
  const [newVaultDescription, setNewVaultDescription] = useState('')
  const [newVaultPublic, setNewVaultPublic] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Debug function to check database setup
  const debugDatabaseSetup = useCallback(async () => {
    console.log('🔍 Debugging database setup...')
    console.log('👤 Current userId:', userId)
    
    // Check collections table structure
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .limit(0) // Get structure without data
      
      console.log('📋 Collections table accessible:', !error)
      if (error) console.error('❌ Collections error:', error)
    } catch (e) {
      console.error('❌ Collections table error:', e)
    }

    // Check if we can read from saved_casts (to verify user exists)
    try {
      const { data, error } = await supabase
        .from('saved_casts')
        .select('*')
        .eq('saved_by_user_id', userId)
        .limit(1)
      
      console.log('👤 User has saved casts:', data?.length || 0)
      if (error) console.error('❌ Saved casts error:', error)
    } catch (e) {
      console.error('❌ Saved casts error:', e)
    }
  }, [userId])

  const fetchVaults = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const collections = await CollectionService.getUserCollections(userId)
      
      // Get cast counts and recent casts for each vault
      const vaultsWithData = await Promise.all(
        collections.map(async (collection) => {
          try {
            const collectionCasts = await CollectionService.getCollectionCasts(collection.id)
            const castCount = collectionCasts.length
            const recentCasts = collectionCasts
              .slice(0, 3)
              .map(cc => cc)
              .filter(Boolean)
            
            return {
              ...collection,
              castCount,
              recentCasts
            } as VaultWithCasts
          } catch (error) {
            console.error(`Error fetching data for collection ${collection.id}:`, error)
            return {
              ...collection,
              castCount: 0,
              recentCasts: []
            } as VaultWithCasts
          }
        })
      )
      
      setVaults(vaultsWithData)
    } catch (err) {
      console.error('Error fetching vaults:', err)
      setError('Failed to load vaults')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchAllCasts = useCallback(async () => {
    try {
      const casts = await CastService.getUserCasts(userId, 100)
      setAllCasts(casts)
    } catch (error) {
      console.error('Error fetching all casts:', error)
    }
  }, [userId])

  useEffect(() => {
    console.log('🔍 VaultManager initialized with userId:', userId)
    debugDatabaseSetup()
    fetchVaults()
    fetchAllCasts()
  }, [userId, debugDatabaseSetup, fetchVaults, fetchAllCasts])

  // Enhanced handleCreateVault with debugging
  const handleCreateVault = async () => {
    if (!newVaultName.trim()) {
      setError('Vault name is required')
      return
    }

    try {
      // Log all the data we're about to send
      console.log('🚀 Creating vault with data:', {
        name: newVaultName.trim(),
        description: newVaultDescription.trim(),
        userId,
        isPublic: newVaultPublic
      })

      // Test database connection first
      console.log('🔍 Testing Supabase connection...')
      const { data: testData, error: testError } = await supabase
        .from('collections')
        .select('*')
        .limit(1)
      
      if (testError) {
        console.error('❌ Connection test failed:', testError)
        setError(`Connection failed: ${testError.message}`)
        return
      }
      console.log('✅ Connection test passed')

      // Try the actual insert with detailed logging
      console.log('💾 Attempting to insert collection...')
      const { data: newVault, error: insertError } = await supabase
        .from('collections')
        .insert({
          name: newVaultName.trim(),
          description: newVaultDescription.trim() || null,
          created_by: userId,
          is_public: newVaultPublic
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Insert failed:', insertError)
        console.error('❌ Insert error details:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        })
        setError(`Insert failed: ${insertError.message} (Code: ${insertError.code})`)
        return
      }

      console.log('✅ Vault created successfully:', newVault)

      // Add to state with initial data
      const vaultWithData: VaultWithCasts = {
        ...newVault,
        castCount: 0,
        recentCasts: []
      }

      setVaults(prev => [vaultWithData, ...prev])
      setNewVaultName('')
      setNewVaultDescription('')
      setNewVaultPublic(false)
      setShowCreateForm(false)
      setError(null) // Clear any previous errors

    } catch (error) {
      console.error('💥 Unexpected error creating vault:', error)
      
      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : 'Unknown error occurred'
      
      setError(`Failed to create vault: ${errorMessage}`)
      
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleSelectVault = async (vault: VaultWithCasts) => {
    setSelectedVault(vault)
    
    try {
      const collectionCasts = await CollectionService.getCollectionCasts(vault.id)
      const casts = collectionCasts
        .map(cc => cc)
        .filter(Boolean)
      
      setVaultCasts(casts)
    } catch (error) {
      console.error('Error fetching vault casts:', error)
      setVaultCasts([])
    }
  }

  const handleAddCastToVault = async (castId: string) => {
    if (!selectedVault) return

    try {
      await CollectionService.addCastToCollection(castId, selectedVault.id)
      
      // Refresh the vault casts
      await handleSelectVault(selectedVault)
      
      // Update vault count
      setVaults(prev => prev.map(v => 
        v.id === selectedVault.id 
          ? { ...v, castCount: v.castCount + 1 }
          : v
      ))
      
      setShowAddCastModal(false)
    } catch (error) {
      console.error('Error adding cast to vault:', error)
      setError('Failed to add cast to vault')
    }
  }

  const filteredCasts = allCasts.filter(cast =>
    cast.cast_content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cast.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cast.tags && cast.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  )

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your vaults...</p>
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
            onClick={() => {
              setError(null)
              fetchVaults()
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (selectedVault) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        {/* Vault Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedVault(null)}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← Back
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white">{selectedVault.name}</h2>
              {selectedVault.description && (
                <p className="text-gray-400 text-sm">{selectedVault.description}</p>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setShowAddCastModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            ➕ Add Cast
          </button>
        </div>

        {/* Vault Stats */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{vaultCasts.length}</div>
              <div className="text-sm text-gray-400">Casts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {selectedVault.is_public ? 'Public' : 'Private'}
              </div>
              <div className="text-sm text-gray-400">Visibility</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {new Date(selectedVault.created_at).toLocaleDateString()}
              </div>
              <div className="text-sm text-gray-400">Created</div>
            </div>
          </div>
        </div>

        {/* Vault Casts */}
        {vaultCasts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-white mb-2">Empty Vault</h3>
            <p className="text-gray-400 mb-4">Start adding casts to organize your collection</p>
            <button
              onClick={() => setShowAddCastModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Add Your First Cast
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {vaultCasts.map((cast) => (
              <CastCard key={cast.id} cast={cast} />
            ))}
          </div>
        )}

        {/* Add Cast Modal */}
        {showAddCastModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Add Cast to {selectedVault.name}</h3>
                <button
                  onClick={() => setShowAddCastModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search your casts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Cast List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredCasts.map((cast) => (
                  <div
                    key={cast.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => handleAddCastToVault(cast.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white mb-1">
                          @{cast.username}
                        </div>
                        <div className="text-sm text-gray-300 line-clamp-2">
                          {cast.cast_content}
                        </div>
                        {cast.tags && cast.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {cast.tags.slice(0, 3).map(tag => (
                              <span
                                key={tag}
                                className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-purple-400 ml-3">+</div>
                    </div>
                  </div>
                ))}
                
                {filteredCasts.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-gray-400">No casts found</div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddCastModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Cast Vaults</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          ➕ New Vault
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Create New Vault</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Vault Name *
              </label>
              <input
                type="text"
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                placeholder="e.g., Crypto Insights, AI Articles, Memes..."
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={newVaultDescription}
                onChange={(e) => setNewVaultDescription(e.target.value)}
                placeholder="Describe what you'll collect in this vault..."
                rows={2}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vault-public"
                checked={newVaultPublic}
                onChange={(e) => setNewVaultPublic(e.target.checked)}
                className="rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="vault-public" className="text-sm text-gray-300">
                Make this vault public
              </label>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => {
                setShowCreateForm(false)
                setNewVaultName('')
                setNewVaultDescription('')
                setNewVaultPublic(false)
                setError(null) // Clear any errors when canceling
              }}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateVault}
              disabled={!newVaultName.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
            >
              Create Vault
            </button>
          </div>
        </div>
      )}

      {/* Vaults Grid */}
      {vaults.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🗂️</div>
          <h3 className="text-xl font-semibold text-white mb-2">No vaults yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first vault to start organizing your saved casts into collections
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Create Your First Vault
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaults.map((vault) => (
            <div
              key={vault.id}
              onClick={() => handleSelectVault(vault)}
              className="bg-white/5 border border-white/20 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-white line-clamp-1">{vault.name}</h3>
                <div className="text-xs text-gray-400">
                  {vault.is_public ? '🌐' : '🔒'}
                </div>
              </div>
              
              {vault.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{vault.description}</p>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-300">{vault.castCount} casts</span>
                <span className="text-gray-500">
                  {new Date(vault.created_at).toLocaleDateString()}
                </span>
              </div>
              
              {vault.recentCasts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-gray-400 mb-2">Recent:</div>
                  <div className="space-y-1">
                    {vault.recentCasts.slice(0, 2).map((cast) => (
                      <div key={cast.id} className="text-xs text-gray-300 line-clamp-1">
                        @{cast.username}: {cast.cast_content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}