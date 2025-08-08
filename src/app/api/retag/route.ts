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

interface AIAnalysisResponse {
  tags: string[]
  category: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      }, { status: 500 })
    }

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 })
    }

    console.log(`🧠 Starting AI retagging for user: ${userId}`)

    // Get all user's casts
    const casts = await CastService.getUserCasts(userId, 1000)
    
    if (casts.length === 0) {
      return NextResponse.json({ 
        success: true, 
        processed: 0, 
        errors: 0, 
        results: [],
        message: 'No casts found to process'
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

        // Skip if content is too short or already has AI category
        if (cast.cast_content.length < 10) {
          console.log(`⏭️ Skipping short cast: ${cast.cast_hash.slice(0, 10)}`)
          continue
        }

        // Generate AI tags and category
        const aiAnalysis = await analyzeWithAI(cast.cast_content, cast.username)
        
        if (!aiAnalysis) {
          throw new Error('No valid response from AI')
        }

        const { tags: newTags, category } = aiAnalysis

        // Combine existing tags with AI tags (preserve existing ones)
        const existingTags = cast.tags || []
        const combinedTags = [...new Set([...existingTags, ...newTags])]

        // Handle parsed_data properly - create new object or merge with existing
        const existingParsedData = cast.parsed_data as ParsedData || {}
        const updatedParsedData: ParsedData = {
          // Preserve existing parsed data
          urls: existingParsedData.urls || [],
          mentions: existingParsedData.mentions || [],
          hashtags: existingParsedData.hashtags || [],
          numbers: existingParsedData.numbers || [],
          dates: existingParsedData.dates || [],
          word_count: existingParsedData.word_count || cast.cast_content.split(' ').length,
          sentiment: existingParsedData.sentiment || 'neutral',
          topics: existingParsedData.topics || [],
          // Add/update AI data
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
        
        // Add delay to respect rate limits (reduce from 1000ms to 500ms for faster processing)
        if (i < casts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
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

        // Continue processing even if one fails
        continue
      }
    }

    console.log(`✅ AI retagging complete: ${processed} processed, ${errors} errors`)

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total: casts.length,
      results: results.slice(0, 10), // Return only first 10 results to avoid large responses
      summary: {
        categories: summarizeCategories(results),
        mostCommonTags: summarizeTags(results)
      }
    })

  } catch (error) {
    console.error('💥 AI retagging error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

async function analyzeWithAI(content: string, username: string): Promise<AIAnalysisResponse | null> {
  try {
    const prompt = `Analyze this social media post and provide relevant tags and category:

Content: "${content}"
Author: @${username}

Please respond with a JSON object containing:
1. "tags": An array of 3-8 relevant lowercase tags (without # symbols)
2. "category": A single category from: tech, social, business, crypto, news, entertainment, sports, science, politics, art, other

Focus on the main topics, themes, and content type. Make tags specific and useful for searching.

Example response:
{"tags": ["web3", "blockchain", "defi"], "category": "crypto"}`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" }
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return null
    }

    // Parse AI response
    const aiData = JSON.parse(aiResponse) as AIAnalysisResponse
    
    // Validate response structure
    if (!aiData.tags || !Array.isArray(aiData.tags) || !aiData.category) {
      console.warn('Invalid AI response structure:', aiData)
      return null
    }

    return {
      tags: aiData.tags.slice(0, 8), // Limit to 8 tags max
      category: aiData.category
    }

  } catch (error) {
    console.error('Error in AI analysis:', error)
    return null
  }
}

function summarizeCategories(results: RetagResult[]): Record<string, number> {
  const categories: Record<string, number> = {}
  results.forEach(result => {
    if (result.success) {
      categories[result.category] = (categories[result.category] || 0) + 1
    }
  })
  return categories
}

function summarizeTags(results: RetagResult[]): Array<{ tag: string; count: number }> {
  const tagCounts: Record<string, number> = {}
  results.forEach(result => {
    if (result.success) {
      result.newTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    }
  })
  
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10 tags
}