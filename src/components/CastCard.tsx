import { SavedCast } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'

interface CastCardProps {
  cast: SavedCast
  compact?: boolean
}

interface ParsedData {
  hashtags?: string[]
  urls?: string[]
  mentions?: string[]
  word_count?: number
  topics?: string[]
  ai_category?: string
  ai_tags?: string[]
}

export default function CastCard({ cast, compact = false }: CastCardProps) {
  const parsedData = cast.parsed_data as ParsedData

  // Combine all tags: manual tags, parsed hashtags, and AI tags
  const getAllTags = () => {
    const tags = new Set<string>()
    
    // Add manual tags from cast.tags
    if (cast.tags) {
      cast.tags.forEach(tag => tags.add(tag))
    }
    
    // Add hashtags from parsed data
    if (parsedData?.hashtags) {
      parsedData.hashtags.forEach(tag => tags.add(tag))
    }
    
    // Add AI-generated topics
    if (parsedData?.ai_tags) {
      parsedData.ai_tags.forEach(tag => tags.add(tag))
    }
    
    return Array.from(tags)
  }

  const allTags = getAllTags()

  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 transition-all hover:bg-white/15 ${
      compact ? 'p-4' : 'p-6'
    }`}>
      {/* Author Info */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {cast.author_pfp_url ? (
            <Image 
              src={cast.author_pfp_url} 
              alt={cast.username}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {cast.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-white">
              {cast.author_display_name || `@${cast.username}`}
            </h3>
            <p className="text-sm text-gray-400">
              @{cast.username} • {formatDistanceToNow(new Date(cast.cast_timestamp), { addSuffix: true })}
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
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </a>
        )}
      </div>
      
      {/* Cast Content */}
      <div className="mb-4">
        <p className={`text-gray-100 leading-relaxed ${
          compact ? 'text-sm line-clamp-3' : ''
        }`}>
          {cast.cast_content}
        </p>
      </div>
      
      {/* Category Badge */}
      {cast.category && cast.category !== 'other' && (
        <div className="mb-3">
          <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-medium">
            📂 {cast.category}
          </span>
        </div>
      )}
      
      {/* All Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {allTags.slice(0, compact ? 4 : 8).map((tag: string) => {
            // Determine tag type for styling
            const isAITag = parsedData?.ai_tags?.includes(tag)
            const isHashtag = parsedData?.hashtags?.includes(tag)
            const isManualTag = cast.tags?.includes(tag)
            
            let tagStyle = "bg-purple-500/20 text-purple-300" // default
            let prefix = "#"
            
            if (isAITag && !isHashtag) {
              tagStyle = "bg-blue-500/20 text-blue-300"
              prefix = "🧠 "
            } else if (isManualTag && tag === 'saved-via-bot') {
              tagStyle = "bg-green-500/20 text-green-300"
              prefix = "🤖 "
            }
            
            return (
              <span 
                key={tag}
                className={`${tagStyle} px-2 py-1 rounded-full text-xs`}
                title={isAITag ? 'AI-generated tag' : isHashtag ? 'Hashtag from content' : 'Manual tag'}
              >
                {prefix}{tag}
              </span>
            )
          })}
          
          {allTags.length > (compact ? 4 : 8) && (
            <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full text-xs">
              +{allTags.length - (compact ? 4 : 8)} more
            </span>
          )}
        </div>
      )}
      
      {/* Metadata indicators */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* URLs indicator */}
        {parsedData?.urls?.length && parsedData.urls.length > 0 && (
          <span className="bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full text-xs flex items-center gap-1">
            🔗 {parsedData.urls.length} link{parsedData.urls.length !== 1 ? 's' : ''}
          </span>
        )}
        
        {/* Mentions indicator */}
        {parsedData?.mentions?.length && parsedData.mentions.length > 0 && (
          <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-xs flex items-center gap-1">
            👥 {parsedData.mentions.length} mention{parsedData.mentions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      {/* Engagement Stats */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1">
            ❤️ {cast.likes_count}
          </span>
          <span className="flex items-center gap-1">
            💬 {cast.replies_count}
          </span>
          <span className="flex items-center gap-1">
            🔄 {cast.recasts_count}
          </span>
        </div>
        
        {/* Word count */}
        {parsedData?.word_count && (
          <span className="text-xs">
            {parsedData.word_count} words
          </span>
        )}
      </div>
      
      {/* Save info - IMPROVED VISIBILITY */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-xs text-gray-300">
          Saved {formatDistanceToNow(new Date(cast.created_at), { addSuffix: true })}
          {parsedData?.ai_tags && parsedData.ai_tags.length > 0 && (
            <span className="ml-2 text-blue-300">• AI-tagged</span>
          )}
        </p>
      </div>
    </div>
  )
}