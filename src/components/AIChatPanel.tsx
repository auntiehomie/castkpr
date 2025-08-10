'use client'

import { useState, useEffect, useRef } from 'react'
import { AIResponseService } from '@/lib/ai-responses'
import { CastService, UserAIProfileService, AIContextService } from '@/lib/supabase'
import type { UserAIProfile } from '@/lib/supabase'

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
}

export default function AIChatPanel({ userId, onCastUpdate }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<UserAIProfile | null>(null)
  const [stats, setStats] = useState<{
    totalCasts: number
    topTopics: string[]
    engagementLevel: number
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUserProfile()
    loadUserStats()
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

  const loadUserStats = async () => {
    try {
      const userStats = await CastService.getUserStats(userId)
      const userCasts = await CastService.getUserCasts(userId, 100)
      
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
      content: `👋 Hi! I'm your CastKPR AI assistant. I can help you with:

🔍 **Analyzing your saved casts**
📊 **Understanding trends in your collection**
🎯 **Getting personalized recommendations**
💡 **Insights about content patterns**
🤖 **General questions about your cast library**

What would you like to explore today?`,
      timestamp: new Date()
    }
    setMessages([welcomeMessage])
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
      // Generate AI response based on the user's message
      const responseContext = {
        castContent: inputMessage.trim(),
        authorUsername: 'system',
        mentionedUser: userId,
        command: determineCommand(inputMessage),
        userProfile: userProfile || undefined
      }

      const aiResponse = await AIResponseService.generateResponse(responseContext)

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse.content,
        timestamp: new Date(),
        confidence: aiResponse.confidence,
        usedContexts: aiResponse.usedContexts
      }

      setMessages(prev => [...prev, aiMessage])

      // Update user profile based on interaction
      await AIResponseService.updateUserProfileFromInteraction(
        userId,
        inputMessage,
        determineCommand(inputMessage)
      )

      // Refresh cast data if needed
      if (onCastUpdate && inputMessage.toLowerCase().includes('save')) {
        onCastUpdate()
      }

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
      'stats': 'Show me my CastKPR statistics and insights',
      'trending': 'What are the trending topics in my saved casts?',
      'recommendations': 'Give me personalized content recommendations',
      'analysis': 'Analyze my cast collection and show patterns',
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
              {stats.totalCasts} casts • Level {Math.floor(stats.engagementLevel * 10)}
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
                <span className="text-gray-300">Thinking...</span>
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
            placeholder="Ask me anything about your casts..."
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
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}