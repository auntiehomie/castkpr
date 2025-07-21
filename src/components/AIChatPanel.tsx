// src/components/AIChatPanel.tsx
'use client'

import { useState } from 'react'

interface Message {
  id: string
  text: string
  isAi: boolean
  timestamp: Date
  isError?: boolean
  hasActions?: boolean
}

interface AIChatPanelProps {
  userId: string
  onCastUpdate?: () => void // Callback to refresh cast data
}

export default function AIChatPanel({ userId, onCastUpdate }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your CastKPR AI assistant. I can help you understand your saved casts AND take actions on them!\n\nTry asking me:\n• \"Tag my crypto casts with 'defi'\"\n• \"Add a note to my latest cast\"\n• \"What are my top topics?\"\n• \"Remove the 'test' tag from my casts\"",
      isAi: true,
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isAi: false,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setLoading(true)

    try {
      console.log('🤖 Sending AI request:', { question: currentInput, userId })
      
      // Call your AI API endpoint
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentInput,
          userId: userId
        })
      })

      console.log('📡 AI Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const data = await response.json()
      console.log('📋 AI Response data:', data)

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || "I couldn't process that right now. Try asking about your saved casts!",
        isAi: true,
        timestamp: new Date(),
        isError: !data.response,
        hasActions: data.actionsExecuted > 0
      }

      setMessages(prev => [...prev, aiMessage])

      // If actions were executed, refresh the cast data
      if (data.actionsExecuted > 0 && onCastUpdate) {
        console.log('🔄 Refreshing cast data after AI actions')
        onCastUpdate()
      }

    } catch (error) {
      console.error('❌ AI chat error:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I'm having trouble right now. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check if you have saved casts and try again!`,
        isAi: true,
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 h-96 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          🤖 CastKPR AI Assistant
        </h3>
        <p className="text-sm text-gray-400">Ask questions & take actions on your casts • User: {userId}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isAi ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.isAi
                  ? message.isError 
                    ? 'bg-red-600/20 text-red-100' 
                    : message.hasActions
                    ? 'bg-green-600/20 text-green-100 border border-green-500/30'
                    : 'bg-purple-600/20 text-purple-100'
                  : 'bg-blue-600/20 text-blue-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
              <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
                {message.timestamp.toLocaleTimeString()}
                {message.isError && ' • Error'}
                {message.hasActions && ' • ⚡ Actions Executed'}
              </p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-purple-600/20 text-purple-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                <span className="text-sm">Thinking and taking actions...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask me to tag, organize, or analyze your casts..."
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Send
          </button>
        </div>
        
        {/* Suggested actions */}
        <div className="mt-2 flex flex-wrap gap-1">
          {[
            "Tag crypto casts with 'defi'",
            "What are my top topics?",
            "Add 'important' tag to latest cast"
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              disabled={loading}
              className="text-xs bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-300 px-2 py-1 rounded transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}