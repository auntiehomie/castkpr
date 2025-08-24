'use client'

import { useEffect, useState } from 'react'

export default function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    async function initializeMiniApp() {
      try {
        // Dynamic import to avoid SSR issues
        const { sdk } = await import('@farcaster/miniapp-sdk')
        
        // Check if we're in a Mini App environment
        const isMiniApp = await sdk.isInMiniApp()
        
        if (isMiniApp) {
          console.log('🎯 Running in Mini App environment')
          // Simple initialization without wallet features
          await sdk.actions.ready()
          console.log('✅ Mini App ready called')
        } else {
          console.log('🌐 Running in regular browser')
        }
        
        setIsReady(true)
      } catch (error) {
        console.error('❌ Error initializing Mini App:', error)
        // Continue anyway - don't block the app for Mini App issues
        console.log('Continuing without Mini App features')
        setIsReady(true)
      }
    }

    initializeMiniApp()
  }, [])

  // Show loading state briefly to avoid flash
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    )
  }

  return <>{children}</>
}