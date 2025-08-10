'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { sdk } from '@farcaster/miniapp-sdk'
import SavedCasts from './SavedCasts'
import RecentCasts from './RecentCasts'
import AIChatPanel from './AIChatPanel'
import VaultManager from './VaultManager'
import { UserService } from '@/lib/supabase'

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
  const [activeView, setActiveView] = useState<'home' | 'dashboard' | 'ai' | 'collections'>('home')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Function to refresh cast data across all components
  const refreshCastData = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  useEffect(() => {
    async function initializeMiniApp() {
      try {
        // Check if we're in a Mini App environment
        const isMiniApp = await sdk.isInMiniApp()
        setIsInMiniApp(isMiniApp)
        
        if (isMiniApp) {
          // Get user from context (context is a Promise, so await it)
          const context = await sdk.context
          if (context?.user) {
            const userData = {
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl
            }
            
            setUser(userData)

            // Save/update user in database
            try {
              if (userData.username && userData.fid) {
                await UserService.createOrUpdateUser({
                  fid: userData.fid,
                  username: userData.username,
                  display_name: userData.displayName,
                  pfp_url: userData.pfpUrl
                })
              }
            } catch (dbError) {
              console.error('Failed to save user to database:', dbError)
              // Don't fail the whole app if user save fails
            }
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
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">
            Cast<span className="text-purple-400">KPR</span>
          </h1>
          {user && (
            <div className="flex items-center justify-center gap-3 mb-3">
              {user.pfpUrl && (
                <Image 
                  src={user.pfpUrl} 
                  alt={user.username || 'User'}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full"
                />
              )}
              <p className="text-gray-300 text-sm">
                Welcome back, {user.displayName || user.username || `FID ${user.fid}`}!
              </p>
            </div>
          )}
          
          {isInMiniApp && (
            <p className="text-xs text-purple-300">
              🚀 Running in Farcaster Mini App
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-center mb-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-1 border border-white/20">
            <button
              onClick={() => setActiveView('home')}
              className={`px-3 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'home'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-3 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'dashboard'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              All Saved
            </button>
            <button
              onClick={() => setActiveView('collections')}
              className={`px-3 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'collections'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Vaults
            </button>
            <button
              onClick={() => setActiveView('ai')}
              className={`px-3 py-2 rounded-md font-medium transition-colors text-sm ${
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
        <div className="mb-6">
          {activeView === 'home' ? (
            <RecentCasts 
              userId={userIdForDb} 
              onViewAllClick={() => setActiveView('dashboard')}
              key={`recent-${refreshTrigger}`}
            />
          ) : activeView === 'dashboard' ? (
            <SavedCasts 
              userId={userIdForDb} 
              key={`saved-${refreshTrigger}`}
            />
          ) : activeView === 'collections' ? (
            <VaultManager 
              userId={userIdForDb}
              key={`collections-${refreshTrigger}`}
            />
          ) : (
            <AIChatPanel 
              userId={userIdForDb}
              onCastUpdate={refreshCastData}
            />
          )}
        </div>

        {/* Bot Instructions */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
          <h2 className="text-lg font-bold text-white mb-3 text-center">🤖 How to Save Casts</h2>
          
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="bg-purple-500/20 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-sm">1️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-1 text-xs">Find a Cast</h3>
              <p className="text-gray-300 text-xs">Browse and find something interesting</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/20 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-sm">2️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-1 text-xs">Reply to Save</h3>
              <p className="text-gray-300 text-xs">Reply with <code className="bg-black/30 px-1 rounded text-xs">@cstkpr save this</code></p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/20 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-sm">3️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-1 text-xs">View Here</h3>
              <p className="text-gray-300 text-xs">Your cast appears with AI insights</p>
            </div>
          </div>

          <div className="text-center text-xs text-gray-400">
            <div className="mb-2">
              <strong>Bot Commands:</strong>
            </div>
            <div className="flex flex-wrap justify-center gap-1">
              <code className="bg-black/30 px-2 py-1 rounded text-xs">@cstkpr save this</code>
              <code className="bg-black/30 px-2 py-1 rounded text-xs">@cstkpr opinion</code>
              <code className="bg-black/30 px-2 py-1 rounded text-xs">@cstkpr help</code>
              <code className="bg-black/30 px-2 py-1 rounded text-xs">@cstkpr stats</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}