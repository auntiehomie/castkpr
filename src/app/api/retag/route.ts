import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import { AITaggingService } from '@/lib/ai-tagging'

export async function POST(request: NextRequest) {
  try {
    const { userId, castId, mode = 'single' } = await request.json()

    console.log('🏷️ Starting AI retagging process...')
    console.log('👤 User ID:', userId)
    console.log('📝 Mode:', mode)

    if (mode === 'single' && castId) {
      // Retag a single cast
      const cast = await CastService.getCastByHash(castId)
      
      if (!cast || cast.saved_by_user_id !== userId) {
        return NextResponse.json({ error: 'Cast not found or not owned by user' }, { status: 404 })
      }

      console.log('🧠 Analyzing single cast:', cast.cast_hash)
      const analysis = await AITaggingService.analyzeAndTag(cast.cast_content, cast.username)
      
      // Combine new AI tags with existing manual tags
      const existingTags = cast.tags || []
      const manualTags = existingTags.filter(tag => 
        !['saved-via-bot', 'general', 'shared-cast'].includes(tag)
      )
      
      const newTags = [
        ...analysis.tags,
        ...manualTags,
        'ai-tagged'
      ].filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates

      const updatedCast = await CastService.updateCast(cast.id, userId, {
        tags: newTags,
        category: analysis.category,
        notes: cast.notes ? 
          `${cast.notes}\n\n🤖 AI retagged on ${new Date().toLocaleDateString()}` :
          `🤖 AI tagged on ${new Date().toLocaleDateString()}`
      })

      return NextResponse.json({
        success: true,
        message: 'Cast retagged successfully',
        cast: {
          id: updatedCast.id,
          oldTags: existingTags,
          newTags: newTags,
          category: analysis.category
        }
      })

    } else if (mode === 'bulk') {
      // Retag all casts for a user
      const userCasts = await CastService.getUserCasts(userId, 100)
      
      if (userCasts.length === 0) {
        return NextResponse.json({ 
          success: true, 
          message: 'No casts found to retag',
          processed: 0 
        })
      }

      console.log(`🔄 Bulk retagging ${userCasts.length} casts...`)
      
      const results = []
      let processed = 0
      let errors = 0

      for (const cast of userCasts) {
        try {
          console.log(`🏷️ Processing cast ${processed + 1}/${userCasts.length}`)
          
          const analysis = await AITaggingService.analyzeAndTag(cast.cast_content, cast.username)
          
          // Combine new AI tags with existing manual tags
          const existingTags = cast.tags || []
          const manualTags = existingTags.filter(tag => 
            !['saved-via-bot', 'general', 'shared-cast', 'ai-tagged'].includes(tag)
          )
          
          const newTags = [
            ...analysis.tags,
            ...manualTags,
            'ai-tagged'
          ].filter((tag, index, array) => array.indexOf(tag) === index)

          await CastService.updateCast(cast.id, userId, {
            tags: newTags,
            category: analysis.category
          })

          results.push({
            id: cast.id,
            hash: cast.cast_hash,
            oldTags: existingTags,
            newTags: newTags,
            category: analysis.category
          })

          processed++
          
          // Rate limiting: wait 1 second between requests
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (error) {
          console.error(`❌ Error processing cast ${cast.cast_hash}:`, error)
          errors++
        }
      }

      return NextResponse.json({
        success: true,
        message: `Bulk retagging completed`,
        processed,
        errors,
        results: results.slice(0, 10) // Return first 10 for preview
      })
    }

    return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 })

  } catch (error) {
    console.error('💥 Error in retag API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}