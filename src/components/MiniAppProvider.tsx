'use client'

import { useEffect, useState } from 'react'

export default function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  useEffect(() => {
    async function initializeMiniApp() {
      try {
        // Add timeout to prevent hanging
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), 5000)
        )
        
        const initPromise = (async () => {
          // Dynamic import to avoid SSR issues
          const { sdk } = await import('@farcaster/miniapp-sdk')
          
          // Check if we're in a Mini App environment
          const isMiniApp = await sdk.isInMiniApp()
          
          if (isMiniApp) {
            console.log('🎯 Running in Mini App environment')
            // Hide the splash screen
            await sdk.actions.ready()
            console.log('✅ Mini App ready called')
          } else {
            console.log('🌐 Running in regular browser')
          }
        })()
        
        // Race between initialization and timeout
        await Promise.race([initPromise, timeout])
        
        setIsReady(true)
      } catch (error) {
        console.error('❌ Error initializing Mini App (attempt ' + (retryCount + 1) + '):', error)
        
        if (retryCount < maxRetries) {
          // Retry after a short delay
          setTimeout(() => {
            setRetryCount(prev => prev + 1)
          }, 1000)
        } else {
          // Give up and continue
          console.log('⚠️ Max retries reached, continuing without SDK initialization')
          setIsReady(true)
        }
      }
    }

    if (!isReady && retryCount <= maxRetries) {
      initializeMiniApp()
    }
  }, [isReady, retryCount])

  // Show loading state briefly to avoid flash
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white text-sm">Loading CastKPR...</p>
          {retryCount > 0 && (
            <p className="text-purple-300 text-xs mt-2">Retrying... ({retryCount}/{maxRetries})</p>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}