// src/app/api/save-shared-cast/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Received shared cast save request')
    
    const { castData, userId } = await request.json()
    
    console.log('📋 Cast data received:', {
      hash: castData.hash,
      author: castData.author.username,
      text: castData.text?.substring(0, 50) + '...',
      userId
    })
    
    // Create cast data that matches your SavedCast interface
    const castToSave = {
      username: castData.author.username || `user-${castData.author.fid}`,
      fid: castData.author.fid,
      cast_hash: castData.hash,
      cast_content: castData.text,
      cast_timestamp: castData.timestamp ? new Date(castData.timestamp).toISOString() : new Date().toISOString(),
      tags: ['shared-via-extension'] as string[],
      likes_count: 0,
      replies_count: 0,
      recasts_count: 0,
      
      // Optional fields
      cast_url: `https://warpcast.com/~/conversations/${castData.hash}`,
      author_pfp_url: castData.author.pfpUrl || undefined,
      author_display_name: castData.author.displayName || undefined,
      saved_by_user_id: userId,
      category: 'shared-extension',
      notes: `💫 Shared via extension on ${new Date().toLocaleDateString()}`,
      parsed_data: {
        urls: castData.embeds || [],
        mentions: castData.mentions?.map((m: any) => m.username) || [],
        hashtags: [],
        word_count: castData.text?.split(' ').length || 0,
        sentiment: 'neutral' as const,
        topics: []
      }
    } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
    
    console.log('💾 Attempting to save cast...')
    
    // Check if cast already exists
    try {
      const existingCast = await CastService.getCastByHash(castData.hash)
      if (existingCast) {
        console.log('⚠️ Cast already exists')
        return NextResponse.json({ 
          success: false, 
          message: 'Cast already saved!',
          castId: existingCast.id
        })
      }
    } catch (error) {
      // Cast doesn't exist, which is good - we can save it
      console.log('✅ Cast is new, proceeding to save')
    }
    
    // Save the cast
    const savedCast = await CastService.saveCast(castToSave)
    
    console.log('✅ Cast saved successfully:', savedCast.cast_hash)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cast saved successfully! 🎉',
      castId: savedCast.id,
      castHash: savedCast.cast_hash
    })
    
  } catch (error) {
    console.error('❌ Error saving shared cast:', error)
    
    // Check if it's a duplicate error
    if (error instanceof Error && error.message.includes('already saved')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Cast already saved!' 
      }, { status: 409 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to save cast',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}