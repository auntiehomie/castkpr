import { NextRequest, NextResponse } from 'next/server'
import { CastService, ContentParser } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

// Add your Neynar API key to your environment variables
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

async function fetchCastByHash(castHash: string) {
  if (!NEYNAR_API_KEY) {
    console.error('❌ NEYNAR_API_KEY not set')
    return null
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`,
      {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        }
      }
    )

    if (!response.ok) {
      console.error(`❌ Neynar API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    return data.cast
  } catch (error) {
    console.error('❌ Error fetching cast from Neynar:', error)
    return null
  }
}

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
    
    // Fetch the actual parent cast data from Neynar
    console.log('🔍 Fetching parent cast data from Neynar...')
    const parentCast = await fetchCastByHash(parentHash)
    
    if (!parentCast) {
      console.log('❌ Failed to fetch parent cast data')
      return NextResponse.json({ error: 'Could not fetch parent cast data' }, { status: 500 })
    }
    
    console.log('✅ Parent cast fetched successfully')
    console.log('📝 Parent cast author:', parentCast.author.username)
    console.log('📝 Parent cast text length:', parentCast.text.length)
    
    // Parse the content for additional data
    const parsedData = ContentParser.parseContent(parentCast.text)
    
    // Create cast data with actual parent cast information
    const castData = {
      username: parentCast.author.username,
      fid: parentCast.author.fid,
      cast_hash: parentHash,
      cast_content: parentCast.text,
      cast_timestamp: parentCast.timestamp,
      tags: [...(parsedData.hashtags || []), 'saved-via-bot'] as string[],
      likes_count: parentCast.reactions?.likes?.length || 0,
      replies_count: parentCast.replies?.count || 0,
      recasts_count: parentCast.reactions?.recasts?.length || 0,
      
      // Optional fields with actual data
      cast_url: `https://warpcast.com/${parentCast.author.username}/${parentHash.slice(0, 10)}`,
      author_pfp_url: parentCast.author.pfp_url,
      author_display_name: parentCast.author.display_name,
      saved_by_user_id: cast.author.username, // The person who mentioned the bot
      category: 'saved-via-bot',
      notes: `💾 Saved via @cstkpr bot by ${cast.author.username} on ${new Date().toLocaleDateString()}`,
      parsed_data: {
        ...parsedData,
        urls: [...(parsedData.urls || []), ...extractEmbeds(parentCast.embeds)],
        mentions: [...(parsedData.mentions || []), 'cstkpr'],
        hashtags: [...(parsedData.hashtags || []), 'cstkpr', 'saved'],
        topics: [...(parsedData.topics || []), 'saved-cast']
      }
    } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
    
    console.log('💾 Saving cast data...')
    
    // Save to database
    try {
      const savedCast = await CastService.saveCast(castData)
      console.log('✅ Cast saved successfully:', savedCast.cast_hash)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Cast saved successfully',
        cast_id: savedCast.cast_hash,
        saved_cast_id: savedCast.id,
        author: parentCast.author.username,
        content_preview: parentCast.text.slice(0, 100) + (parentCast.text.length > 100 ? '...' : '')
      })
      
    } catch (saveError) {
      console.error('❌ Error saving cast:', saveError)
      
      // Handle duplicate save gracefully
      if (saveError instanceof Error && saveError.message.includes('already saved')) {
        return NextResponse.json({ 
          success: false,
          message: 'Cast already saved by this user',
          duplicate: true
        })
      }
      
      return NextResponse.json({ 
        error: 'Failed to save cast', 
        details: saveError instanceof Error ? saveError.message : 'Unknown error' 
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to extract URLs from embeds
interface CastEmbed {
  url?: string;
  [key: string]: unknown;
}

function extractEmbeds(embeds: CastEmbed[] | undefined): string[] {
  if (!embeds || !Array.isArray(embeds)) return []
  
  return embeds
    .filter((embed): embed is CastEmbed & { url: string } => typeof embed?.url === 'string')
    .map(embed => embed.url)
}