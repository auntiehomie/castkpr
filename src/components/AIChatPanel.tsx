'use client'

import { useState, useEffect, useRef } from 'react'
import { AIResponseService } from '../lib/ai-responses'
import { AIVaultOrganizer } from '@/lib/ai-vault-organizer'
import { CastService, UserAIProfileService, AIContextService, CollectionService } from '@/lib/supabase'
import type { UserAIProfile, SavedCast, Collection } from '@/lib/supabase'

interface AIChatPanelProps {
  userId: string
  onCastUpdate?: () => void
}

interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  confidence?: number
  usedContexts?: string[]
  actions?: Array<{
    type: 'add_to_vault' | 'create_vault' | 'tag_cast' | 'remove_tag'
    castId?: string
    vaultId?: string
    vaultName?: string
    value?: string
  }>
}

export default function AIChatPanel({ userId, onCastUpdate }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<UserAIProfile | null>(null)
  const [userCasts, setUserCasts] = useState<SavedCast[]>([])
  const [userVaults, setUserVaults] = useState<Collection[]>([])
  const [stats, setStats] = useState<{
    totalCasts: number
    topTopics: string[]
    engagementLevel: number
    totalVaults: number
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUserProfile()
    loadUserStats()
    loadUserCasts()
    loadUserVaults()
    addWelcomeMessage()
  }, [userId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadUserProfile = async () => {
    try {
      const profile = await UserAIProfileService.getProfile(userId)
      setUserProfile(profile)
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const loadUserCasts = async () => {
    try {
      const casts = await CastService.getUserCasts(userId, 100)
      setUserCasts(casts)
    } catch (error) {
      console.error('Failed to load user casts:', error)
    }
  }

  const loadUserVaults = async () => {
    try {
      const vaults = await CollectionService.getUserCollections(userId)
      setUserVaults(vaults)
    } catch (error) {
      console.error('Failed to load user vaults:', error)
    }
  }

  const loadUserStats = async () => {
    try {
      const userStats = await CastService.getUserStats(userId)
      const userCasts = await CastService.getUserCasts(userId, 100)
      const userVaults = await CollectionService.getUserCollections(userId)
      
      // Calculate top topics
      const allTopics = userCasts.flatMap(cast => cast.parsed_data?.topics || [])
      const topicCounts = allTopics.reduce((acc: Record<string, number>, topic) => {
        acc[topic] = (acc[topic] || 0) + 1
        return acc
      }, {})
      
      const topTopics = Object.entries(topicCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic)

      setStats({
        totalCasts: userStats.totalCasts,
        totalVaults: userVaults.length,
        topTopics,
        engagementLevel: userProfile?.engagement_level || 0
      })
    } catch (error) {
      console.error('Failed to load user stats:', error)
    }
  }

  const addWelcomeMessage = () => {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      type: 'ai',
      content: `🤖 I'm here to help with saving and organizing casts!

Try: "@cstkpr help" for commands or "@cstkpr save this" to save any cast.

I can help you:
🗂️ **Organize casts into vaults** - "organize my casts by topic"
📊 **Analyze your collection** - "what are my most popular topics?"
🎯 **Smart recommendations** - "suggest vaults for my casts"
🏷️ **Auto-tag content** - "tag my crypto casts"
🔍 **Find specific content** - "find casts about AI"

What would you like me to help with?`,
      timestamp: new Date(),
      confidence: 70
    }
    setMessages([welcomeMessage])
  }

  // Enhanced AI response function that can handle vault operations
  const handleVaultOrganization = async (userMessage: string): Promise<ChatMessage> => {
    try {
      // Create context about user's casts and vaults
      const context = {
        userCasts: userCasts.map(cast => ({
          id: cast.id,
          content: cast.cast_content,
          author: cast.username,
          tags: cast.tags || [],
          category: cast.category
        })),
        userVaults: userVaults.map(vault => ({
          id: vault.id,
          name: vault.name,
          description: vault.description
        })),
        userMessage
      }

      // Call enhanced AI service
      const aiResponse = await AIVaultOrganizer.organizeWithAI(context)
      
      // Execute any actions the AI suggested
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        for (const action of aiResponse.actions) {
          await executeAIAction(action)
        }
        
        // Refresh data after actions
        await Promise.all([
          loadUserCasts(),
          loadUserVaults(),
          loadUserStats()
        ])
        
        if (onCastUpdate) onCastUpdate()
      }

      return {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse.response,
        timestamp: new Date(),
        confidence: aiResponse.confidence,
        actions: aiResponse.actions
      }

    } catch (error) {
      console.error('Error in vault organization:', error)
      return {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: "I had trouble organizing your casts. Please try again!",
        timestamp: new Date()
      }
    }
  }

  // Execute AI-suggested actions
  const executeAIAction = async (action: any) => {
    try {
      switch (action.type) {
        case 'add_to_vault':
          if (action.castId && action.vaultId) {
            await CollectionService.addCastToCollection(action.castId, action.vaultId)
          }
          break
          
        case 'create_vault':
          if (action.vaultName) {
            await CollectionService.createCollection(
              action.vaultName,
              action.description || '',
              userId,
              false
            )
          }
          break
          
        case 'tag_cast':
          if (action.castId && action.value) {
            const cast = userCasts.find(c => c.id === action.castId)
            if (cast) {
              const newTags = [...(cast.tags || []), action.value]
              await CastService.updateCast(action.castId, userId, { tags: newTags })
            }
          }
          break
          
        case 'remove_tag':
          if (action.castId && action.value) {
            const cast = userCasts.find(c => c.id === action.castId)
            if (cast) {
              const newTags = (cast.tags || []).filter(tag => tag !== action.value)
              await CastService.updateCast(action.castId, userId, { tags: newTags })
            }
          }
          break
      }
    } catch (error) {
      console.error('Error executing AI action:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Check if this is a vault organization request
      const lowerMessage = inputMessage.toLowerCase()
      const isVaultRequest = lowerMessage.includes('organize') || 
                            lowerMessage.includes('vault') ||
                            lowerMessage.includes('categorize') ||
                            lowerMessage.includes('sort') ||
                            lowerMessage.includes('group')

      let aiMessage: ChatMessage

      if (isVaultRequest) {
        // Use enhanced vault organization
        aiMessage = await handleVaultOrganization(inputMessage.trim())
      } else {
        // Use original AI response system
        const responseContext = {
          castContent: inputMessage.trim(),
          authorUsername: 'system',
          mentionedUser: userId,
          command: determineCommand(inputMessage),
          userProfile: userProfile || undefined
        }

        const aiResponse = await AIResponseService.generateResponse(responseContext)

        aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: aiResponse.content,
          timestamp: new Date(),
          confidence: aiResponse.confidence,
          usedContexts: aiResponse.usedContexts
        }
      }

      setMessages(prev => [...prev, aiMessage])

      // Update user profile based on interaction
      await AIResponseService.updateUserProfileFromInteraction(
        userId,
        inputMessage,
        determineCommand(inputMessage)
      )

    } catch (error) {
      console.error('Failed to get AI response:', error)
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: "I'm having trouble processing that request right now. Please try again in a moment!",
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const determineCommand = (message: string): string => {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('organize') || lowerMessage.includes('vault')) return 'organize'
    if (lowerMessage.includes('analyze') || lowerMessage.includes('analysis')) return 'analysis'
    if (lowerMessage.includes('trend') || lowerMessage.includes('trending')) return 'trending'
    if (lowerMessage.includes('recommend') || lowerMessage.includes('suggest')) return 'recommendation'
    if (lowerMessage.includes('stats') || lowerMessage.includes('statistics')) return 'stats'
    if (lowerMessage.includes('help')) return 'help'
    if (lowerMessage.includes('search') || lowerMessage.includes('find')) return 'search'
    
    return 'conversational'
  }

  const handleQuickAction = async (action: string) => {
    const actionMessages: Record<string, string> = {
      'organize': 'Can you organize my casts into vaults based on their topics?',
      'stats': 'Show me my CastKPR statistics and vault organization',
      'trending': 'What are the trending topics in my saved casts?',
      'recommendations': 'Suggest how I should organize my casts into vaults',
      'analysis': 'Analyze my cast collection and suggest vault categories',
      'help': 'What can you help me with?'
    }

    const message = actionMessages[action]
    if (message) {
      setInputMessage(message)
      // Auto-send after a brief delay
      setTimeout(() => {
        handleSendMessage()
      }, 100)
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🤖 AI Assistant
          </h2>
          {stats && (
            <div className="text-sm text-gray-400">
              {stats.totalCasts} casts • {stats.totalVaults} vaults • Level {Math.floor(stats.engagementLevel * 10)}
            </div>
          )}
        </div>
        
        {userProfile && (
          <div className="text-sm text-gray-400 mt-2">
            Interests: {userProfile.interests.slice(0, 3).join(', ')}
            {userProfile.interests.length > 3 && '...'}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-white/10">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'organize', label: '🗂️ Organize', color: 'bg-yellow-500/20 text-yellow-300' },
            { key: 'stats', label: '📊 Stats', color: 'bg-blue-500/20 text-blue-300' },
            { key: 'trending', label: '🔥 Trends', color: 'bg-red-500/20 text-red-300' },
            { key: 'recommendations', label: '🎯 Recs', color: 'bg-green-500/20 text-green-300' },
            { key: 'analysis', label: '📈 Analysis', color: 'bg-purple-500/20 text-purple-300' }
          ].map(action => (
            <button
              key={action.key}
              onClick={() => handleQuickAction(action.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 ${action.color}`}
              disabled={isLoading}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-100 border border-white/20'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Show actions taken */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-2 p-2 bg-green-500/20 rounded text-xs">
                  <div className="font-medium text-green-300 mb-1">Actions taken:</div>
                  {message.actions.map((action, idx) => (
                    <div key={idx} className="text-green-200">
                      • {action.type.replace('_', ' ')}: {action.vaultName || action.value || 'completed'}
                    </div>
                  ))}
                </div>
              )}
              
              {message.type === 'ai' && message.confidence && (
                <div className="mt-2 text-xs opacity-60">
                  Confidence: {(message.confidence * 100).toFixed(0)}%
                  {message.usedContexts && message.usedContexts.length > 0 && (
                    <span className="ml-2">
                      • Contexts: {message.usedContexts.slice(0, 2).join(', ')}
                    </span>
                  )}
                </div>
              )}
              
              <div className="text-xs opacity-50 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 border border-white/20 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                <span className="text-gray-300">Organizing your casts...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to organize your casts into vaults..."
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
        
        <div className="text-xs text-gray-400 mt-2 text-center">
          Try: "organize my casts by topic" or "create a crypto vault"
        </div>
      </div>
    </div>
  )
}