'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { sdk } from '@farcaster/miniapp-sdk'
import type { SavedCast } from '@/lib/supabase'

interface SharedCastData {
  castHash?: string
  castFid?: string
  viewerFid?: string
  castContent?: string
  authorDisplayName?: string
  authorUsername?: string
  authorPfpUrl?: string
}

interface MiniAppCast {
  hash: string
  text: string
  author: {
    fid: number
    username?: string
    displayName?: string
    pfpUrl?: string
  }
  timestamp?: number
  mentions?: any[]
  embeds?: string[]
}

function ShareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [castData, setCastData] = useState<SharedCastData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFromSDK, setIsFromSDK] = useState(false)

  useEffect(() => {
    const initializeShare = async () => {
      try {
        console.log('🎯 Share page initializing...')
        
        // Call SDK ready first
        await sdk.actions.ready()
        
        // Await sdk.context to get the actual context object
        const context = await sdk.context

        // Check if this is a Mini App share extension
        if (context.location?.type === 'cast_share') {
          console.log('📱 Mini App share extension detected')
          const cast = context.location.cast
          setIsFromSDK(true)
          setCastData({
            castHash: cast.hash,
            castFid: cast.author.fid.toString(),
            viewerFid: context.user?.fid?.toString(),
            castContent: cast.text,
            authorDisplayName: cast.author.displayName,
            authorUsername: cast.author.username,
            authorPfpUrl: cast.author.pfpUrl
          })
          
          // Auto-save from SDK
          await saveCastFromSDK(cast)
        } else {
          // Check URL parameters as fallback
          console.log('🔗 Checking URL parameters...')
          const castHash = searchParams?.get('castHash')
          const castFid = searchParams?.get('castFid')
          const viewerFid = searchParams?.get('viewerFid')

          console.log('📨 URL Parameters:', { castHash, castFid, viewerFid })

          if (castHash) {
            setCastData({ 
              castHash, 
              castFid: castFid || undefined, 
              viewerFid: viewerFid || undefined 
            })
          }
        }

      } catch (err) {
        console.error('❌ Error initializing share:', err)
        setError('Failed to load shared cast')
      } finally {
        setLoading(false)
      }
    }
    
    initializeShare()
  }, [searchParams])

  const saveCastFromSDK = async (cast: MiniAppCast) => {
    setSaving(true)
    setError(null)

    try {
      console.log('💾 Saving cast via SDK:', cast.hash)
      
      const response = await fetch('/api/save-shared-cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          castData: cast,
          userId: cast?.author?.fid?.toString() || 'demo-user'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Cast saved successfully via SDK')
        setSaved(true)
      } else {
        console.log('⚠️ Cast save failed:', data.message)
        setError(data.message)
      }
    } catch (err) {
      console.error('❌ Error saving cast via SDK:', err)
      setError('Failed to save cast. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCast = async () => {
    if (!castData?.castHash) return

    setSaving(true)
    setError(null)

    try {
      console.log('💾 Saving cast via URL params:', castData.castHash)
      
      // Create cast object for API
      const apiCastData = {
        hash: castData.castHash,
        text: castData.castContent || `🔗 Cast shared to CastKPR - Hash: ${castData.castHash}`,
        author: {
          fid: parseInt(castData.castFid || '0'),
          username: castData.authorUsername || `user-${castData.castFid || 'unknown'}`,
          displayName: castData.authorDisplayName || `User ${castData.castFid || 'Unknown'}`,
          pfpUrl: castData.authorPfpUrl
        },
        timestamp: Date.now(),
        mentions: [],
        embeds: []
      }

      const response = await fetch('/api/save-shared-cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          castData: apiCastData,
          userId: castData.viewerFid || 'demo-user'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Cast saved successfully via URL')
        setSaved(true)
      } else {
        console.log('⚠️ Cast save failed:', data.message)
        setError(data.message)
      }
    } catch (err) {
      console.error('❌ Error saving cast via URL:', err)
      if (err instanceof Error && err.message.includes('already saved')) {
        setError('This cast is already in your collection!')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save cast')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleNavigation = (path: string) => {
    if (isFromSDK) {
      // For Mini App, close the app
      sdk.actions.close()
    } else {
      // For web, use Next.js router
      router.push(path)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white">Loading shared cast...</p>
        </div>
      </div>
    )
  }

  // No cast data
  if (!castData?.castHash) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center max-w-md">
          <div className="text-6xl mb-4">🤔</div>
          <h1 className="text-2xl font-bold text-white mb-4">No Cast to Save</h1>
          <p className="text-gray-300 mb-4">
            This page is for receiving shared casts. Share a cast to CastKPR to see it here!
          </p>
          <div className="space-y-3">
            <button
              onClick={() => handleNavigation('/dashboard')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              📚 View Dashboard
            </button>
            <button
              onClick={() => handleNavigation('/')}
              className="w-full bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              🏠 Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (saved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-4">Cast Saved!</h1>
          <p className="text-gray-300 mb-6">
            Your cast has been saved to CastKPR! You can now organize it into vaults using tags and categories.
          </p>
          
          {/* Show saved cast preview if we have content */}
          {castData.castContent && (
            <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/10">
              <div className="flex items-start gap-3 mb-3">
                {castData.authorPfpUrl ? (
                  <img 
                    src={castData.authorPfpUrl} 
                    alt={castData.authorUsername}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {castData.authorUsername?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="text-left">
                  <h3 className="font-semibold text-white text-sm">
                    {castData.authorDisplayName || `@${castData.authorUsername}`}
                  </h3>
                  <p className="text-xs text-gray-400">@{castData.authorUsername}</p>
                </div>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed text-left line-clamp-3">
                {castData.castContent}
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={() => handleNavigation('/dashboard')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              📚 View Saved Casts
            </button>
            {isFromSDK ? (
              <button
                onClick={() => sdk.actions.close()}
                className="w-full bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            ) : (
              <button
                onClick={() => handleNavigation('/')}
                className="w-full bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🏠 Go Home
              </button>
            )}
          </div>
          
          {/* Next Steps Hint */}
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <h3 className="text-purple-300 font-medium mb-2">💡 What's Next?</h3>
            <p className="text-purple-200 text-sm">
              {isFromSDK 
                ? "Your cast is now saved! Open CastKPR to organize it into vaults or use AI to analyze your collection."
                : "Add tags to organize this cast into vaults, or use the AI bot to analyze and get insights about your saved content!"
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Main share interface (for URL-based sharing or manual save)
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            💾 Save Cast to Cast<span className="text-purple-400">KPR</span>
          </h1>
          <p className="text-gray-300">
            {isFromSDK ? "Cast shared via Mini App" : "Add this cast to your collection"}
          </p>
        </div>

        {/* Cast Preview */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          {castData.castContent ? (
            // Rich preview if we have content
            <div>
              <div className="flex items-start gap-3 mb-4">
                {castData.authorPfpUrl ? (
                  <img 
                    src={castData.authorPfpUrl} 
                    alt={castData.authorUsername}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {castData.authorUsername?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="text-left">
                  <h3 className="font-semibold text-white">
                    {castData.authorDisplayName || `@${castData.authorUsername}`}
                  </h3>
                  <p className="text-sm text-gray-400">@{castData.authorUsername}</p>
                </div>
              </div>
              <p className="text-gray-200 leading-relaxed text-left mb-4">{castData.castContent}</p>
              <div className="text-xs text-gray-400 bg-white/5 rounded p-2">
                <p><strong>Hash:</strong> <code className="text-purple-300">{castData.castHash?.slice(0, 16)}...</code></p>
              </div>
            </div>
          ) : (
            // Basic preview for URL params
            <div className="text-center">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-semibold text-white mb-3">Ready to Save Cast</h3>
              <div className="text-sm text-gray-300 space-y-2 bg-white/5 rounded-lg p-4">
                <p><strong>Hash:</strong> <code className="text-purple-300">{castData.castHash?.slice(0, 16)}...</code></p>
                {castData.castFid && <p><strong>Author FID:</strong> {castData.castFid}</p>}
                {castData.viewerFid && <p><strong>Shared by FID:</strong> {castData.viewerFid}</p>}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                💡 Cast content will be fetched and parsed automatically
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Save button only shows if we haven't auto-saved from SDK */}
        {!isFromSDK && (
          <div className="space-y-3">
            <button
              onClick={handleSaveCast}
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving Cast...
                </>
              ) : (
                <>
                  💾 Save Cast
                </>
              )}
            </button>
            <button
              onClick={() => handleNavigation('/')}
              className="w-full bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        
        {/* Auto-saving indicator for SDK */}
        {isFromSDK && saving && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-3"></div>
            <p className="text-gray-300">Saving cast automatically...</p>
          </div>
        )}
        
        {/* Data Flow Explanation */}
        <div className="mt-6 bg-white/5 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2 text-sm">🔄 How CastKPR Works</h4>
          <div className="text-xs text-gray-400 space-y-1">
            <p>1. 📱 <strong>Share Extension:</strong> Save any cast instantly</p>
            <p>2. 🏷️ <strong>Tags & Organization:</strong> Add tags to create vaults</p>
            <p>3. 🤖 <strong>AI Analysis:</strong> Get insights from your collection</p>
            <p>4. 🗂️ <strong>Smart Vaults:</strong> Organize content automatically</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
        <p className="text-white">Loading shared cast...</p>
      </div>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ShareContent />
    </Suspense>
  )
}