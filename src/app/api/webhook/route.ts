import { NextRequest, NextResponse } from 'next/server'
import { CastService } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Webhook received!')
    
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
    
    if (!parentHash) {
      console.log('❌ No parent cast to save')
      return NextResponse.json({ message: 'No parent cast to save' })
    }
    
    // Fetch parent cast from Neynar API
    console.log('🔍 Fetching parent cast details...')
    const parentCastResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.NEYNAR_API_KEY}`,
          'accept': 'application/json'
        }
      }
    )
    
    if (!parentCastResponse.ok) {
      console.error('❌ Failed to fetch parent cast:', parentCastResponse.status)
      return NextResponse.json({ error: 'Failed to fetch parent cast' }, { status: 500 })
    }
    
    const parentCastData = await parentCastResponse.json()
    const parentCast = parentCastData.cast
    
    console.log('📋 Parent cast fetched:', parentCast.hash)
    console.log('📝 Parent cast author:', parentCast.author.username)
    console.log('💬 Parent cast text preview:', parentCast.text.substring(0, 50) + '...')
    
    // Extract data for saving
    const castData = {
      farcaster_cast_id: parentCast.hash,
      cast_url: `https://warpcast.com/${parentCast.author.username}/${parentCast.hash}`,
      cast_content: parentCast.text,
      cast_timestamp: parentCast.timestamp,
      username: parentCast.author.username,
      author_display_name: parentCast.author.display_name,
      author_pfp_url: parentCast.author.pfp_url,
      likes_count: parentCast.reactions?.likes_count || 0,
      replies_count: parentCast.replies?.count || 0,
      recasts_count: parentCast.reactions?.recasts_count || 0,
      user_id: cast.author.username, // The person who mentioned the bot
      parsed_data: {
        urls: extractUrls(parentCast.text),
        hashtags: extractHashtags(parentCast.text),
        mentions: extractMentions(parentCast.text),
        word_count: parentCast.text.split(' ').length
      },
      fid: parentCast.author.fid,
      cast_hash: parentCast.hash,
      tags: extractHashtags(parentCast.text)
    }
    
    console.log('💾 Saving cast data...')
    
    // Save to database
    try {
      await CastService.saveCast(castData)
      console.log('✅ Cast saved successfully:', castData.farcaster_cast_id)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Cast saved successfully',
        cast_id: castData.farcaster_cast_id 
      })
      
    } catch (saveError) {
      console.error('❌ Error saving cast:', saveError)
      return NextResponse.json({ error: 'Failed to save cast' }, { status: 500 })
    }
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper functions to extract data
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) || []
}

function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g
  const matches = text.match(hashtagRegex) || []
  return matches.map(tag => tag.substring(1)) // Remove the # symbol
}

function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g
  const matches = text.match(mentionRegex) || []
  return matches.map(mention => mention.substring(1)) // Remove the @ symbol
}