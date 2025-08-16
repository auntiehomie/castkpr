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
        console.log('🔗 ShareExtensionHandler initializing...')
        
        // Wait for SDK to be ready
        await sdk.actions.ready()
        console.log('✅ SDK ready')
        
        // Get context
        const context = await sdk.context
        console.log('📱 Context:', context.location?.type)
        
        // Check if we're in a share context
        if (context.location?.type === 'cast_share') {
          console.log('🎯 Share extension detected!')
          setProcessing(true)
          
          const sharedCast = context.location.cast
          const currentUser = context.user
          
          console.log('📤 Shared cast:', {
            hash: sharedCast.hash,
            author: sharedCast.author.username,
            content: sharedCast.text.substring(0, 50) + '...'
          })
          console.log('👤 Current user:', {
            username: currentUser.username,
            fid: currentUser.fid
          })
          
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

          console.log('💾 Attempting to save cast...')

          // Save the cast
          await CastService.saveCast(castData)
          
          console.log('✅ Cast saved successfully!')
          setResult('Cast saved successfully! 🎉')
          
          // Auto-redirect to dashboard after a delay
          setTimeout(() => {
            console.log('🔄 Redirecting to dashboard...')
            window.location.href = '/dashboard'
          }, 2000)
          
        } else {
          console.log('📱 Not a share context, context type:', context.location?.type)
          console.log('📱 Available location types:', Object.keys(context.location || {}))
        }
      } catch (error) {
        console.error('❌ Error in ShareExtensionHandler:', error)
        
        // Handle specific error cases
        if (error instanceof Error) {
          if (error.message.includes('already saved')) {
            console.log('💡 Cast already saved, showing friendly message')
            setResult('This cast is already in your collection! 📚')
            // Still redirect to dashboard to show the existing cast
            setTimeout(() => {
              console.log('🔄 Redirecting to dashboard (already saved)...')
              window.location.href = '/dashboard'
            }, 2000)
          } else {
            console.error('💥 Unexpected error:', error.message)
            setResult('Failed to save cast: ' + error.message)
          }
        } else {
          console.error('💥 Unknown error type:', error)
          setResult('Failed to save cast: Unknown error')
        }
      } finally {
        setProcessing(false)
      }
    }

    // Small delay to ensure SDK is fully initialized
    const timer = setTimeout(handleSharedCast, 100)
    
    return () => clearTimeout(timer)
  }, [])

  if (processing) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/90 via-blue-900/90 to-indigo-900/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center max-w-md mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Saving Cast...</h2>
          <p className="text-gray-300">Processing your shared cast</p>
        </div>
      </div>
    )
  }

  if (result) {
    const isSuccess = result.includes('successfully') || result.includes('already in your collection')
    const isAlreadySaved = result.includes('already in your collection')
    
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/90 via-blue-900/90 to-indigo-900/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center max-w-md mx-4">
          <div className="text-4xl mb-4">
            {isSuccess ? (isAlreadySaved ? '📚' : '🎉') : '❌'}
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{result}</h2>
          {isSuccess && (
            <>
              <p className="text-gray-300 mb-4">
                {isAlreadySaved 
                  ? 'Taking you to your saved casts...'
                  : 'Redirecting to dashboard...'
                }
              </p>
              <div className="flex items-center justify-center">
                <div className="animate-pulse text-purple-400">●</div>
                <div className="animate-pulse text-purple-400 mx-1" style={{ animationDelay: '0.5s' }}>●</div>
                <div className="animate-pulse text-purple-400" style={{ animationDelay: '1s' }}>●</div>
              </div>
            </>
          )}
          {!isSuccess && (
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}