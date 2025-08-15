// src/components/ShareExtensionHandler.tsx
'use client'

import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { CastService, ContentParser } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

export default function ShareExtensionHandler() {
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    const handleSharedCast = async () => {
      try {
        // Check if we're in a share context
        const context = await sdk.context;
        if (context.location?.type === 'cast_share') {
          setProcessing(true)
          const sharedCast = context.location.cast;
          const currentUser = context.user;
          
          // Create cast data for saving
          const castData = {
            username: sharedCast.author.username || `fid-${sharedCast.author.fid}`,
            fid: sharedCast.author.fid,
            cast_hash: sharedCast.hash,
            cast_content: sharedCast.text,
            cast_timestamp: sharedCast.timestamp ? new Date(sharedCast.timestamp).toISOString() : new Date().toISOString(),
            cast_url: `https://warpcast.com/~/conversations/${sharedCast.hash}`,
            author_pfp_url: sharedCast.author.pfpUrl,
            author_display_name: sharedCast.author.displayName,
            saved_by_user_id: currentUser.username || `fid-${currentUser.fid}`,
            tags: ['shared-via-extension', ...(sharedCast.channelKey ? [sharedCast.channelKey] : [])],
            likes_count: 0, // These aren't available in share context
            replies_count: 0,
            recasts_count: 0,
            parsed_data: ContentParser.parseContent(sharedCast.text),
            notes: `💾 Saved via share extension on ${new Date().toLocaleDateString()}`
          } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>

          // Save the cast
          await CastService.saveCast(castData)
          setResult('Cast saved successfully! 🎉')
          
          // Auto-redirect to dashboard after a delay
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 2000)
          
        }
      } catch (error) {
        console.error('Error saving shared cast:', error)
        setResult('Failed to save cast: ' + (error instanceof Error ? error.message : 'Unknown error'))
      } finally {
        setProcessing(false)
      }
    }

    handleSharedCast()
  }, [])

  if (processing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Saving Cast...</h2>
          <p className="text-gray-300">Processing your shared cast</p>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
          <div className="text-4xl mb-4">{result.includes('successfully') ? '🎉' : '❌'}</div>
          <h2 className="text-xl font-bold text-white mb-2">{result}</h2>
          {result.includes('successfully') && (
            <p className="text-gray-300">Redirecting to dashboard...</p>
          )}
        </div>
      </div>
    )
  }

  return null
}