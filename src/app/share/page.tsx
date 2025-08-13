'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { sdk } from '@farcaster/miniapp-sdk'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

interface SharedCastData {
  castHash?: string
  castFid?: string
  viewerFid?: string
}

interface EnrichedCastData {
  hash: string
  text: string
  author: {
    fid: number
    username?: string
    displayName?: string
    pfpUrl?: string
  }
  timestamp?: number
  embeds?: string[]
  mentions?: Array<{ username?: string; fid?: number }>
  channelKey?: string
}

function ShareContent() {
  const searchParams = useSearchParams()
  const [urlParams, setUrlParams] = useState<SharedCastData | null>(null)
  const [enrichedCast, setEnrichedCast] = useState<EnrichedCastData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeShare = async () => {
      try {
        console.log('🎯 Share page initializing...')
        
        // 1. Get URL parameters (available immediately)
        const castHash = searchParams?.get('castHash')
        const castFid = searchParams?.get('castFid')
        const viewerFid = searchParams?.get('viewerFid')

        console.log('📨 URL Parameters:', { castHash, castFid, viewerFid })

        if (castHash) {
          setUrlParams({ castHash, castFid: castFid || undefined, viewerFid: viewerFid || undefined })
        }

        // 2. Initialize Mini App SDK
        await sdk.actions.ready()
        console.log('✅ SDK ready')

        // 3. Check for enriched cast data from share extension
        if (sdk.context.location?.type === 'cast_share') {
          const sharedCast = sdk.context.location.cast
          console.log('✨ Got enriched cast data from SDK:', sharedCast)
          
          setEnrichedCast({
            hash: sharedCast.hash,
            text: sharedCast.text,
            author: sharedCast.author,
            timestamp: sharedCast.timestamp,
            embeds: sharedCast.embeds,
            mentions: sharedCast.mentions,
            channelKey: sharedCast.channelKey
          })
        } else {
          console.log('⚠️ No SDK cast data, using URL parameters only')
          
          // Fallback: if we have URL params but no SDK data, try to fetch from API
          if (castHash) {
            console.log('🌐 Attempting to fetch cast data from Neynar...')
            try {
              const response = await fetch(`/api/fetch-cast?hash=${castHash}`)
              if (response.ok) {
                const castData = await response.json()
                setEnrichedCast(castData)
                console.log('✅ Fetched cast data from API')
              } else {
                console.log('⚠️ API fetch failed, using basic data')
              }
            } catch (apiError) {
              console.log('⚠️ API call failed:', apiError)
            }
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

  const handleSaveCast = async () => {
    const castHash = enrichedCast?.hash || urlParams?.castHash
    if (!castHash) return

    setSaving(true)
    setError(null)

    try {
      // Use enriched data if available, fallback to URL params
      const castData = {
        username: enrichedCast?.author.username || `user-${urlParams?.castFid || 'unknown'}`,
        fid: enrichedCast?.author.fid || parseInt(urlParams?.castFid || '0'),
        cast_hash: castHash,
        cast_content: enrichedCast?.text || `🔗 Cast shared to CastKPR - Hash: ${castHash}`,
        cast_timestamp: enrichedCast?.timestamp 
          ? new Date(enrichedCast.timestamp).toISOString() 
          : new Date().toISOString(),
        tags: ['shared-to-app'] as string[],
        likes_count: 0,
        replies_count: 0,
        recasts_count: 0,
        
        cast_url: `https://warpcast.com/~/conversations/${castHash}`,
        author_pfp_url: enrichedCast?.author.pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${urlParams?.castFid || 'default'}`,
        author_display_name: enrichedCast?.author.displayName || enrichedCast?.author.username || `User ${urlParams?.castFid || 'Unknown'}`,
        saved_by_user_id: urlParams?.viewerFid || 'shared-user',
        category: 'shared-cast',
        notes: `📱 Shared to CastKPR on ${new Date().toLocaleDateString()}`,
        parsed_data: {
          urls: enrichedCast?.embeds || [`https://warpcast.com/~/conversations/${castHash}`],
          hashtags: enrichedCast ? [...enrichedCast.text.matchAll(/#(\w+)/g)].map(match => match[1]) : ['cstkpr', 'shared'],
          mentions: enrichedCast?.mentions?.map(m => m.username).filter(Boolean) || [],
          word_count: enrichedCast?.text ? enrichedCast.text.split(' ').length : 0,
          sentiment: 'neutral' as const,
          topics: enrichedCast?.channelKey ? [enrichedCast.channelKey] : ['shared-cast']
        }
      } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>

      console.log('💾 Saving cast:', castData.cast_hash)
      await CastService.saveCast(castData)
      console.log('✅ Cast saved successfully!')
      setSaved(true)
    } catch (err) {
      console.error('❌ Error saving shared cast:', err)
      if (err instanceof Error && err.message.includes('already saved')) {
        setError('This cast is already saved in your vault!')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save cast')
      }
    } finally {
      setSaving(false)
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
  if (!urlParams?.castHash && !enrichedCast) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
          <div className="text-6xl mb-4">🤔</div>
          <h1 className="text-2xl font-bold text-white mb-4">No Cast to Share</h1>
          <p className="text-gray-300">
            This page is for receiving shared casts. Share a cast to CastKPR to see it here!
          </p>
        </div>
      </div>
    )
  }

  // Success state
  if (saved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-4">Cast Saved!</h1>
          <p className="text-gray-300 mb-6">
            Your shared cast has been successfully saved to CastKPR.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              View My Saved Casts
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main share interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            💾 Save to Cast<span className="text-purple-400">KPR</span>
          </h1>
          <p className="text-gray-300">Add this cast to your vault</p>
        </div>

        {/* Cast Preview */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          {enrichedCast ? (
            // Rich cast preview with actual content
            <>
              <div className="flex items-start space-x-3 mb-4">
                {enrichedCast.author.pfpUrl ? (
                  <img 
                    src={enrichedCast.author.pfpUrl} 
                    alt={enrichedCast.author.username}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {enrichedCast.author.username?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-white">
                    {enrichedCast.author.displayName || `@${enrichedCast.author.username}`}
                  </h3>
                  <p className="text-sm text-gray-400">@{enrichedCast.author.username}</p>
                  {enrichedCast.channelKey && (
                    <p className="text-xs text-purple-300">/{enrichedCast.channelKey}</p>
                  )}
                </div>
              </div>
              
              <p className="text-gray-100 leading-relaxed mb-4">
                {enrichedCast.text}
              </p>
              
              {enrichedCast.embeds && enrichedCast.embeds.length > 0 && (
                <div className="text-sm text-blue-300">
                  🔗 {enrichedCast.embeds.length} embed{enrichedCast.embeds.length !== 1 ? 's' : ''}
                </div>
              )}
            </>
          ) : (
            // Basic preview with just hash info
            <div className="text-center">
              <div className="text-4xl mb-3">📝</div>
              <h3 className="font-semibold text-white mb-2">Cast Details</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <p><strong>Hash:</strong> {urlParams?.castHash?.slice(0, 16)}...</p>
                {urlParams?.castFid && <p><strong>Author FID:</strong> {urlParams.castFid}</p>}
                {urlParams?.viewerFid && <p><strong>Shared by FID:</strong> {urlParams.viewerFid}</p>}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleSaveCast}
            disabled={saving}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                💾 Save Cast
              </>
            )}
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
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