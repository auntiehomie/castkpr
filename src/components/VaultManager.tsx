'use client'

import { useState, useEffect, useCallback } from 'react'
import { CollectionService, CastService } from '@/lib/supabase'
import type { Collection, SavedCast } from '@/lib/supabase'
import CastCard from './CastCard'
import AITaggingPanel from './AITaggingPanel'

interface VaultManagerProps {
  userId: string
}

export default function VaultManager({ userId }: VaultManagerProps) {
  const [vaults, setVaults] = useState<Collection[]>([])
  const [selectedVault, setSelectedVault] = useState<Collection | null>(null)
  const [vaultCasts, setVaultCasts] = useState<SavedCast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newVaultName, setNewVaultName] = useState('')
  const [newVaultDescription, setNewVaultDescription] = useState('')
  const [allCasts, setAllCasts] = useState<SavedCast[]>([])
  const [showAddCasts, setShowAddCasts] = useState(false)
  const [editingVault, setEditingVault] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [deletingVault, setDeletingVault] = useState<string | null>(null)

  const fetchVaults = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Fetching vaults for user:', userId)
      
      // Just fetch vaults - don't auto-create here
      const userVaults = await CollectionService.getUserCollections(userId)
      console.log('✅ Found vaults:', userVaults.length)
      setVaults(userVaults)
    } catch (err) {
      console.error('❌ Error fetching vaults:', err)
      setError('Failed to load vaults')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchVaultCasts = useCallback(async (vaultId: string) => {
    try {
      console.log('🔍 Fetching casts for vault:', vaultId)
      setError(null)
      
      const castCollections = await CollectionService.getCollectionCasts(vaultId)
      console.log('📊 Raw vault casts data:', castCollections)
      
      // Extract and flatten the actual SavedCast objects from the response
      const casts = castCollections
        .map(cc => cc.saved_casts)
        .flat() // ✅ Flatten the arrays
        .filter(cast => cast !== null && cast !== undefined) as SavedCast[]
      
      console.log('✅ Processed casts:', casts.length)
      setVaultCasts(casts) // Now it's guaranteed to be SavedCast[]
    } catch (err) {
      console.error('❌ Error fetching vault casts:', err)
      console.error('❌ Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        vaultId: vaultId,
        stack: err instanceof Error ? err.stack : undefined
      })
      setError(`Failed to load vault casts: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setVaultCasts([]) // Set empty array on error
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
    fetchVaults()
  }, [fetchVaults])

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newVaultName.trim()) return

    try {
      console.log('🆕 Creating vault:', newVaultName, 'for user:', userId)
      await CollectionService.createCollection(
        newVaultName,
        newVaultDescription,
        userId,
        false
      )
      
      setNewVaultName('')
      setNewVaultDescription('')
      setShowCreateForm(false)
      await fetchVaults()
    } catch (err) {
      console.error('Error creating vault:', err)
      setError('Failed to create vault')
    }
  }

  const handleSelectVault = async (vault: Collection) => {
    setSelectedVault(vault)
    await fetchVaultCasts(vault.id)
  }

  const handleAddCastToVault = async (castId: string) => {
    if (!selectedVault) return

    try {
      await CollectionService.addCastToCollection(castId, selectedVault.id)
      await fetchVaultCasts(selectedVault.id)
      setShowAddCasts(false)
    } catch (err) {
      console.error('Error adding cast to vault:', err)
      setError('Failed to add cast to vault')
    }
  }

  const handleShowAddCasts = async () => {
    await fetchAllCasts()
    setShowAddCasts(true)
  }

  const startEditingVault = (vault: Collection) => {
    setEditingVault(vault.id)
    setEditDescription(vault.description || '')
  }

  const cancelEditingVault = () => {
    setEditingVault(null)
    setEditDescription('')
  }

  const saveVaultDescription = async (vaultId: string) => {
    try {
      // Note: This assumes you have an updateCollection method
      // If not, you may need to add it to CollectionService
      await CollectionService.updateCollection(vaultId, userId, {
        description: editDescription
      })
      
      // Update local state
      setVaults(prev => prev.map(vault => 
        vault.id === vaultId 
          ? { ...vault, description: editDescription }
          : vault
      ))
      
      setEditingVault(null)
      setEditDescription('')
    } catch (err) {
      console.error('Error updating vault description:', err)
      setError('Failed to update vault description')
    }
  }

  const confirmDeleteVault = (vaultId: string) => {
    setDeletingVault(vaultId)
  }

  const cancelDeleteVault = () => {
    setDeletingVault(null)
  }

  const deleteVault = async (vaultId: string) => {
    try {
      await CollectionService.deleteCollection(vaultId, userId)
      
      // Update local state
      setVaults(prev => prev.filter(vault => vault.id !== vaultId))
      setDeletingVault(null)
      
      // If we were viewing this vault, go back to vault list
      if (selectedVault?.id === vaultId) {
        setSelectedVault(null)
      }
      
    } catch (err) {
      console.error('Error deleting vault:', err)
      setError('Failed to delete vault')
      setDeletingVault(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Vaults</h2>
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
            onClick={fetchVaults}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            type="button"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Show vault details view
  if (selectedVault) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setSelectedVault(null)}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← Back to Vaults
            </button>
            <button
              onClick={handleShowAddCasts}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Add Casts
            </button>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">🗄️ {selectedVault.name}</h2>
          {selectedVault.description && (
            <p className="text-gray-300">{selectedVault.description}</p>
          )}
          <p className="text-sm text-gray-400 mt-2">
            {vaultCasts.length} cast{vaultCasts.length !== 1 ? 's' : ''} in this vault
          </p>
        </div>

        {/* Add casts modal */}
        {showAddCasts && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add Casts to Vault</h3>
              <button
                onClick={() => setShowAddCasts(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-2">
              {allCasts.filter(cast => 
                !vaultCasts.some(cc => cc.id === cast.id)
              ).map(cast => (
                <div key={cast.id} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{cast.cast_content}</p>
                    <p className="text-gray-400 text-xs">@{cast.username}</p>
                  </div>
                  <button
                    onClick={() => handleAddCastToVault(cast.id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vault casts */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          {vaultCasts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🗄️</div>
              <h3 className="text-xl font-semibold text-white mb-2">Empty Vault</h3>
              <p className="text-gray-400 mb-4">This vault doesn&apos;t have any casts yet</p>
              <button
                onClick={handleShowAddCasts}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Your First Cast
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {vaultCasts.map(cast => (
                <CastCard key={cast.id} cast={cast} compact={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main vaults view
  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">🗄️ Vaults</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {showCreateForm ? 'Cancel' : '+ New Vault'}
          </button>
        </div>

        {/* Auto-creation info */}
        <div className="mb-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <h3 className="text-blue-300 font-medium mb-2">✨ Smart Vault Creation</h3>
          <p className="text-blue-200 text-sm">
            Vaults are automatically created from your tags! Every tag becomes a vault that contains all casts with that tag. 
            Manual tags, AI tags, and hashtags all create vaults automatically.
          </p>
        </div>

        {/* Create vault form */}
        {showCreateForm && (
          <form onSubmit={handleCreateVault} className="mb-6 p-4 bg-white/10 rounded-lg">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Vault Name
                </label>
                <input
                  type="text"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
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
                  value={newVaultDescription}
                  onChange={(e) => setNewVaultDescription(e.target.value)}
                  placeholder="What&apos;s this vault about?"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 h-20"
                />
              </div>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Create Vault
              </button>
            </div>
          </form>
        )}

        {/* Vaults grid */}
        {vaults.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🗄️</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Vaults Yet</h3>
            <p className="text-gray-400 mb-6">
              Start adding tags to your casts! Vaults will be created automatically for each tag.
            </p>
            <div className="bg-white/5 rounded-lg p-4 max-w-md mx-auto">
              <h4 className="font-semibold text-white mb-2">How it works:</h4>
              <ol className="text-sm text-gray-300 text-left space-y-1">
                <li>1. Add tags to your saved casts</li>
                <li>2. Vaults are created automatically for each tag</li>
                <li>3. Casts are automatically organized by tags</li>
                <li>4. Or create custom vaults manually</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vaults.map(vault => (
              <div
                key={vault.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 transition-all hover:bg-white/15 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                    🗄️ {vault.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {vault.is_public ? '🌍' : '🔒'}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditingVault(vault)
                        }}
                        className="text-gray-400 hover:text-purple-300 text-xs p-1"
                        title="Edit vault description"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          confirmDeleteVault(vault.id)
                        }}
                        className="text-gray-400 hover:text-red-300 text-xs p-1"
                        title="Delete vault"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
                
                {editingVault === vault.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Add a description or notes for this vault..."
                      className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveVaultDescription(vault.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditingVault}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {vault.description && (
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                        {vault.description}
                      </p>
                    )}
                    
                    <div 
                      className="flex items-center justify-between text-xs text-gray-400 cursor-pointer"
                      onClick={() => handleSelectVault(vault)}
                    >
                      <span>Click to view</span>
                      <span>→</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingVault && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">🗑️ Delete Vault</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this vault? This will remove the vault and all its cast associations, but won&apos;t delete the actual saved casts.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDeleteVault}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteVault(deletingVault)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Delete Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Tagging Panel */}
      <AITaggingPanel userId={userId} onRetagComplete={fetchVaults} />
    </div>
  )
}