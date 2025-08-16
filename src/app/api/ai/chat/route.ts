import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { messages, functions, userId, question } = await request.json()
    
    // Handle both old format (question) and new format (messages)
    const userQuestion = question || (messages && messages.length > 0 ? messages[messages.length - 1]?.content : null)
    
    console.log('🤖 AI Chat Request:', { 
      question: userQuestion, 
      userId,
      messageCount: messages?.length || 0,
      hasFunctions: !!functions
    })
    
    if (!userQuestion || !userId) {
      console.error('❌ Missing question or userId')
      return NextResponse.json({ 
        error: 'Question and userId are required' 
      }, { status: 400 })
    }

    // Use the messages directly if provided, otherwise create from question
    const chatMessages = messages || [
      {
        role: 'system',
        content: `You are a helpful AI assistant for CastKPR, a Farcaster cast management system. You can help users organize their casts into vaults, analyze patterns, and manage their knowledge base.`
      },
      {
        role: 'user',
        content: userQuestion
      }
    ]

    // Prepare the OpenAI request
    const openaiRequest: any = {
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.7,
    }

    // Add functions if provided
    if (functions && functions.length > 0) {
      openaiRequest.functions = functions
      openaiRequest.function_call = 'auto'
    }

    console.log('🔄 Sending to OpenAI:', {
      messageCount: chatMessages.length,
      functionCount: functions?.length || 0
    })

    // Get response from OpenAI
    const response = await openai.chat.completions.create(openaiRequest)
    const aiMessage = response.choices[0].message

    console.log('✅ OpenAI Response received:', {
      hasContent: !!aiMessage.content,
      hasFunctionCall: !!aiMessage.function_call
    })

    // Return the response in the format expected by AIChatPanel
    return NextResponse.json({
      content: aiMessage.content,
      function_call: aiMessage.function_call,
      usage: response.usage
    })

  } catch (error) {
    console.error('❌ AI Chat error:', error)
    return NextResponse.json({ 
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}