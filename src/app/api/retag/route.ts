// src/app/api/retag/route.ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CastService, type ParsedData } from '@/lib/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface RetagResult {
  hash: string
  newTags: string[]
  category: string
  success: boolean
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId, mode } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      }, { status: 500 })
    }

    console.log(`🧠 Starting AI retagging for user: ${userId}`)

    // Get all user's casts
    const casts = await CastService.getUserCasts(userId, 1000) // Get more casts
    
    if (casts.length === 0) {
      return NextResponse.json({ 
        success: true, 
        processed: 0, 
        errors: 0, 
        results: [] 
      })
    }

    console.log(`📊 Found ${casts.length} casts to process`)

    const results: RetagResult[] = []
    let processed = 0
    let errors = 0

    // Process casts in batches to avoid rate limits
    for (let i = 0; i < casts.length; i++) {
      const cast = casts[i]
      
      try {
        console.log(`🔄 Processing cast ${i + 1}/${casts.length}: ${cast.cast_hash.slice(0, 10)}...`)

        // Generate AI tags and category
        const prompt = `Analyze this social media post and provide relevant tags and category:

Content: "${cast.cast_content}"
Author: @${cast.username}

Please respond with a JSON object containing:
1. "tags": An array of 3-8 relevant lowercase tags (without # symbols)
2. "category": A single category from: tech, social, business, crypto, news, entertainment, sports, science, politics, art, other

Focus on the main topics, themes, and content type. Make tags specific and useful for searching.`

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 200
        })

        const aiResponse = completion.choices[0]?.message?.content
        if (!aiResponse) {
          throw new Error('No response from AI')
        }

        // Parse AI response
        const aiData = JSON.parse(aiResponse)
        const newTags = aiData.tags || []
        const category = aiData.category || 'other'

        // Combine existing tags with AI tags (preserve existing ones)
        const existingTags = cast.tags || []
        const combinedTags = [...new Set([...existingTags, ...newTags])]

        // Handle parsed_data properly - create new object or merge with existing
        const existingParsedData = cast.parsed_data || {}
        const updatedParsedData: ParsedData = {
          // Preserve existing parsed data
          urls: existingParsedData.urls || [],
          mentions: existingParsedData.mentions || [],
          hashtags: existingParsedData.hashtags || [],
          numbers: existingParsedData.numbers || [],
          dates: existingParsedData.dates || [],
          word_count: existingParsedData.word_count || 0,
          sentiment: existingParsedData.sentiment || 'neutral',
          // Add/update AI data
          topics: newTags,
          ai_category: category,
          ai_tags: newTags
        }

        // Update the cast in database
        await CastService.updateCast(cast.id, userId, {
          tags: combinedTags,
          category: category,
          parsed_data: updatedParsedData
        })

        results.push({
          hash: cast.cast_hash,
          newTags,
          category,
          success: true
        })

        processed++
        
        // Add delay to respect rate limits
        if (i < casts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
        }

      } catch (error) {
        console.error(`❌ Error processing cast ${cast.cast_hash}:`, error)
        errors++
        
        results.push({
          hash: cast.cast_hash,
          newTags: [],
          category: 'other',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`✅ AI retagging complete: ${processed} processed, ${errors} errors`)

    return NextResponse.json({
      success: true,
      processed,
      errors,
      results
    })

  } catch (error) {
    console.error('💥 AI retagging error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}