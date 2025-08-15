// src/app/api/save-shared-cast/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CastService, supabase } from '@/lib/supabase'
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
    
    // Check if cast already exists first
    try {
      const { data: existingCast } = await supabase
        .from('saved_casts')
        .select('id')
        .eq('cast_hash', castData.hash)
        .eq('saved_by_user_id', userId)
        .single()

      if (existingCast) {
        console.log('⚠️ Cast already exists for this user')
        return NextResponse.json({ 
          success: false, 
          message: 'Cast already saved!',
          castId: existingCast.id
        })
      }
    } catch (error: any) {
      // Expected error if cast doesn't exist (PGRST116)
      console.log('✅ Cast is new, proceeding to save')
    }
    
    // Create cast data with the exact same structure as the working webhook
    const castToSave = {
      username: castData.author.username || `user-${castData.author.fid}`,
      fid: castData.author.fid,
      cast_hash: castData.hash,
      cast_content: castData.text,
      cast_timestamp: castData.timestamp ? new Date(castData.timestamp).toISOString() : new Date().toISOString(),
      tags: ['shared-via-extension'],
      likes_count: 0,
      replies_count: 0,
      recasts_count: 0,
      
      // Optional fields
      cast_url: `https://warpcast.com/~/conversations/${castData.hash}`,
      author_pfp_url: castData.author.pfpUrl,
      author_display_name: castData.author.displayName,
      saved_by_user_id: userId,
      category: 'shared-extension',
      notes: `💫 Shared via extension on ${new Date().toLocaleDateString()}`,
      parsed_data: {
        urls: castData.embeds || [],
        mentions: castData.mentions?.map((m: any) => m.username) || [],
        hashtags: [...(castData.text?.matchAll(/#(\w+)/g) || [])].map((match: any) => match[1]),
        word_count: castData.text?.split(' ').length || 0,
        sentiment: 'neutral',
        topics: ['shared']
      }
    }
    
    console.log('💾 Attempting to save cast with data structure:', {
      username: castToSave.username,
      fid: castToSave.fid,
      cast_hash: castToSave.cast_hash,
      saved_by_user_id: castToSave.saved_by_user_id,
      content_length: castToSave.cast_content?.length
    })
    
    // Try direct Supabase insert first to see exact error
    const { data: insertedCast, error: insertError } = await supabase
      .from('saved_casts')
      .insert([castToSave])
      .select()
      .single()

    if (insertError) {
      console.error('❌ Direct Supabase insert failed:', insertError)
      console.error('❌ Insert error details:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      })
      
      return NextResponse.json({ 
        error: 'Database insert failed',
        details: insertError.message,
        code: insertError.code
      }, { status: 500 })
    }

    console.log('✅ Cast saved successfully via direct insert:', insertedCast.cast_hash)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cast saved successfully! 🎉',
      castId: insertedCast.id,
      castHash: insertedCast.cast_hash
    })
    
  } catch (error) {
    console.error('❌ Error saving shared cast:', error)
    console.error('❌ Full error object:', JSON.stringify(error, null, 2))
    
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