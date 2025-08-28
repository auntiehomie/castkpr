'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SavedCasts from '@/components/SavedCasts'
import RecentCasts from '@/components/RecentCasts'
import AIChatPanel from '@/components/AIChatPanel'
import VaultManager from '@/components/VaultManager'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import IntelligenceDashboard from '@/components/IntelligenceDashboard'
import MCPInsightsPanel from '@/components/MCPInsightsPanel'

export default function Dashboard() {
  const [activeView, setActiveView] = useState<'recent' | 'all' | 'vaults' | 'ai' | 'analytics' | 'intelligence' | 'mcp'>('recent')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [currentUser, setCurrentUser] = useState<string>('demo-user')

  // Function to refresh cast data across all components
  const refreshCastData = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // Get user from Mini App context or fallback to demo
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        if (typeof window === 'undefined') {
          setCurrentUser('demo-user')
          return
        }

        try {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          const isInMiniApp = await sdk.isInMiniApp()
          
          if (isInMiniApp) {
            const context = await sdk.context
            if (context?.user) {
              const user = context.user
              const detectedUserId = user.username || `fid-${user.fid}` || 'demo-user'
              setCurrentUser(detectedUserId)
              return
            }
          }
        } catch (sdkError) {
          console.log('Mini App SDK not available, using demo user')
        }
        
        setCurrentUser('demo-user')
      } catch (error) {
        console.error('Error getting current user:', error)
        setCurrentUser('demo-user')
      }
    }

    getCurrentUser()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Cast<span className="text-purple-400">KPR</span> Dashboard
            </h1>
            <p className="text-gray-300">
              Manage your saved Farcaster casts with AI-powered organization
            </p>
          </div>
          
          <Link 
            href="/"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors border border-white/20"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-1 border border-white/20">
            <button
              onClick={() => setActiveView('recent')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'recent'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              📝 Recent
            </button>
            <button
              onClick={() => setActiveView('all')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              📚 All Saved
            </button>
            <button
              onClick={() => setActiveView('vaults')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'vaults'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              🗂️ Vaults
            </button>
            <button
              onClick={() => setActiveView('analytics')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'analytics'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => setActiveView('intelligence')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'intelligence'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              🧠 @cstkpr
            </button>
            <button
              onClick={() => setActiveView('mcp')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'mcp'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              🤖 MCP Insights
            </button>
            <button
              onClick={() => setActiveView('ai')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeView === 'ai'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              💬 Ask Me
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="mb-8">
          {activeView === 'recent' && (
            <RecentCasts 
              userId={currentUser} 
              onViewAllClick={() => setActiveView('all')}
              key={`recent-${refreshTrigger}`}
            />
          )}
          
          {activeView === 'all' && (
            <SavedCasts 
              userId={currentUser} 
              key={`saved-${refreshTrigger}`}
            />
          )}
          
          {activeView === 'vaults' && (
            <VaultManager 
              userId={currentUser}
              key={`vaults-${refreshTrigger}`}
            />
          )}
          
          {activeView === 'analytics' && (
            <AnalyticsDashboard 
              userId={currentUser}
              key={`analytics-${refreshTrigger}`}
            />
          )}
          
          {activeView === 'intelligence' && (
            <IntelligenceDashboard 
              userId={currentUser}
              key={`intelligence-${refreshTrigger}`}
            />
          )}
          
          {activeView === 'mcp' && (
            <MCPInsightsPanel 
              userId={currentUser}
            />
          )}
          
          {activeView === 'ai' && (
            <AIChatPanel 
              userId={currentUser}
              onCastUpdate={refreshCastData}
            />
          )}
        </div>

        {/* Bot Instructions for New Users */}
        {activeView === 'recent' && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4 text-center">🤖 How to Save Casts</h2>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="bg-purple-500/20 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg">1️⃣</span>
                </div>
                <h3 className="font-semibold text-white mb-2 text-sm">Find a Cast</h3>
                <p className="text-gray-300 text-xs">Browse Farcaster and find something interesting</p>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-500/20 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg">2️⃣</span>
                </div>
                <h3 className="font-semibold text-white mb-2 text-sm">Reply to Save</h3>
                <p className="text-gray-300 text-xs">Reply with <code className="bg-black/30 px-1 rounded text-xs">@cstkpr save this</code></p>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-500/20 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg">3️⃣</span>
                </div>
                <h3 className="font-semibold text-white mb-2 text-sm">View Here</h3>
                <p className="text-gray-300 text-xs">Your cast appears with AI insights</p>
              </div>
            </div>

            <div className="text-center text-xs text-gray-400">
              <div className="mb-2">
                <strong>Bot Commands:</strong>
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                <code className="bg-black/30 px-2 py-1 rounded text-xs">@cstkpr save this</code>
                <code className="bg-black/30 px-2 py-1 rounded text-xs">@cstkpr help</code>
                <code className="bg-black/30 px-2 py-1 rounded text-xs">@cstkpr stats</code>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400">
            Current user: <span className="text-purple-300">{currentUser}</span>
            {process.env.NODE_ENV === 'development' && (
              <span className="ml-2 text-yellow-300">(Development Mode)</span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}