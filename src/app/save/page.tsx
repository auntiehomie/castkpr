export default function Save() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Save Casts with <span className="text-purple-400">CastKPR</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Use our bot on Farcaster to automatically save and organize casts
          </p>
          
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-white mb-6">🤖 How to Save Casts:</h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="bg-purple-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">1️⃣</span>
                </div>
                <h3 className="font-semibold text-white mb-2">Find a Cast</h3>
                <p className="text-gray-300 text-sm">Browse Farcaster and find an interesting cast</p>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">2️⃣</span>
                </div>
                <h3 className="font-semibold text-white mb-2">Reply to Save</h3>
                <p className="text-gray-300 text-sm">Reply with <code className="bg-black/30 px-1 rounded">@cstkpr save this</code></p>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">3️⃣</span>
                </div>
                <h3 className="font-semibold text-white mb-2">View Dashboard</h3>
                <p className="text-gray-300 text-sm">Check your saved casts on the dashboard</p>
              </div>
            </div>

            <div className="bg-blue-500/10 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-white mb-2">🎯 Bot Commands:</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li><code className="bg-black/30 px-2 py-1 rounded">@cstkpr save this</code> - Save any cast</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">@cstkpr help</code> - Show all commands</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">@cstkpr stats</code> - Your save statistics</li>
              </ul>
            </div>

            <a 
              href="/Dashboard"
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors inline-block"
            >
              View Your Dashboard →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}