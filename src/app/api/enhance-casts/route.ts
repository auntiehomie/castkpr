import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import { analyzeCast } from '@/lib/cast-analyzer'

export async function POST(request: NextRequest) {
  try {
    const { userId, limit = 50, offset = 0 } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    console.log(`🔄 Starting cast enhancement for user: ${userId}`)
    console.log(`📊 Processing batch: limit=${limit}, offset=${offset}`)

    // Get user's casts that need enhancement  
    console.log(`📦 Fetching casts for processing...`)
    
    // Get all casts for the user (we'll implement our own pagination logic)
    const allCasts = await CastService.getUserCasts(userId, 1000) // Get a large batch
    
    // Implement offset-based pagination
    const casts = allCasts.slice(offset, offset + limit)
    console.log(`� Processing batch ${offset}-${offset + casts.length} of ${allCasts.length} total casts`)

    // Filter casts that don't have quality analysis yet
    const castsNeedingEnhancement = casts.filter(cast => {
      const parsedData = cast.parsed_data as any
      return !parsedData?.user_quality_analysis && cast.cast_hash
    })

    console.log(`🧠 ${castsNeedingEnhancement.length} casts need AI enhancement`)

    let enhanced = 0
    let failed = 0
    const results = []

    for (const cast of castsNeedingEnhancement) {
      try {
        console.log(`🔍 Analyzing cast: ${cast.cast_hash}`)
        
        // Run cast through analyzer
        const analysis = await analyzeCast(cast.cast_hash, {
          hash: cast.cast_hash,
          text: cast.cast_content,
          timestamp: cast.cast_timestamp,
          author: {
            fid: cast.fid,
            username: cast.username,
            display_name: cast.author_display_name,
            pfp_url: cast.author_pfp_url
          },
          reactions: {
            likes_count: cast.likes_count || 0,
            recasts_count: cast.recasts_count || 0
          },
          replies: {
            count: cast.replies_count || 0
          },
          parsed_data: cast.parsed_data,
          cast_url: cast.cast_url || `https://warpcast.com/~/conversations/${cast.cast_hash}`,
          embeds: []
        })

        if (analysis && analysis.parsed_data) {
          // Update the cast with enhanced parsed data
          await CastService.updateCastParsedData(cast.id, analysis.parsed_data)
          enhanced++
          results.push({
            castId: cast.id,
            castHash: cast.cast_hash,
            status: 'enhanced',
            hasQualityAnalysis: !!analysis.parsed_data.user_quality_analysis
          })
          console.log(`✅ Enhanced cast ${cast.cast_hash}`)
        } else {
          failed++
          results.push({
            castId: cast.id,
            castHash: cast.cast_hash,
            status: 'failed',
            error: 'No analysis data returned'
          })
          console.log(`❌ Failed to enhance cast ${cast.cast_hash}`)
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        failed++
        console.error(`❌ Error enhancing cast ${cast.cast_hash}:`, error)
        results.push({
          castId: cast.id,
          castHash: cast.cast_hash,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`🎯 Enhancement complete: ${enhanced} enhanced, ${failed} failed`)

    return NextResponse.json({
      success: true,
      processed: castsNeedingEnhancement.length,
      enhanced,
      failed,
      totalCasts: casts.length,
      hasMore: casts.length === limit,
      nextOffset: offset + limit,
      results
    })

  } catch (error) {
    console.error('❌ Error in enhance-casts endpoint:', error)
    return NextResponse.json({
      error: 'Failed to enhance casts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
