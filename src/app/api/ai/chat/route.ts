import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import { AIService } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const { question, userId } = await request.json()
    
    console.log('🤖 AI Chat Request:', { question, userId })
    
    if (!question || !userId) {
      console.error('❌ Missing question or userId')
      return NextResponse.json({ 
        error: 'Question and userId are required' 
      }, { status: 400 })
    }

    // Get user's casts with IDs for function calling
    console.log('📊 Fetching casts for user:', userId)
    const userCasts = await CastService.getUserCasts(userId, 50)
    console.log('✅ Found casts:', userCasts.length)
    
    if (userCasts.length === 0) {
      console.log('⚠️ No casts found for user')
      return NextResponse.json({ 
        response: `I don't see any saved casts for you yet! Start saving some casts by replying "@cstkpr save this" to any cast on Farcaster, then come back and ask me questions about them.` 
      })
    }

    // Format casts for AI with IDs and tags for function calling
    const castsForAI = userCasts.map(cast => ({
      id: cast.id,
      content: cast.cast_content,
      author: cast.username,
      timestamp: cast.cast_timestamp,
      tags: cast.tags || []
    }))
    
    console.log('🔄 Sending to AI:', {
      castCount: castsForAI.length,
      question: question.slice(0, 50) + '...'
    })

    // Get AI response with potential actions
    const aiResult = await AIService.chatAboutCasts(question, castsForAI)
    console.log('✅ AI Response received:', {
      hasResponse: !!aiResult.response,
      hasActions: !!aiResult.actions,
      actionCount: aiResult.actions?.length || 0
    })

    // Execute any actions the AI requested
    const executionResults: string[] = []
    
    if (aiResult.actions && aiResult.actions.length > 0) {
      console.log('🎬 Executing AI actions:', aiResult.actions)
      
      for (const action of aiResult.actions) {
        try {
          switch (action.type) {
            case 'add_tag':
              console.log(`🏷️ Adding tag "${action.value}" to cast ${action.castId}`)
              
              // Get current cast
              const cast = userCasts.find(c => c.id === action.castId)
              if (!cast) {
                executionResults.push(`❌ Cast not found: ${action.castId}`)
                continue
              }
              
              // Add tag if it doesn't exist
              const currentTags = cast.tags || []
              if (!currentTags.includes(action.value)) {
                const updatedTags = [...currentTags, action.value]
                await CastService.updateCast(action.castId, userId, {
                  tags: updatedTags
                })
                executionResults.push(`✅ Added tag "${action.value}" to cast by @${cast.username}`)
              } else {
                executionResults.push(`⚠️ Tag "${action.value}" already exists on cast by @${cast.username}`)
              }
              break

            case 'remove_tag':
              console.log(`🗑️ Removing tag "${action.value}" from cast ${action.castId}`)
              
              const castToUntag = userCasts.find(c => c.id === action.castId)
              if (!castToUntag) {
                executionResults.push(`❌ Cast not found: ${action.castId}`)
                continue
              }
              
              const tagsAfterRemoval = (castToUntag.tags || []).filter(tag => tag !== action.value)
              await CastService.updateCast(action.castId, userId, {
                tags: tagsAfterRemoval
              })
              executionResults.push(`✅ Removed tag "${action.value}" from cast by @${castToUntag.username}`)
              break

            case 'add_note':
              console.log(`📝 Adding note to cast ${action.castId}`)
              
              const castToNote = userCasts.find(c => c.id === action.castId)
              if (!castToNote) {
                executionResults.push(`❌ Cast not found: ${action.castId}`)
                continue
              }
              
              await CastService.updateCast(action.castId, userId, {
                notes: action.value
              })
              executionResults.push(`✅ Added note to cast by @${castToNote.username}`)
              break

            default:
              executionResults.push(`❌ Unknown action type: ${action.type}`)
          }
        } catch (actionError) {
          console.error(`❌ Error executing action:`, actionError)
          executionResults.push(`❌ Failed to execute action: ${actionError instanceof Error ? actionError.message : 'Unknown error'}`)
        }
      }
    }

    // Combine AI response with execution results
    let finalResponse = aiResult.response
    
    if (executionResults.length > 0) {
      finalResponse += '\n\n**Actions Completed:**\n' + executionResults.join('\n')
    }
    
    return NextResponse.json({ 
      response: finalResponse,
      actionsExecuted: aiResult.actions?.length || 0
    })
    
  } catch (error) {
    console.error('💥 AI Chat API Error:', error)
    
    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('OpenAI')) {
        return NextResponse.json({ 
          response: 'Sorry, there was an issue with the AI service. Please try again later.' 
        })
      }
      if (error.message.includes('database') || error.message.includes('supabase')) {
        return NextResponse.json({ 
          response: 'Sorry, there was an issue accessing your saved casts. Please try again.' 
        })
      }
    }
    
    return NextResponse.json({ 
      response: 'Sorry, something went wrong. Please try again later.' 
    })
  }
}