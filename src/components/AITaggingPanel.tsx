'use client'

import { useState } from 'react'

interface AITaggingPanelProps {
  userId: string
  onRetagComplete?: () => void
}

export default function AITaggingPanel({ userId, onRetagComplete }: AITaggingPanelProps) {
  const [isRetagging, setIsRetagging] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleBulkRetag = async () => {
    if (!confirm('This will analyze and retag ALL your saved casts with AI-generated tags. This may take a few minutes. Continue?')) {
      return
    }

    setIsRetagging(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/retag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          mode: 'bulk'
        })
      })

      const data = await response.json()

      if (data.success) {
        setResults(data)
        if (onRetagComplete) onRetagComplete()
      } else {
        setError(data.error || 'Failed to retag casts')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsRetagging(false)
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">🧠</div>
        <div>
          <h3 className="text-xl font-semibold text-white">AI Smart Tagging</h3>
          <p className="text-sm text-gray-400">Automatically categorize your saved casts with AI-generated tags</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Features List */}
        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="font-medium text-white mb-2">✨ What AI Tagging Does:</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Analyzes cast content to identify main topics</li>
            <li>• Generates relevant, searchable tags</li>
            <li>• Categorizes casts (tech, social, business, etc.)</li>
            <li>• Detects sentiment and content type</li>
            <li>• Preserves your existing manual tags</li>
          </ul>
        </div>

        {/* Action Button */}
        <button
          onClick={handleBulkRetag}
          disabled={isRetagging}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
        >
          {isRetagging ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Processing... This may take a few minutes
            </>
          ) : (
            <>
              🏷️ Retag All Casts with AI
            </>
          )}
        </button>

        {/* Results */}
        {results && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
            <h4 className="font-semibold text-green-300 mb-2">✅ Retagging Complete!</h4>
            <div className="text-sm text-green-200 space-y-1">
              <p>• Processed: {results.processed} casts</p>
              {results.errors > 0 && <p>• Errors: {results.errors} casts</p>}
              <p>• All casts now have AI-generated tags for better organization</p>
            </div>
            
            {results.results && results.results.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-green-300 font-medium">View Sample Results</summary>
                <div className="mt-2 space-y-2">
                  {results.results.slice(0, 3).map((result: any, index: number) => (
                    <div key={index} className="bg-black/20 rounded p-2 text-xs">
                      <p><strong>Cast:</strong> {result.hash.slice(0, 12)}...</p>
                      <p><strong>New Tags:</strong> {result.newTags.join(', ')}</p>
                      <p><strong>Category:</strong> {result.category}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <h4 className="font-semibold text-red-300 mb-1">❌ Error</h4>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500 bg-white/5 rounded-lg p-3">
          <p><strong>Note:</strong> AI tagging uses OpenAI to analyze your casts. The process respects rate limits and may take 1-2 minutes for 50+ casts. Your existing manual tags will be preserved.</p>
        </div>
      </div>
    </div>
  )
}