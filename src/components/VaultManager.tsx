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

  // Auto-create vaults from tags
  const autoCreateVaultsFromTags = useCallback(async () => {
    try {
      console.log('🏗️ Auto-creating vaults from tags...')
      
      // Get all user casts to analyze tags
      const userCasts = await CastService.getUserCasts(userId, 1000)
      const existingVaults = await CollectionService.getUserCollections(userId)
      const existingVaultNames = new Set(existingVaults.map(v => v.name.toLowerCase()))
      
      // Collect all unique tags
      const allTags = new Set<string>()
      
      userCasts.forEach(cast => {
        // Manual tags
        const manualTags = (cast.tags || []).filter(tag => 
          tag !== 'saved-via-bot' && // Exclude system tags
          tag.length > 1 && // Must be more than 1 character
          tag.length < 50 // Reasonable length limit
        )
        
        // AI tags
        const aiTags = cast.parsed_data?.ai_tags || []
        
        // Hashtags (but clean them up)
        const hashtags = (cast.parsed_data?.hashtags || []).filter(tag =>
          tag.length > 1 && tag.length < 50
        )
        
        // Add all valid tags
        const allValidTags = [...manualTags, ...aiTags, ...hashtags]
        allValidTags.forEach(tag => {
          const cleanTag = tag.toLowerCase().trim()
          if (cleanTag && !existingVaultNames.has(cleanTag)) {
            allTags.add(cleanTag)
          }
        })
      })
      
      console.log(`📊 Found ${allTags.size} unique tags to create vaults for`)
      
      // Create vaults for each unique tag
      const createdVaults: Collection[] = []
      
      for (const tag of Array.from(allTags)) {
        try {
          // Create vault with tag name
          const vault = await CollectionService.createCollection(
            tag,
            `Auto-created vault for all casts tagged with "${tag}"`,
            userId,
            false
          )
          
          createdVaults.push(vault)
          console.log(`✅ Created vault: ${tag}`)
          
          // Find all casts with this tag and add them to the vault
          const castsWithTag = userCasts.filter(cast => {
            const allCastTags = [
              ...(cast.tags || []),
              ...(cast.parsed_data?.ai_tags || []),
              ...(cast.parsed_data?.hashtags || [])
            ].map(t => t.toLowerCase())
            
            return allCastTags.includes(tag)
          })
          
          // Add casts to vault
          for (const cast of castsWithTag) {
            try {
              await CollectionService.addCastToCollection(cast.id, vault.id)
            } catch (addError) {
              console.error(`Error adding cast to vault ${tag}:`, addError)
            }
          }
          
          console.log(`📁 Added ${castsWithTag.length} casts to vault "${tag}"`)
          
        } catch (createError) {
          console.error(`Error creating vault for tag "${tag}":`, createError)
        }
      }
      
      console.log(`🎉 Auto-created ${createdVaults.length} vaults from tags`)
      
      return createdVaults
      
    } catch (error) {
      console.error('❌ Error in auto-vault creation:', error)
      return []
    }
  }, [userId])

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
      
      // Extract the actual SavedCast objects from the response
      const casts = castCollections
        .map(cc => cc.saved_casts)
        .filter(cast => cast !== null && cast !== undefined)
      
      console.log('✅ Processed casts:', casts.length)
      setVaultCasts(casts)
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
                onClick={() => handleSelectVault(vault)}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 transition-all hover:bg-white/15 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                    🗄️ {vault.name}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {vault.is_public ? '🌍' : '🔒'}
                  </span>
                </div>
                
                {vault.description && (
                  <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                    {vault.description}
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
      <AITaggingPanel userId={userId} onRetagComplete={fetchVaults} />
    </div>
  )
}