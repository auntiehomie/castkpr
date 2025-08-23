'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sdk } from '@farcaster/miniapp-sdk'
import { CastService, ContentParser } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'
import Link from 'next/link'

export default function SharePage() {
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [savedCast, setSavedCast] = useState<SavedCast | null>(null)
  const router = useRouter()

  useEffect(() => {
    const handleSharedCast = async () => {
      try {
        console.log('🔗 Share page loading...')
        
        // Wait for SDK to be ready
        await sdk.actions.ready()
        console.log('✅ SDK ready')
        
        // Get context
        const context = await sdk.context
        console.log('📱 Context type:', context.location?.type)
        
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
          
          // Transform embeds to the expected format for parsing
          const embedsForParser = sharedCast.embeds?.map((embed: any) => ({
            url: typeof embed === 'string' ? embed : embed?.url
          })) || []
          
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
            likes_count: 0,
            replies_count: 0,
            recasts_count: 0,
            parsed_data: ContentParser.parseContent(sharedCast.text, embedsForParser),
            notes: `💾 Saved via share extension on ${new Date().toLocaleDateString()}`
          } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>

          console.log('💾 Attempting to save cast...')

          try {
            const saved = await CastService.saveCast(castData)
            setSavedCast(saved)
            setResult('Cast saved successfully! 🎉')
            console.log('✅ Cast saved successfully!')
          } catch (saveError) {
            if (saveError instanceof Error && saveError.message.includes('already saved')) {
              console.log('💡 Cast already saved, showing friendly message')
              setResult('This cast is already in your collection! 📚')
            } else {
              throw saveError
            }
          }
          
        } else {
          console.log('📱 Not a share context, redirecting to home')
          setResult('No cast to save - redirecting to home')
          setTimeout(() => {
            router.push('/')
          }, 1000)
        }
      } catch (error) {
        console.error('❌ Error saving shared cast:', error)
        setResult('Failed to save cast: ' + (error instanceof Error ? error.message : 'Unknown error'))
      } finally {
        setProcessing(false)
      }
    }

    handleSharedCast()
  }, [router])

  const handleClose = async () => {
    try {
      console.log('🔄 Closing mini app...')
      await sdk.actions.close()
    } catch (error) {
      console.error('❌ Error closing mini app:', error)
      // Fallback to home page
      router.push('/')
    }
  }

  const handleViewDashboard = () => {
    console.log('🔄 Navigating to dashboard...')
    router.push('/Dashboard') // ✅ FIXED: Changed from /dashboard to /Dashboard
  }

  if (processing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Saving Cast...</h2>
          <p className="text-gray-300">Processing your shared cast</p>
        </div>
      </div>
    )
  }

  const isSuccess = result?.includes('successfully') || result?.includes('already in your collection')
  const isAlreadySaved = result?.includes('already in your collection')

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center max-w-md">
        <div className="text-4xl mb-4">
          {isSuccess ? (isAlreadySaved ? '📚' : '🎉') : '❌'}
        </div>
        
        <h2 className="text-xl font-bold text-white mb-4">{result}</h2>
        
        {isSuccess && (
          <div className="space-y-4">
            <p className="text-gray-300">
              {isAlreadySaved 
                ? 'This cast is already in your collection.'
                : 'Your cast has been saved successfully!'
              }
            </p>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleViewDashboard}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                View Saved Casts
              </button>
              <button
                onClick={handleClose}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
        
        {!isSuccess && (
          <div className="space-y-4">
            <p className="text-gray-300">Something went wrong while saving your cast.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleViewDashboard}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={handleClose}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}