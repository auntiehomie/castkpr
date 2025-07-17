import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Webhook received!')
    
    // Debug environment variables
    console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing')
    console.log('🔍 Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'Missing')
    
    const body = await request.json()
    console.log('📦 Webhook payload received')
    
    // Check event type
    if (body.type !== 'cast.created') {
      console.log('❌ Not a cast.created event, skipping')
      return NextResponse.json({ message: 'Event type not handled' })
    }
    
    const cast = body.data
    console.log('📝 Processing cast from:', cast.author.username)
    
    // Check for mentions
    const mentions = cast.mentioned_profiles || []
    const mentionsBot = mentions.some((profile: { username?: string; fid?: number }) => {
      return profile.username === 'cstkpr'
    })
    
    console.log('🤖 Bot mentioned?', mentionsBot)
    
    if (!mentionsBot) {
      console.log('❌ Bot not mentioned, skipping')
      return NextResponse.json({ message: 'Bot not mentioned' })
    }
    
    // Check for save command
    const text = cast.text.toLowerCase()
    console.log('💬 Cast text:', text)
    
    const isSaveCommand = text.includes('save this') || text.includes('save')
    console.log('💾 Is save command?', isSaveCommand)
    
    if (!isSaveCommand) {
      console.log('❌ Not a save command, skipping')
      return NextResponse.json({ message: 'Not a save command' })
    }
    
    // Check for parent hash
    const parentHash = cast.parent_hash
    console.log('👆 Parent hash:', parentHash)
    console.log('📋 Full cast data keys:', Object.keys(cast))
    console.log('📋 Cast parent data:', JSON.stringify({
      parent_hash: cast.parent_hash,
      parent_url: cast.parent_url,
      parent_author: cast.parent_author,
      thread_hash: cast.thread_hash
    }, null, 2))
    
    if (!parentHash) {
      console.log('❌ No parent cast to save')
      return NextResponse.json({ message: 'No parent cast to save' })
    }
    
    // Since the paid API is required, let's work with available webhook data
    console.log('💡 Using webhook data instead of API call...')
    
    // Create cast data that matches your SavedCast interface exactly
    const castData = {
      // Required fields from your SavedCast interface
      username: '[username not available]', // Will update when we get full parent cast
      fid: cast.parent_author?.fid || 0,
      cast_hash: parentHash,
      cast_content: `[Parent cast - hash: ${parentHash}]`, // Placeholder
      cast_timestamp: new Date().toISOString(),
      tags: [] as string[],
      likes_count: 0,
      replies_count: 0,
      recasts_count: 0,
      
      // Optional fields - use undefined instead of null
      cast_url: `https://warpcast.com/i/cast/${parentHash}`,
      author_pfp_url: undefined, // Changed from null to undefined
      author_display_name: '[author not available]',
      saved_by_user_id: cast.author.username, // The person who mentioned the bot
      category: 'saved-via-bot',
      notes: `Saved via @cstkpr bot mention by ${cast.author.username}`,
      parsed_data: {
        urls: [],
        hashtags: [],
        mentions: [],
        word_count: 0,
        sentiment: 'neutral' as const,
        topics: []
      }
      
      // Note: id, created_at, updated_at will be handled by Supabase automatically
    } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
    
    console.log('💾 Saving cast data...')
    console.log('📋 Cast data structure:', Object.keys(castData))
    
    // Save to database
    try {
      const savedCast = await CastService.saveCast(castData)
      console.log('✅ Cast saved successfully:', savedCast.cast_hash)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Cast saved successfully',
        cast_id: savedCast.cast_hash,
        saved_cast_id: savedCast.id
      })
      
    } catch (saveError) {
      console.error('❌ Error saving cast:', saveError)
      console.error('❌ Save error details:', saveError instanceof Error ? saveError.message : saveError)
      return NextResponse.json({ error: 'Failed to save cast', details: saveError instanceof Error ? saveError.message : 'Unknown error' }, { status: 500 })
    }
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    console.error('💥 Webhook error details:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}