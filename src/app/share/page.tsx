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
  const [sharedCast, setSharedCast] = useState<SharedCastData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get cast data from URL parameters
    const castHash = searchParams?.get('castHash')
    const castFid = searchParams?.get('castFid')
    const viewerFid = searchParams?.get('viewerFid')

    if (castHash) {
      setSharedCast({
        castHash,
        castFid: castFid || undefined,
        viewerFid: viewerFid || undefined
      })
    }
  }, [searchParams])

  const handleSaveCast = async () => {
    if (!sharedCast?.castHash) return

    setSaving(true)
    setError(null)

    try {
      // Create cast data for saving
      const castData = {
        username: `user-${sharedCast.castFid || 'unknown'}`,
        fid: parseInt(sharedCast.castFid || '0'),
        cast_hash: sharedCast.castHash,
        cast_content: `🔗 Cast shared to CastKPR - Hash: ${sharedCast.castHash}`,
        cast_timestamp: new Date().toISOString(),
        tags: ['shared-to-app'] as string[],
        likes_count: 0,
        replies_count: 0,
        recasts_count: 0,
        
        cast_url: `https://warpcast.com/~/conversations/${sharedCast.castHash}`,
        author_pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${sharedCast.castFid || 'default'}`,
        author_display_name: `User ${sharedCast.castFid || 'Unknown'}`,
        saved_by_user_id: sharedCast.viewerFid || 'shared-user',
        category: 'shared-cast',
        notes: `📱 Shared to CastKPR on ${new Date().toLocaleDateString()}`,
        parsed_data: {
          urls: [`https://warpcast.com/~/conversations/${sharedCast.castHash}`],
          hashtags: ['cstkpr', 'shared'],
          mentions: [],
          word_count: 0,
          sentiment: 'neutral' as const,
          topics: ['shared-cast']
        }
      } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>

      await CastService.saveCast(castData)
      setSaved(true)
    } catch (err) {
      console.error('Error saving shared cast:', err)
      setError(err instanceof Error ? err.message : 'Failed to save cast')
    } finally {
      setSaving(false)
    }
  }

  if (!sharedCast) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center max-w-md">
        <div className="text-6xl mb-4">📱</div>
        <h1 className="text-2xl font-bold text-white mb-4">Save Shared Cast</h1>
        <p className="text-gray-300 mb-6">
          A cast has been shared to CastKPR. Would you like to save it to your collection?
        </p>
        
        {/* Cast Info */}
        <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-white mb-2">Cast Details:</h3>
          <div className="text-sm text-gray-300 space-y-1">
            <p><strong>Hash:</strong> {sharedCast.castHash?.slice(0, 16)}...</p>
            {sharedCast.castFid && <p><strong>Author FID:</strong> {sharedCast.castFid}</p>}
            {sharedCast.viewerFid && <p><strong>Shared by FID:</strong> {sharedCast.viewerFid}</p>}
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