'use client'

import { useState } from 'react'

interface MCPInsightsProps {
  userId: string
}

export default function MCPInsightsPanel({ userId }: MCPInsightsProps) {
  const [activeTab, setActiveTab] = useState<'analyze' | 'compare' | 'opinion'>('analyze')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  // Form states
  const [castHash, setCastHash] = useState('')
  const [castHash1, setCastHash1] = useState('')
  const [castHash2, setCastHash2] = useState('')
  const [perspective, setPerspective] = useState('general')

  const analyzeCast = async () => {
    if (!castHash) return
    
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/mcp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cast_hash: castHash, user_id: userId })
      })
      
      const data = await response.json()
      setResult(data.success ? data.analysis : { error: data.error })
    } catch (error) {
      setResult({ error: 'Failed to analyze cast' })
    } finally {
      setLoading(false)
    }
  }

  const compareCasts = async () => {
    if (!castHash1 || !castHash2) return
    
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/mcp/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cast_hash_1: castHash1, 
          cast_hash_2: castHash2, 
          user_id: userId 
        })
      })
      
      const data = await response.json()
      setResult(data.success ? data.comparison : { error: data.error })
    } catch (error) {
      setResult({ error: 'Failed to compare casts' })
    } finally {
      setLoading(false)
    }
  }

  const generateOpinion = async () => {
    if (!castHash) return
    
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/mcp/opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cast_hash: castHash, 
          user_id: userId,
          perspective 
        })
      })
      
      const data = await response.json()
      setResult(data.success ? data.opinion : { error: data.error })
    } catch (error) {
      setResult({ error: 'Failed to generate opinion' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <h2 className="text-xl font-bold text-white mb-6">🤖 MCP-Powered Insights</h2>
      
      {/* Navigation Tabs */}
      <div className="flex mb-6 bg-white/5 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('analyze')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors text-sm ${
            activeTab === 'analyze'
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          📊 Analyze Cast
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors text-sm ${
            activeTab === 'compare'
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          ⚖️ Compare Casts
        </button>
        <button
          onClick={() => setActiveTab('opinion')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors text-sm ${
            activeTab === 'opinion'
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          💭 Get Opinion
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'analyze' && (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cast Hash
              </label>
              <input
                type="text"
                value={castHash}
                onChange={(e) => setCastHash(e.target.value)}
                placeholder="Enter cast hash to analyze"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
              />
            </div>
            <button
              onClick={analyzeCast}
              disabled={loading || !castHash}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Analyzing...' : 'Analyze Cast'}
            </button>
          </div>
        )}

        {activeTab === 'compare' && (
          <div>
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  First Cast Hash
                </label>
                <input
                  type="text"
                  value={castHash1}
                  onChange={(e) => setCastHash1(e.target.value)}
                  placeholder="Enter first cast hash"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Second Cast Hash
                </label>
                <input
                  type="text"
                  value={castHash2}
                  onChange={(e) => setCastHash2(e.target.value)}
                  placeholder="Enter second cast hash"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                />
              </div>
            </div>
            <button
              onClick={compareCasts}
              disabled={loading || !castHash1 || !castHash2}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Comparing...' : 'Compare Casts'}
            </button>
          </div>
        )}

        {activeTab === 'opinion' && (
          <div>
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cast Hash
                </label>
                <input
                  type="text"
                  value={castHash}
                  onChange={(e) => setCastHash(e.target.value)}
                  placeholder="Enter cast hash for opinion"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Perspective
                </label>
                <select
                  value={perspective}
                  onChange={(e) => setPerspective(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                >
                  <option value="general">General</option>
                  <option value="technical">Technical</option>
                  <option value="business">Business</option>
                  <option value="social">Social</option>
                  <option value="creative">Creative</option>
                </select>
              </div>
            </div>
            <button
              onClick={generateOpinion}
              disabled={loading || !castHash}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Generating...' : 'Generate Opinion'}
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 p-4 bg-black/20 rounded-lg">
            {result.error ? (
              <div className="text-red-300">
                <strong>Error:</strong> {result.error}
              </div>
            ) : (
              <div className="text-gray-300 text-sm">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
