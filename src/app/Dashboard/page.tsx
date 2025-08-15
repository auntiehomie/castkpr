'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CastService } from '@/lib/supabase'

export default function TestPage() {
  const [dbStatus, setDbStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [totalCasts, setTotalCasts] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testDatabase = async () => {
      try {
        setDbStatus('loading')
        
        // Test database connection by fetching all casts
        const allCasts = await CastService.getAllRecentCasts(10)
        setTotalCasts(allCasts.length)
        setDbStatus('connected')
        
        console.log('🔍 Database test results:', {
          totalCasts: allCasts.length,
          sampleCast: allCasts[0] || 'No casts found'
        })
        
      } catch (err) {
        console.error('❌ Database test failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setDbStatus('error')
      }
    }

    testDatabase()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              🔧 Debug Tools
            </h1>
            <p className="text-gray-300">
              Database inspection and system diagnostics
            </p>
          </div>
          
          <Link 
            href="/"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors border border-white/20"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Database Status */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">📊 Database Status</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Connection Status:</span>
                <span className={`font-semibold ${
                  dbStatus === 'connected' ? 'text-green-400' : 
                  dbStatus === 'error' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {dbStatus === 'connected' ? '✅ Connected' : 
                   dbStatus === 'error' ? '❌ Error' : '⏳ Testing...'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Total Casts in DB:</span>
                <span className="text-white font-semibold">{totalCasts}</span>
              </div>
              
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                  <p className="text-red-300 text-sm">
                    <strong>Error:</strong> {error}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">🔗 Environment</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Environment:</span>
                <span className="text-white font-semibold">
                  {process.env.NODE_ENV || 'development'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Supabase URL:</span>
                <span className="text-white font-semibold text-xs">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Supabase Key:</span>
                <span className="text-white font-semibold text-xs">
                  {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">⚡ Quick Actions</h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <Link
              href="/Dashboard"
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg transition-colors text-center block"
            >
              📊 View Dashboard
            </Link>
            
            <Link
              href="/share?castHash=0xtest123&castFid=456"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors text-center block"
            >
              🧪 Test Share Extension
            </Link>
            
            <button
              onClick={() => window.location.reload()}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition-colors text-center"
            >
              🔄 Refresh Tests
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            CastKPR Debug Console • {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}