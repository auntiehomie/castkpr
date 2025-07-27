'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

interface CastCardProps {
  cast: SavedCast
  compact?: boolean
  userId?: string
  onUpdate?: (updatedCast: SavedCast) => void
  onDelete?: (castId: string) => void
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

function QualityScoreBar({ score }: { score: number }) {
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">Quality Score</span>
        <span className="text-white font-semibold">{score}/100 - {getLabel(score)}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div 
          className={`h-1.5 rounded-full transition-all duration-300 ${getColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function SentimentBadge({ sentiment, score }: { sentiment: string, score?: number }) {
  const getConfig = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return { bg: 'bg-green-500/20', text: 'text-green-300', emoji: '😊', border: 'border-green-500/30' }
      case 'negative':
        return { bg: 'bg-red-500/20', text: 'text-red-300', emoji: '😞', border: 'border-red-500/30' }
      default:
        return { bg: 'bg-gray-500/20', text: 'text-gray-300', emoji: '😐', border: 'border-gray-500/30' }
    }
  }

  const config = getConfig(sentiment)
  
  return (
    <span className={`${config.bg} ${config.text} ${config.border} border px-2 py-1 rounded-full text-xs flex items-center gap-1`}>
      <span>{config.emoji}</span>
      {sentiment}{score && ` (${Math.abs(score).toFixed(1)})`}
    </span>
  )
}

function EngagementBadge({ potential }: { potential: string }) {
  const getConfig = (potential: string) => {
    switch (potential) {
      case 'high':
        return { bg: 'bg-purple-500/20', text: 'text-purple-300', icon: '🚀', border: 'border-purple-500/30' }
      case 'medium':
        return { bg: 'bg-blue-500/20', text: 'text-blue-300', icon: '📈', border: 'border-blue-500/30' }
      default:
        return { bg: 'bg-gray-500/20', text: 'text-gray-300', icon: '📊', border: 'border-gray-500/30' }
    }
  }

  const config = getConfig(potential)
  
  return (
    <span className={`${config.bg} ${config.text} ${config.border} border px-2 py-1 rounded-full text-xs flex items-center gap-1`}>
      <span>{config.icon}</span>
      {potential}
    </span>
  )
}

function ContentTypeBadge({ type }: { type: string }) {
  const getConfig = (type: string) => {
    const configs: Record<string, { bg: string, text: string, icon: string, border: string }> = {
      'discussion': { bg: 'bg-blue-500/20', text: 'text-blue-300', icon: '💬', border: 'border-blue-500/30' },
      'announcement': { bg: 'bg-purple-500/20', text: 'text-purple-300', icon: '📢', border: 'border-purple-500/30' },
      'question': { bg: 'bg-yellow-500/20', text: 'text-yellow-300', icon: '❓', border: 'border-yellow-500/30' },
      'meme': { bg: 'bg-pink-500/20', text: 'text-pink-300', icon: '😂', border: 'border-pink-500/30' },
      'news': { bg: 'bg-red-500/20', text: 'text-red-300', icon: '📰', border: 'border-red-500/30' },
      'opinion': { bg: 'bg-orange-500/20', text: 'text-orange-300', icon: '💭', border: 'border-orange-500/30' },
      'technical': { bg: 'bg-green-500/20', text: 'text-green-300', icon: '⚙️', border: 'border-green-500/30' }
    }
    return configs[type] || { bg: 'bg-gray-500/20', text: 'text-gray-300', icon: '📝', border: 'border-gray-500/30' }
  }

  const config = getConfig(type)
  
  return (
    <span className={`${config.bg} ${config.text} ${config.border} border px-2 py-1 rounded-full text-xs flex items-center gap-1`}>
      <span>{config.icon}</span>
      {type}
    </span>
  )
}

export default function CastCard({ 
  cast, 
  compact = false, 
  userId = 'demo-user',
  onUpdate,
  onDelete 
}: CastCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(cast.notes || '')
  const [tags, setTags] = useState<string[]>(cast.tags || [])
  const [newTag, setNewTag] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const parsedData = cast.parsed_data as EnhancedParsedData
  const hasEnhancedAnalysis = parsedData?.quality_score !== undefined

  const handleSaveChanges = async () => {
    if (!userId) return

    try {
      setIsUpdating(true)
      const updatedCast = await CastService.updateCast(cast.id, userId, {
        notes: notes.trim() || undefined,
        tags: tags
      })
      
      if (onUpdate) {
        onUpdate(updatedCast)
      }
      
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating cast:', error)
      // Could add error toast here
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(cast.id)
    }
  }

  const handleUsernameClick = () => {
    if (cast.cast_url) {
      window.open(cast.cast_url, '_blank', 'noopener,noreferrer')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return '1 day ago'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 transition-all hover:bg-white/15 group">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {cast.author_pfp_url && (
            <Image
              src={cast.author_pfp_url}
              alt={`${cast.username} avatar`}
              width={40}
              height={40}
              className="rounded-full"
            />
          )}
          <div>
            <button
              onClick={handleUsernameClick}
              className="font-semibold text-purple-300 hover:text-purple-200 transition-colors cursor-pointer underline decoration-dotted underline-offset-2"
              title="View original cast"
            >
              {cast.author_display_name || cast.username}
            </button>
            <p className="text-gray-400 text-sm">@{cast.username} • {formatDate(cast.cast_timestamp)}</p>
          </div>
        </div>
        
        {/* Enhanced Analysis Badge */}
        {hasEnhancedAnalysis && (
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 px-2 py-1 rounded-full text-xs border border-purple-500/30">
              🧠 Enhanced
            </span>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-300 p-2"
              title="Delete saved cast"
            >
              🗑️
            </button>
          </div>
        )}
        
        {!hasEnhancedAnalysis && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-300 p-2"
            title="Delete saved cast"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Enhanced Analysis Section */}
      {hasEnhancedAnalysis && !compact && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-lg border border-purple-500/20">
          {/* Quality Score */}
          {parsedData.quality_score && (
            <div className="mb-3">
              <QualityScoreBar score={parsedData.quality_score} />
            </div>
          )}

          {/* Analysis Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            {parsedData.sentiment && (
              <SentimentBadge sentiment={parsedData.sentiment} score={parsedData.sentiment_score} />
            )}
            {parsedData.engagement_potential && (
              <EngagementBadge potential={parsedData.engagement_potential} />
            )}
            {parsedData.content_type && (
              <ContentTypeBadge type={parsedData.content_type} />
            )}
            {parsedData.confidence_score && (
              <span className="bg-white/10 text-gray-300 px-2 py-1 rounded-full text-xs border border-white/20">
                {parsedData.confidence_score}% confidence
              </span>
            )}
          </div>

          {/* Enhanced Topics */}
          {parsedData.topics && parsedData.topics.length > 0 && (
            <div className="mb-2">
              <div className="flex flex-wrap gap-1">
                {parsedData.topics.slice(0, 5).map((topic, index) => (
                  <span 
                    key={index}
                    className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs border border-purple-500/30"
                  >
                    #{topic}
                  </span>
                ))}
                {parsedData.topics.length > 5 && (
                  <span className="text-gray-400 text-xs px-2 py-1">
                    +{parsedData.topics.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Entities */}
          {parsedData.entities && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {parsedData.entities.tokens && parsedData.entities.tokens.length > 0 && (
                <div>
                  <span className="text-gray-400">Tokens:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parsedData.entities.tokens.slice(0, 3).map((token, index) => (
                      <span key={index} className="bg-yellow-500/20 text-yellow-300 px-1 py-0.5 rounded text-xs border border-yellow-500/30">
                        ${token}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {parsedData.entities.projects && parsedData.entities.projects.length > 0 && (
                <div>
                  <span className="text-gray-400">Projects:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parsedData.entities.projects.slice(0, 3).map((project, index) => (
                      <span key={index} className="bg-green-500/20 text-green-300 px-1 py-0.5 rounded text-xs border border-green-500/30">
                        {project}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="mb-4">
        <p className="text-white leading-relaxed">{cast.cast_content}</p>
      </div>

      {/* Engagement Stats */}
      {!compact && (
        <div className="flex items-center space-x-4 text-sm text-gray-400 mb-4">
          <span>❤️ {cast.likes_count}</span>
          <span>💬 {cast.replies_count}</span>
          <span>🔄 {cast.recasts_count}</span>
          {parsedData?.word_count && (
            <span className="text-xs">
              📝 {parsedData.word_count} words
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          {/* Manual tags */}
          {(cast.tags || []).filter(tag => 
            !(parsedData?.hashtags || []).includes(tag) && 
            !(parsedData?.ai_tags || []).includes(tag) &&
            !(parsedData?.topics || []).includes(tag) &&
            tag !== 'enhanced-analysis' &&
            tag !== 'saved-via-bot'
          ).map(tag => (
            <span 
              key={tag} 
              className="bg-green-500/20 text-green-300 px-2 py-1 rounded-full text-xs border border-green-500/30"
              title="Manual tag"
            >
              🏷️ {tag}
            </span>
          ))}
          
          {/* AI tags */}
          {(parsedData?.ai_tags || []).map(tag => (
            <span 
              key={tag} 
              className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs border border-blue-500/30"
              title="AI-generated tag"
            >
              🧠 {tag}
            </span>
          ))}
          
          {/* Hashtags */}
          {(parsedData?.hashtags || []).map(tag => (
            <span 
              key={tag} 
              className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs border border-purple-500/30"
              title="Hashtag from content"
            >
              # {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Notes */}
      {cast.notes && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <p className="text-gray-300 text-sm">
            <span className="text-yellow-400">📝 Note:</span> {cast.notes}
          </p>
        </div>
      )}

      {/* Edit Form */}
      {isEditing && (
        <div className="mt-4 p-4 bg-white/10 rounded-lg border border-white/20">
          <div className="space-y-4">
            {/* Notes Input */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Personal Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your thoughts, context, or reminders about this cast..."
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 h-20"
              />
            </div>

            {/* Tag Management */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Tags
              </label>
              
              {/* Existing Tags */}
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.filter(tag => 
                  !(parsedData?.hashtags || []).includes(tag) && 
                  !(parsedData?.ai_tags || []).includes(tag) &&
                  !(parsedData?.topics || []).includes(tag) &&
                  tag !== 'enhanced-analysis' &&
                  tag !== 'saved-via-bot'
                ).map(tag => (
                  <span 
                    key={tag}
                    className="bg-green-500/20 text-green-300 px-2 py-1 rounded-full text-xs border border-green-500/30 flex items-center gap-1"
                  >
                    🏷️ {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-300 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Add New Tag */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add a tag..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm"
                />
                <button
                  onClick={handleAddTag}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isUpdating}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Toggle */}
      {!isEditing && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => setIsEditing(true)}
            className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            ✏️ Edit Notes & Tags
          </button>
          
          {cast.cast_url && (
            <a
              href={cast.cast_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-purple-300 text-sm transition-colors"
            >
              🔗 View Original
            </a>
          )}
        </div>
      )}
    </div>
  )
}