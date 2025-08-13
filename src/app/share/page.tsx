'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

interface SharedCastData {
  castHash?: string
  castFid?: string
  viewerFid?: string
}

function ShareContent() {
  const searchParams = useSearchParams()
  const [urlParams, setUrlParams] = useState<SharedCastData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeShare = async () => {
      try {
        console.log('🎯 Share page initializing...')
        
        // Get URL parameters (available immediately)
        const castHash = searchParams?.get('castHash')
        const castFid = searchParams?.get('castFid')
        const viewerFid = searchParams?.get('viewerFid')

        console.log('📨 URL Parameters:', { castHash, castFid, viewerFid })

        if (castHash) {
          setUrlParams({ castHash, castFid: castFid || undefined, viewerFid: viewerFid || undefined })
        }

        // TODO: Add Mini App SDK integration later
        // For now, we'll work with URL parameters and basic functionality

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
    const castHash = urlParams?.castHash
    if (!castHash) return

    setSaving(true)
    setError(null)

    try {
      // For now, use URL parameters and try to fetch content via API
      let castContent = `🔗 Cast shared to CastKPR - Hash: ${castHash}`
      let authorDisplayName = `User ${urlParams?.castFid || 'Unknown'}`
      let authorUsername = `user-${urlParams?.castFid || 'unknown'}`
      
      // Try to fetch actual cast content from Neynar API
      try {
        console.log('🌐 Attempting to fetch cast content...')
        const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`, {
          headers: {
            'api_key': process.env.NEXT_PUBLIC_NEYNAR_API_KEY || 'NEYNAR_API_DOCS'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.cast) {
            castContent = data.cast.text
            authorDisplayName = data.cast.author.display_name || data.cast.author.username
            authorUsername = data.cast.author.username
            console.log('✅ Fetched real cast content!')
          }
        }
      } catch (fetchError) {
        console.log('⚠️ Could not fetch cast content, using placeholder')
      }

      const castData = {
        username: authorUsername,
        fid: parseInt(urlParams?.castFid || '0'),
        cast_hash: castHash,
        cast_content: castContent,
        cast_timestamp: new Date().toISOString(),
        tags: ['shared-via-extension'] as string[],
        likes_count: 0,
        replies_count: 0,
        recasts_count: 0,
        
        cast_url: `https://warpcast.com/~/conversations/${castHash}`,
        author_pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${urlParams?.castFid || 'default'}`,
        author_display_name: authorDisplayName,
        saved_by_user_id: urlParams?.viewerFid || 'shared-user',
        category: 'shared',
        notes: `📱 Saved via share extension on ${new Date().toLocaleDateString()}`,
        parsed_data: {
          urls: [`https://warpcast.com/~/conversations/${castHash}`],
          hashtags: [...castContent.matchAll(/#(\w+)/g)].map(match => match[1]),
          mentions: [...castContent.matchAll(/@(\w+)/g)].map(match => match[1]),
          word_count: castContent.split(' ').length,
          sentiment: 'neutral' as const,
          topics: ['shared']
        }
      } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>

      console.log('💾 Saving cast to collection:', castData.cast_hash)
      await CastService.saveCast(castData)
      console.log('✅ Cast saved successfully!')
      setSaved(true)
    } catch (err) {
      console.error('❌ Error saving shared cast:', err)
      if (err instanceof Error && err.message.includes('already saved')) {
        setError('This cast is already in your collection!')
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
  if (!urlParams?.castHash) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
          <div className="text-6xl mb-4">🤔</div>
          <h1 className="text-2xl font-bold text-white mb-4">No Cast to Save</h1>
          <p className="text-gray-300 mb-4">
            This page is for receiving shared casts. Share a cast to CastKPR to see it here!
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Go Home
          </button>
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
            Your cast has been saved to CastKPR! You can now organize it into vaults using tags and categories.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              📚 View Saved Casts
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              🏠 Go Home
            </button>
          </div>
          
          {/* Next Steps Hint */}
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <h3 className="text-purple-300 font-medium mb-2">💡 What's Next?</h3>
            <p className="text-purple-200 text-sm">
              Add tags to organize this cast into vaults, or use the AI bot to analyze and get insights about your saved content!
            </p>
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
            💾 Save Cast to Cast<span className="text-purple-400">KPR</span>
          </h1>
          <p className="text-gray-300">Add this cast to your collection</p>
        </div>

        {/* Cast Preview */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-semibold text-white mb-3">Ready to Save Cast</h3>
            <div className="text-sm text-gray-300 space-y-2 bg-white/5 rounded-lg p-4">
              <p><strong>Hash:</strong> <code className="text-purple-300">{urlParams?.castHash?.slice(0, 16)}...</code></p>
              {urlParams?.castFid && <p><strong>Author FID:</strong> {urlParams.castFid}</p>}
              {urlParams?.viewerFid && <p><strong>Shared by FID:</strong> {urlParams.viewerFid}</p>}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              💡 Cast content will be fetched and parsed automatically
            </p>
          </div>
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
                Saving Cast...
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
        
        {/* Data Flow Explanation */}
        <div className="mt-6 bg-white/5 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2 text-sm">🔄 How CastKPR Works</h4>
          <div className="text-xs text-gray-400 space-y-1">
            <p>1. 📱 <strong>Share Extension:</strong> Save any cast instantly</p>
            <p>2. 🏷️ <strong>Tags & Organization:</strong> Add tags to create vaults</p>
            <p>3. 🤖 <strong>AI Analysis:</strong> Get insights from your collection</p>
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