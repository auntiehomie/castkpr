import { NextRequest, NextResponse } from 'next/server'
import { CastService, supabase, ContentParser, AIContextService } from '@/lib/supabase'
import { AIResponseService } from '@/lib/ai-responses'
import type { SavedCast } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🏷️ Retag request received')
    
    const body = await request.json()
    const { 
      castId, 
      userId, 
      newTags, 
      autoTag = false, 
      replaceExisting = false,
      bulkOperation = false,
      castIds = []
    } = body
    
    // Validate required parameters
    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 })
    }
    
    if (bulkOperation) {
      if (!castIds || castIds.length === 0) {
        return NextResponse.json({ 
          error: 'Cast IDs array is required for bulk operations' 
        }, { status: 400 })
      }
      
      return await handleBulkRetag(castIds, userId, newTags, autoTag, replaceExisting)
    } else {
      if (!castId) {
        return NextResponse.json({ 
          error: 'Cast ID is required for single retag' 
        }, { status: 400 })
      }
      
      return await handleSingleRetag(castId, userId, newTags, autoTag, replaceExisting)
    }
    
  } catch (error) {
    console.error('💥 Retag error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const castId = searchParams.get('castId')
    const suggestTags = searchParams.get('suggestTags') === 'true'
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 })
    }
    
    if (castId) {
      // Get suggestions for a specific cast
      return await getSuggestedTags(castId, userId)
    } else if (suggestTags) {
      // Get popular tags from user's collection
      return await getPopularTags(userId)
    } else {
      // Get all user's tags
      return await getAllUserTags(userId)
    }
    
  } catch (error) {
    console.error('💥 Retag GET error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleSingleRetag(
  castId: string, 
  userId: string, 
  newTags?: string[], 
  autoTag: boolean = false, 
  replaceExisting: boolean = false
) {
  console.log(`🏷️ Retagging single cast ${castId} for user ${userId}`)
  
  try {
    // Get the cast first
    const { data: cast, error: fetchError } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('id', castId)
      .eq('saved_by_user_id', userId)
      .single()
    
    if (fetchError || !cast) {
      return NextResponse.json({ 
        error: 'Cast not found or not owned by user' 
      }, { status: 404 })
    }
    
    let finalTags: string[] = []
    
    if (autoTag) {
      // Generate AI-powered tags
      console.log('🤖 Generating AI-powered tags...')
      const suggestedTags = await generateAITags(cast)
      finalTags = suggestedTags
    } else if (newTags) {
      finalTags = newTags
    } else {
      return NextResponse.json({ 
        error: 'Either newTags must be provided or autoTag must be true' 
      }, { status: 400 })
    }
    
    // Combine with existing tags if not replacing
    if (!replaceExisting && cast.tags) {
      finalTags = [...new Set([...cast.tags, ...finalTags])]
    }
    
    // Remove duplicates and clean tags
    finalTags = [...new Set(finalTags)]
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => tag.length > 0)
      .slice(0, 20) // Limit to 20 tags max
    
    // Update the cast
    const { data: updatedCast, error: updateError } = await supabase
      .from('saved_casts')
      .update({ 
        tags: finalTags,
        updated_at: new Date().toISOString()
      })
      .eq('id', castId)
      .eq('saved_by_user_id', userId)
      .select()
      .single()
    
    if (updateError) {
      console.error('❌ Error updating cast tags:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update cast tags' 
      }, { status: 500 })
    }
    
    console.log(`✅ Successfully retagged cast ${castId}`)
    
    return NextResponse.json({
      success: true,
      message: 'Cast successfully retagged',
      cast: updatedCast,
      addedTags: finalTags.filter(tag => !cast.tags?.includes(tag)),
      totalTags: finalTags.length
    })
    
  } catch (error) {
    console.error('❌ Single retag error:', error)
    return NextResponse.json({ 
      error: 'Failed to retag cast',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleBulkRetag(
  castIds: string[], 
  userId: string, 
  newTags?: string[], 
  autoTag: boolean = false, 
  replaceExisting: boolean = false
) {
  console.log(`🏷️ Bulk retagging ${castIds.length} casts for user ${userId}`)
  
  try {
    const results: Array<{ castId: string; success: boolean; [key: string]: any }> = []
    const errors: Array<{ castId: string; error: string }> = []
    
    // Process casts in batches of 5 to avoid overwhelming the system
    const batchSize = 5
    for (let i = 0; i < castIds.length; i += batchSize) {
      const batch = castIds.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (castId) => {
        try {
          const result = await handleSingleRetag(castId, userId, newTags, autoTag, replaceExisting)
          const resultData = await result.json()
          
          if (result.status === 200) {
            results.push({ castId, success: true, ...resultData })
          } else {
            errors.push({ castId, error: resultData.error })
          }
        } catch (error) {
          errors.push({ 
            castId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      })
      
      await Promise.all(batchPromises)
      
      // Small delay between batches
      if (i + batchSize < castIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    console.log(`✅ Bulk retag completed: ${results.length} success, ${errors.length} errors`)
    
    return NextResponse.json({
      success: true,
      message: `Bulk retag completed`,
      summary: {
        totalCasts: castIds.length,
        successful: results.length,
        failed: errors.length
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    })
    
  } catch (error) {
    console.error('❌ Bulk retag error:', error)
    return NextResponse.json({ 
      error: 'Bulk retag operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function generateAITags(cast: SavedCast): Promise<string[]> {
  console.log('🤖 Generating AI tags for cast:', cast.id)
  
  try {
    // Use content parser first
    const parsedData = ContentParser.parseContent(cast.cast_content)
    const baseTags = [
      ...(parsedData.hashtags || []),
      ...(parsedData.topics || [])
    ]
    
    // Generate AI-powered tags using the response service
    const responseContext = {
      castContent: cast.cast_content,
      authorUsername: cast.username,
      mentionedUser: cast.saved_by_user_id || 'user',
      command: 'generate_tags'
    }
    
    const aiResponse = await AIResponseService.generateResponse(responseContext)
    
    // Extract suggested tags from AI response
    // This is a simple extraction - you could enhance this
    const aiTags = extractTagsFromAIResponse(aiResponse.content)
    
    // Combine and deduplicate
    const allTags: string[] = [...new Set([...baseTags, ...aiTags])]
      .filter(tag => tag.length > 2 && tag.length < 30)
      .slice(0, 15)
    
    console.log(`✅ Generated ${allTags.length} AI tags`)
    return allTags
    
  } catch (error) {
    console.error('❌ AI tag generation failed:', error)
    
    // Fallback to basic content parsing
    const parsedData = ContentParser.parseContent(cast.cast_content)
    return [
      ...(parsedData.hashtags || []),
      ...(parsedData.topics || []),
      'ai-tagged'
    ].slice(0, 10)
  }
}

async function getSuggestedTags(castId: string, userId: string) {
  console.log(`🔍 Getting tag suggestions for cast ${castId}`)
  
  try {
    // Get the cast
    const { data: cast, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('id', castId)
      .eq('saved_by_user_id', userId)
      .single()
    
    if (error || !cast) {
      return NextResponse.json({ 
        error: 'Cast not found' 
      }, { status: 404 })
    }
    
    // Generate AI suggestions
    const aiTags = await generateAITags(cast)
    
    // Get popular tags from user's other casts
    const userTags = await getPopularTagsInternal(userId)
    
    // Get trending tags from community
    const trendingTags = await getTrendingTags()
    
    return NextResponse.json({
      currentTags: cast.tags || [],
      suggestions: {
        ai: aiTags,
        popular: userTags.slice(0, 10),
        trending: trendingTags.slice(0, 8)
      }
    })
    
  } catch (error) {
    console.error('❌ Error getting tag suggestions:', error)
    return NextResponse.json({ 
      error: 'Failed to get tag suggestions' 
    }, { status: 500 })
  }
}

async function getPopularTags(userId: string) {
  console.log(`📊 Getting popular tags for user ${userId}`)
  
  try {
    const tags = await getPopularTagsInternal(userId)
    
    return NextResponse.json({
      popularTags: tags.slice(0, 20),
      totalUniqueTags: tags.length
    })
    
  } catch (error) {
    console.error('❌ Error getting popular tags:', error)
    return NextResponse.json({ 
      error: 'Failed to get popular tags' 
    }, { status: 500 })
  }
}

async function getAllUserTags(userId: string) {
  console.log(`📋 Getting all tags for user ${userId}`)
  
  try {
    const { data: casts, error } = await supabase
      .from('saved_casts')
      .select('tags')
      .eq('saved_by_user_id', userId)
    
    if (error) {
      return NextResponse.json({ 
        error: 'Failed to fetch user tags' 
      }, { status: 500 })
    }
    
    const allTags = casts?.flatMap(cast => cast.tags || []) || []
    const uniqueTags = [...new Set(allTags)].sort()
    
    // Count tag frequency
    const tagCounts = allTags.reduce((acc: Record<string, number>, tag) => {
      acc[tag] = (acc[tag] || 0) + 1
      return acc
    }, {})
    
    const tagStats = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
    
    return NextResponse.json({
      allTags: uniqueTags,
      tagStats,
      totalCasts: casts?.length || 0,
      totalUniqueTags: uniqueTags.length
    })
    
  } catch (error) {
    console.error('❌ Error getting all user tags:', error)
    return NextResponse.json({ 
      error: 'Failed to get user tags' 
    }, { status: 500 })
  }
}

// Helper functions
async function getPopularTagsInternal(userId: string): Promise<string[]> {
  const { data: casts } = await supabase
    .from('saved_casts')
    .select('tags')
    .eq('saved_by_user_id', userId)
  
  const allTags: string[] = casts?.flatMap(cast => cast.tags || []) || []
  const tagCounts: Record<string, number> = allTags.reduce((acc: Record<string, number>, tag) => {
    acc[tag] = (acc[tag] || 0) + 1
    return acc
  }, {})
  
  return Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .map(([tag]) => tag)
}

async function getTrendingTags(): Promise<string[]> {
  // Get tags from recent casts across all users
  const { data: recentCasts } = await supabase
    .from('saved_casts')
    .select('tags')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(200)
  
  const allTags: string[] = recentCasts?.flatMap(cast => cast.tags || []) || []
  const tagCounts: Record<string, number> = allTags.reduce((acc: Record<string, number>, tag) => {
    acc[tag] = (acc[tag] || 0) + 1
    return acc
  }, {})
  
  return Object.entries(tagCounts)
    .filter(([, count]) => count > 1) // Only tags used more than once
    .sort(([,a], [,b]) => b - a)
    .map(([tag]) => tag)
    .slice(0, 10)
}

function extractTagsFromAIResponse(aiContent: string): string[] {
  // Simple tag extraction from AI response
  // You could enhance this with more sophisticated NLP
  const words: string[] = aiContent.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && word.length < 20)
  
  // Common keywords that make good tags
  const tagKeywords: string[] = [
    'crypto', 'nft', 'defi', 'web3', 'blockchain', 'ethereum', 'bitcoin',
    'art', 'music', 'gaming', 'sports', 'politics', 'tech', 'ai', 'ml',
    'startup', 'venture', 'investment', 'trading', 'market', 'finance',
    'social', 'community', 'meme', 'culture', 'philosophy', 'science',
    'development', 'programming', 'design', 'marketing', 'business'
  ]
  
  return words
    .filter(word => tagKeywords.includes(word))
    .slice(0, 8)
}

export async function PUT(request: NextRequest) {
  // Handle tag updates (alias for POST)
  return POST(request)
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const castId = searchParams.get('castId')
    const userId = searchParams.get('userId')
    const tagToRemove = searchParams.get('tag')
    
    if (!castId || !userId || !tagToRemove) {
      return NextResponse.json({ 
        error: 'Cast ID, User ID, and tag are required' 
      }, { status: 400 })
    }
    
    // Get current cast
    const { data: cast, error: fetchError } = await supabase
      .from('saved_casts')
      .select('tags')
      .eq('id', castId)
      .eq('saved_by_user_id', userId)
      .single()
    
    if (fetchError || !cast) {
      return NextResponse.json({ 
        error: 'Cast not found' 
      }, { status: 404 })
    }
    
    // Remove the tag
    const updatedTags = (cast.tags || []).filter((tag: string) => tag !== tagToRemove)
    
    // Update the cast
    const { error: updateError } = await supabase
      .from('saved_casts')
      .update({ 
        tags: updatedTags,
        updated_at: new Date().toISOString()
      })
      .eq('id', castId)
      .eq('saved_by_user_id', userId)
    
    if (updateError) {
      return NextResponse.json({ 
        error: 'Failed to remove tag' 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Tag removed successfully',
      removedTag: tagToRemove,
      remainingTags: updatedTags
    })
    
  } catch (error) {
    console.error('❌ Delete tag error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete tag' 
    }, { status: 500 })
  }
}