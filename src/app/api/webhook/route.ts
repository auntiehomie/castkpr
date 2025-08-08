import { NextRequest, NextResponse } from 'next/server'
import { CastService, supabase } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Webhook received!')
    
    // Debug environment variables
    console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing')
    console.log('🔍 Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'Missing')
    console.log('🔍 Actual Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    
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
    
    // Check for parent hash - Convert undefined to null for consistency
    const parentHash = cast.parent_hash ?? null
    const userId = cast.author.username
    
    console.log('👆 Parent hash:', parentHash)
    console.log('👤 User ID:', userId)
    
    if (!parentHash) {
      console.log('❌ No parent cast to save')
      return NextResponse.json({ message: 'No parent cast to save' })
    }
    
    // Determine command type and generate response
    const { commandType, response, contextData } = await generateBotResponse(text, userId, parentHash, cast)
    
    // Save the conversation using regular service
    try {
      if (commandType === 'save' && contextData) {
        const savedCast = await CastService.saveCast(contextData)
        console.log('✅ Cast saved successfully:', savedCast.cast_hash)
        
        return NextResponse.json({ 
          success: true, 
          message: 'Cast saved successfully',
          cast_id: savedCast.cast_hash,
          saved_cast_id: savedCast.id,
          response
        })
      } else {
        return NextResponse.json({ 
          success: true, 
          message: response,
          command_type: commandType
        })
      }
      
    } catch (saveError) {
      console.error('❌ Error saving cast:', saveError)
      console.error('❌ Save error details:', saveError instanceof Error ? saveError.message : saveError)
      return NextResponse.json({ 
        error: 'Failed to save cast', 
        details: saveError instanceof Error ? saveError.message : 'Unknown error' 
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    console.error('💥 Webhook error details:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate bot responses
async function generateBotResponse(
  text: string, 
  userId: string, 
  parentHash: string | null,  // Updated to accept null
  cast: any
): Promise<{
  commandType: string;
  response: string;
  contextData?: Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>;
}> {
  const lowerText = text.toLowerCase()
  
  if (lowerText.includes('save this') || lowerText.includes('save')) {
    if (!parentHash) {
      return {
        commandType: 'save_error',
        response: 'No cast to save found. Please reply to a cast you want to save.'
      }
    }
    
    // Create cast data for saving
    const castData = {
      username: `user-${cast.parent_author?.fid || 'unknown'}`,
      fid: cast.parent_author?.fid || 0,
      cast_hash: parentHash,
      cast_content: `🔗 Cast saved from Farcaster - Hash: ${parentHash}`,
      cast_timestamp: new Date().toISOString(),
      tags: ['saved-via-bot'] as string[],
      likes_count: 0,
      replies_count: 0,
      recasts_count: 0,
      cast_url: `https://warpcast.com/~/conversations/${parentHash}`,
      author_pfp_url: undefined,
      author_display_name: `User ${cast.parent_author?.fid || 'Unknown'}`,
      saved_by_user_id: userId,
      category: 'saved-via-bot',
      notes: `💾 Saved via @cstkpr bot by ${userId} on ${new Date().toLocaleDateString()}`,
      parsed_data: {
        urls: [`https://warpcast.com/~/conversations/${parentHash}`],
        hashtags: ['cstkpr', 'saved'],
        mentions: ['cstkpr'],
        word_count: 0,
        sentiment: 'neutral' as const,
        topics: ['saved-cast']
      }
    } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
    
    return {
      commandType: 'save',
      response: '✅ Cast saved successfully! You can view it at castkpr.vercel.app',
      contextData: castData
    }
  }
  
  if (lowerText.includes('help')) {
    return {
      commandType: 'help',
      response: `🤖 CastKPR Bot Commands:
      
• Reply "save this" to any cast to save it
• "help" - Show this help message
• "stats" - View your save statistics

Visit castkpr.vercel.app to view all your saved casts!`
    }
  }
  
  if (lowerText.includes('stats')) {
    try {
      const stats = await CastService.getUserStats(userId)
      return {
        commandType: 'stats',
        response: `📊 Your CastKPR Stats:

• Total saved casts: ${stats.totalCasts}

Visit castkpr.vercel.app to explore your collection!`
      }
    } catch (error) {
      return {
        commandType: 'stats_error',
        response: 'Unable to fetch stats right now. Try again later!'
      }
    }
  }
  
  // Default response for unrecognized commands
  return {
    commandType: 'unknown',
    response: `🤖 Hi! I didn't understand that command. 

Reply "help" for available commands or "save this" to save a cast!`
  }
}