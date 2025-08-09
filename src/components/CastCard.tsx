// src/components/CastCard.tsx
import { SavedCast } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'
import { useState } from 'react'

interface CastCardProps {
  cast: SavedCast
  compact?: boolean
  userId?: string
  onUpdate?: (cast: SavedCast) => void
  onDelete?: (castId: string) => void
  showAnalytics?: boolean
}

interface EnhancedParsedData {
  hashtags?: string[]
  urls?: string[]
  mentions?: string[]
  word_count?: number
  topics?: string[]
  ai_category?: string
  ai_tags?: string[]
  // Enhanced analysis fields
  quality_score?: number
  sentiment?: 'positive' | 'negative' | 'neutral'
  sentiment_score?: number
  content_type?: string
  engagement_potential?: 'low' | 'medium' | 'high'
  entities?: {
    people?: string[]
    tokens?: string[]
    projects?: string[]
    companies?: string[]
  }
  confidence_score?: number
  analysis_version?: string
}

export default function CastCard({ 
  cast, 
  compact = false, 
  userId, 
  onUpdate, 
  onDelete,
  showAnalytics = false 
}: CastCardProps) {
  const [showFullContent, setShowFullContent] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Safely parse the enhanced data
  const parsedData = cast.parsed_data as EnhancedParsedData || {}
  
  // Safely extract data with fallbacks
  const hashtags = Array.isArray(parsedData.hashtags) ? parsedData.hashtags : []
  const urls = Array.isArray(parsedData.urls) ? parsedData.urls : []
  const mentions = Array.isArray(parsedData.mentions) ? parsedData.mentions : []
  const topics = Array.isArray(parsedData.topics) ? parsedData.topics : []
  const aiTags = Array.isArray(parsedData.ai_tags) ? parsedData.ai_tags : []
  
  // Enhanced analysis data
  const qualityScore = typeof parsedData.quality_score === 'number' ? parsedData.quality_score : null
  const sentiment = parsedData.sentiment || null
  const contentType = parsedData.content_type || null
  const engagementPotential = parsedData.engagement_potential || null
  
  // Content processing
  const content = cast.cast_content || 'No content available'
  const isLongContent = content.length > 200
  const displayContent = compact && isLongContent && !showFullContent 
    ? content.substring(0, 200) + '...' 
    : content

  // Safe timestamp parsing
  const timestamp = cast.cast_timestamp ? new Date(cast.cast_timestamp) : new Date()
  const isValidTimestamp = !isNaN(timestamp.getTime())
  
  // Handle delete
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDelete || isDeleting) return
    
    if (confirm('Are you sure you want to delete this saved cast?')) {
      setIsDeleting(true)
      try {
        await onDelete(cast.id)
      } catch (error) {
        console.error('Failed to delete cast:', error)
        setIsDeleting(false)
      }
    }
  }

  // Get quality color
  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-blue-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-red-400'
  }

  // Get sentiment emoji
  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊'
      case 'negative': return '😞'
      case 'neutral': return '😐'
      default: return '🤔'
    }
  }

  // Get engagement emoji
  const getEngagementEmoji = (potential: string) => {
    switch (potential) {
      case 'high': return '🚀'
      case 'medium': return '📈'
      case 'low': return '📊'
      default: return '📊'
    }
  }

  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 transition-all hover:bg-white/15 relative group ${
      compact ? 'p-4' : 'p-6'
    }`}>
      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs z-10"
          title="Delete saved cast"
          type="button"
        >
          {isDeleting ? '⏳' : '×'}
        </button>
      )}

      {/* Enhanced Analytics Bar */}
      {showAnalytics && qualityScore !== null && (
        <div className="mb-3 p-2 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className={`font-medium ${getQualityColor(qualityScore)}`}>
                🎯 Quality: {Math.round(qualityScore)}/100
              </span>
              {sentiment && (
                <span className="text-gray-300">
                  {getSentimentEmoji(sentiment)} {sentiment}
                </span>
              )}
              {engagementPotential && (
                <span className="text-gray-300">
                  {getEngagementEmoji(engagementPotential)} {engagementPotential} engagement
                </span>
              )}
            </div>
            {contentType && (
              <span className="text-gray-400 text-xs">
                {contentType}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Author Info */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {cast.author_pfp_url ? (
            <Image 
              src={cast.author_pfp_url} 
              alt={cast.username || 'Unknown user'}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full"
              onError={(e) => {
                // Fallback if image fails to load
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {(cast.username || cast.author_display_name || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-white">
              {cast.author_display_name || cast.username || `@unknown-user`}
            </h3>
            <p className="text-sm text-gray-400">
              {cast.username && `@${cast.username}`} • {
                isValidTimestamp 
                  ? formatDistanceToNow(timestamp, { addSuffix: true })
                  : 'Unknown time'
              }
            </p>
          </div>
        </div>
        
        {/* Warpcast Link */}
        {cast.cast_url && (
          <a 
            href={cast.cast_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
            title="View on Farcaster"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </a>
        )}
      </div>
      
      {/* Cast Content */}
      <div className="mb-4">
        <p className={`text-gray-100 leading-relaxed ${compact ? 'text-sm' : ''}`}>
          {displayContent}
        </p>
        
        {/* Show more/less button for long content */}
        {isLongContent && compact && (
          <button
            onClick={() => setShowFullContent(!showFullContent)}
            className="text-purple-400 hover:text-purple-300 text-sm mt-2 transition-colors"
          >
            {showFullContent ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      
      {/* Tags and Topics */}
      {(hashtags.length > 0 || topics.length > 0 || aiTags.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Hashtags */}
          {hashtags.slice(0, compact ? 2 : 4).map((tag: string) => (
            <span 
              key={`hashtag-${tag}`}
              className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs"
              title="Hashtag from content"
            >
              #{tag}
            </span>
          ))}
          
          {/* AI Tags */}
          {aiTags.slice(0, compact ? 1 : 3).map((tag: string) => (
            <span 
              key={`ai-${tag}`}
              className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs flex items-center gap-1"
              title="AI-generated tag"
            >
              🧠 {tag}
            </span>
          ))}
          
          {/* Topics */}
          {topics.slice(0, compact ? 1 : 2).map((topic: string) => (
            <span 
              key={`topic-${topic}`}
              className="bg-pink-500/20 text-pink-300 px-2 py-1 rounded-full text-xs"
              title="Analyzed topic"
            >
              {topic}
            </span>
          ))}
          
          {/* URLs indicator */}
          {urls.length > 0 && (
            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              🔗 {urls.length} link{urls.length !== 1 ? 's' : ''}
            </span>
          )}
          
          {/* Mentions indicator */}
          {mentions.length > 0 && (
            <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              👥 {mentions.length} mention{mentions.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
      
      {/* Engagement Stats */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1">
            ❤️ {cast.likes_count || 0}
          </span>
          <span className="flex items-center gap-1">
            💬 {cast.replies_count || 0}
          </span>
          <span className="flex items-center gap-1">
            🔄 {cast.recasts_count || 0}
          </span>
        </div>
        
        {/* Word count */}
        {parsedData.word_count && (
          <span className="text-xs">
            {parsedData.word_count} words
          </span>
        )}
      </div>
      
      {/* Save info */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Saved {formatDistanceToNow(new Date(cast.created_at), { addSuffix: true })}
          </p>
          
          {/* Enhancement indicator */}
          {qualityScore !== null && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-blue-400">🧠 AI Enhanced</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {cast.notes && (
          <div className="mt-2 p-2 bg-white/5 rounded text-xs text-gray-300">
            📝 {cast.notes}
          </div>
        )}
      </div>
    </div>
  )
}