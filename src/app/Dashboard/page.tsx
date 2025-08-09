// src/app/dashboard/page.tsx
import SavedCasts from '@/components/SavedCasts'
import IntelligenceDashboard from '@/components/IntelligenceDashboard'
import Link from 'next/link'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Cast<span className="text-purple-400">KPR</span> Dashboard
            </h1>
            <p className="text-gray-300">
              Your saved casts and personalized insights
            </p>
          </div>
          
          <Link 
            href="/"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            ← Home
          </Link>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column - Saved Casts (2/3 width) */}
          <div className="lg:col-span-2">
            <SavedCasts userId="demo-user" />
          </div>
          
          {/* Right column - Intelligence Dashboard (1/3 width) */}
          <div className="lg:col-span-1">
            <IntelligenceDashboard userId="demo-user" />
            
            {/* Quick Actions */}
            <div className="mt-6 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <Link 
                  href="/save"
                  className="block bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg transition-colors text-center"
                >
                  💾 Save a Cast
                </Link>
                
                <div className="bg-white/10 rounded-lg p-3">
                  <h4 className="text-white text-sm font-medium mb-2">🤖 Bot Commands</h4>
                  <div className="space-y-1 text-xs text-gray-300">
                    <div><code className="bg-black/30 px-1 rounded">@cstkpr save this</code></div>
                    <div><code className="bg-black/30 px-1 rounded">@cstkpr opinion</code></div>
                    <div><code className="bg-black/30 px-1 rounded">@cstkpr trending</code></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Learning Status */}
            <div className="mt-6 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-4 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🧠</span>
                <h4 className="text-white font-medium">AI Learning Status</h4>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                CastKPR is actively learning from your saves and the community's behavior.
              </p>
              <div className="bg-white/10 rounded-full h-2 mb-2">
                <div className="bg-green-400 rounded-full h-2 w-3/4"></div>
              </div>
              <p className="text-xs text-gray-400">
                Learning confidence: 75% • Based on community saves
              </p>
            </div>
          </div>
        </div>
        
        {/* Bottom section - Community Insights */}
        <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            🌟 How CastKPR Gets Smarter
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="text-white font-semibold mb-2">Pattern Recognition</h3>
              <p className="text-gray-300 text-sm">
                Every save teaches me what quality content looks like across different topics and authors
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-white font-semibold mb-2">Trend Analysis</h3>
              <p className="text-gray-300 text-sm">
                I track emerging topics and identify content that's gaining traction before it goes viral
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="text-white font-semibold mb-2">Personalization</h3>
              <p className="text-gray-300 text-sm">
                Your saves help me understand your interests and recommend similar high-quality content
              </p>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              The more the community uses CastKPR, the smarter and more helpful I become for everyone! 🚀
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}