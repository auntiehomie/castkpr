import Link from 'next/link'
import RecentCasts from '@/components/RecentCasts'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-6">
            Cast<span className="text-purple-400">KPR</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Save, organize, and recall your favorite Farcaster casts with AI-powered parsing and bot automation
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-purple-400 text-3xl mb-4">💾</div>
            <h3 className="text-xl font-semibold text-white mb-2">Auto-Save Casts</h3>
            <p className="text-gray-300">Reply &quot;@cstkpr save this&quot; to automatically save any cast</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-purple-400 text-3xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">Smart Search</h3>
            <p className="text-gray-300">Find casts by content, author, hashtags, or parsed data</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-purple-400 text-3xl mb-4">🏷️</div>
            <h3 className="text-xl font-semibold text-white mb-2">Auto-Parse</h3>
            <p className="text-gray-300">Extract URLs, mentions, hashtags, and topics automatically</p>
          </div>
        </div>

        {/* Recent Casts Section */}
        <div className="mb-16">
          <RecentCasts userId="demo-user" />
        </div>

        {/* CTA Buttons */}
        <div className="text-center space-x-4 mb-16">
          <Link 
            href="/dashboard"
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
          >
            View Dashboard
          </Link>
          <Link 
            href="/save"
            className="bg-transparent border-2 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
          >
            Save a Cast
          </Link>
        </div>

        {/* Bot Instructions */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">🤖 How to Use the Bot</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="bg-purple-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Find a Cast</h3>
              <p className="text-gray-300 text-sm">Browse Farcaster and find an interesting cast you want to save</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">2️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Reply to Save</h3>
              <p className="text-gray-300 text-sm">Reply with <code className="bg-black/30 px-1 rounded">@cstkpr save this</code></p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">3️⃣</span>
              </div>
              <h3 className="font-semibold text-white mb-2">View Here</h3>
              <p className="text-gray-300 text-sm">Your saved cast appears above with auto-extracted data</p>
            </div>
          </div>

          {/* Command Examples */}
          <div className="grid md:grid-cols-2 gap-6 text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-3">Bot Commands:</h3>
              <ul className="space-y-2 text-sm">
                <li><code className="bg-black/30 px-2 py-1 rounded">@cstkpr save this</code> - Save any cast</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">@cstkpr help</code> - Show all commands</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">@cstkpr stats</code> - Your save statistics</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-white mb-3">Auto-Extracted Data:</h3>
              <ul className="space-y-2 text-sm">
                <li>🔗 <strong>URLs</strong> - All links in the cast</li>
                <li>🏷️ <strong>Hashtags</strong> - Topic tags</li>
                <li>👥 <strong>Mentions</strong> - User mentions</li>
                <li>📊 <strong>Engagement</strong> - Likes, replies, recasts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}