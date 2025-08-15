import Link from 'next/link'

export default function dashboard() {
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
              Dashboard is working! 🎉
            </p>
          </div>
          
          <Link 
            href="/"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors border border-white/20"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Success Message */}
        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-6 mb-8">
          <h3 className="text-green-300 font-semibold mb-2">✅ Dashboard Route Working!</h3>
          <p className="text-green-200">The 404 issue has been resolved. The dashboard page is now loading correctly.</p>
        </div>

        {/* Quick Test */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">Quick Component Test</h2>
          
          <div className="space-y-4">
            <div className="bg-white/10 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">✅ Basic Dashboard Page</h3>
              <p className="text-gray-300 text-sm">This page is loading successfully!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}