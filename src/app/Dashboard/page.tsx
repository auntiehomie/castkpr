// src/app/dashboard/page.tsx
// Progressive loading version to isolate which component is causing 404

'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Dashboard() {
  const [testStep, setTestStep] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  const runTest = async (step: number) => {
    setTestStep(step)
    setErrors([])

    try {
      switch (step) {
        case 1:
          // Test SavedCasts import
          const { default: SavedCasts } = await import('@/components/SavedCasts')
          console.log('✅ SavedCasts imported successfully')
          break
          
        case 2:
          // Test IntelligenceDashboard import
          const { default: IntelligenceDashboard } = await import('@/components/IntelligenceDashboard')
          console.log('✅ IntelligenceDashboard imported successfully')
          break
          
        case 3:
          // Test Supabase
          const { supabase } = await import('@/lib/supabase')
          const { data, error } = await supabase.from('saved_casts').select('*').limit(1)
          if (error) throw new Error(`Supabase: ${error.message}`)
          console.log('✅ Supabase connection successful')
          break
          
        case 4:
          // Test Intelligence library
          const { CastIntelligence } = await import('@/lib/intelligence')
          await CastIntelligence.getTrendingTopics('week')
          console.log('✅ Intelligence library working')
          break
          
        default:
          break
      }
    } catch (error) {
      const errorMsg = `Step ${step} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(errorMsg)
      setErrors(prev => [...prev, errorMsg])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              🔧 Cast<span className="text-purple-400">KPR</span> Debug Dashboard
            </h1>
            <p className="text-gray-300">
              Testing components to find the 404 cause
            </p>
          </div>
          
          <Link 
            href="/"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            ← Home
          </Link>
        </div>

        {/* Test Results */}
        <div className="grid gap-6 mb-8">
          {/* Basic Page Load */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">✅</span>
              <h3 className="text-white font-semibold">Dashboard Page Loads</h3>
            </div>
            <p className="text-gray-300 text-sm">
              The dashboard route is working! The 404 is caused by a component or import.
            </p>
          </div>

          {/* Component Tests */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-white font-semibold mb-4">Component Tests</h3>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => runTest(1)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors"
              >
                🧪 Test SavedCasts Import
              </button>
              
              <button
                onClick={() => runTest(2)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition-colors"
              >
                🧪 Test IntelligenceDashboard Import
              </button>
              
              <button
                onClick={() => runTest(3)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg transition-colors"
              >
                🧪 Test Supabase Connection
              </button>
              
              <button
                onClick={() => runTest(4)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg transition-colors"
              >
                🧪 Test Intelligence Library
              </button>
            </div>

            {/* Current Test Status */}
            {testStep > 0 && (
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <p className="text-white">
                  🔍 Testing step {testStep}... Check browser console for details.
                </p>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <h4 className="text-red-300 font-semibold mb-2">❌ Errors Found:</h4>
                {errors.map((error, index) => (
                  <pre key={index} className="text-red-200 text-sm mb-2 overflow-auto">
                    {error}
                  </pre>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Progressive Component Loading */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">
            🎯 Progressive Component Test
          </h2>
          
          <div className="space-y-4">
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Step 1: Test SavedCasts Component</h3>
              <p className="text-gray-300 text-sm">
                This component handles displaying saved casts from the database.
              </p>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Step 2: Test IntelligenceDashboard Component</h3>
              <p className="text-gray-300 text-sm">
                This component shows AI insights and depends on the intelligence library.
              </p>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Step 3: Test Database Connection</h3>
              <p className="text-gray-300 text-sm">
                Verifies Supabase connection and saved_casts table access.
              </p>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Step 4: Test Intelligence Library</h3>
              <p className="text-gray-300 text-sm">
                Tests the AI analysis functions and trending topics calculation.
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
          <h3 className="text-yellow-300 font-semibold mb-2">🔍 Instructions</h3>
          <ol className="text-yellow-200 text-sm space-y-1">
            <li>1. Click each test button above</li>
            <li>2. Check browser console (F12) for detailed errors</li>
            <li>3. The failing test will show which component is causing the 404</li>
            <li>4. Once we identify the failing component, we can fix it specifically</li>
          </ol>
        </div>
      </div>
    </div>
  )
}