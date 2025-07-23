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
        
        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-300 p-2"
          title="Delete saved cast"
        >
          🗑️
        </button>
      </div>

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
        </div>
      )}

      {/* Tags */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          {/* Manual tags */}
          {(cast.tags || []).filter(tag => 
            !(cast.parsed_data?.hashtags || []).includes(tag) && 
            !(cast.parsed_data?.ai_tags || []).includes(tag)
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
          {(cast.parsed_data?.ai_tags || []).map(tag => (
            <span 
              key={tag} 
              className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs border border-blue-500/30"
              title="AI-generated tag"
            >
              🧠 {tag}
            </span>
          ))}
          
          {/* Hashtags */}
          {(cast.parsed_data?.hashtags || []).map(tag => (
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
                {tags.map(tag => (
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