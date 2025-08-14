import SavedCasts from '@/components/SavedCasts'
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
              Manage and explore your saved Farcaster casts
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
        <div className="flex space-x-4 mb-8">
          <Link 
            href="/dashboard"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            All Casts
          </Link>
          <Link 
            href="/dashboard/intelligence"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors border border-white/20"
          >
            Intelligence
          </Link>
          <Link 
            href="/dashboard/collections"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors border border-white/20"
          >
            Collections
          </Link>
        </div>

        {/* Main Content */}
        <SavedCasts userId="demo-user" />
      </div>
    </div>
  )
}