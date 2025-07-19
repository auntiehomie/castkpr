// src/components/MiniApp.tsx
'use client'

import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import SavedCasts from './SavedCasts'
import RecentCasts from './RecentCasts'
import AIChatPanel from './AIChatPanel'

interface User {
  fid: number
  username?: string
  displayName?: string
  pfpUrl?: string
}

export default function MiniApp() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInMiniApp, setIsInMiniApp] = useState(false)
  const [activeView, setActiveView] = useState<'home' | 'dashboard' | 'ai'>('home')

  useEffect(() => {
    async function initializeMiniApp() {
      try {
        // Check if we're in a Mini App environment
        const isMiniApp = await sdk.isInMiniApp()
        setIsInMiniApp(isMiniApp)
        
        if (isMiniApp) {
          // Get user from context (context is async, so await it)
          const context = await sdk.context
          if (context?.user) {
            setUser({
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl
            })
          }

          // Signal that the app is ready
          await sdk.actions.ready()
        } else {
          // Fallback for web users - you might want to implement regular auth here
          setUser({
            fid: 0,
            username: 'demo-user',
            displayName: 'Demo User'
          })
        }
      } catch (err) {
        console.error('Error initializing Mini App:', err)
        setError('Failed to initialize app')
      } finally {
        setLoading(false)
      }
    }

    initializeMiniApp()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading CastKPR...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    )
  }

  const userIdForDb = user?.username || `fid-${user?.fid}` || 'demo-user'

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Cast<span className="text-purple-400">KPR</span>
          </h1>
          {user && (
            <div className="flex items-center justify-center gap-3 mb-4">
              {user.pfpUrl && (
                <img 
                  src={user.pfpUrl} 
                  alt={user.username || 'User'}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <p className="text-gray-300">
                Welcome back, {user.displayName || user.username || `FID ${user.fid}`}!
              </p>
            </div>
          )}
          
          {isInMiniApp && (
            <p className="text-sm text-purple-300">
              🚀 Running as Mini App
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-1 border border-white/20">
            <button
              onClick={() => setActiveView('home')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeView === 'home'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeView === 'dashboard'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              All Saved
            </button>
            <button
              onClick={() => setActiveView('ai')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeView === 'ai'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              AI Chat
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">
          {activeView === 'home' ? (
            <RecentCasts userId={userIdForDb} />
          ) : activeView === 'dashboard' ? (
            <SavedCasts userId={userIdForDb} />
          ) : (
            <AIChatPanel userId={userIdForDb} />
          )}
        </div>

        {/* Bot Instructions */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4 text-center">🤖 How to Save Casts</h2>
          
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="bg-purple-500/20 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">1️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-1 text-sm">Find a Cast</h3>
              <p className="text-gray-300 text-xs">Browse Farcaster and find something interesting</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/20 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">2️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-1 text-sm">Reply to Save</h3>
              <p className="text-gray-300 text-xs">Reply with <code className="bg-black/30 px-1 rounded">@cstkpr save this</code></p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/20 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">3️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-1 text-sm">View Here</h3>
              <p className="text-gray-300 text-xs">Your saved cast appears here with parsed data</p>
            </div>
          </div>

          <div className="text-center text-sm text-gray-400">
            Bot Commands: <code className="bg-black/30 px-1 rounded">@cstkpr save this</code> • <code className="bg-black/30 px-1 rounded">@cstkpr help</code> • <code className="bg-black/30 px-1 rounded">@cstkpr analyze</code>
          </div>
        </div>
      </div>
    </div>
  )
}