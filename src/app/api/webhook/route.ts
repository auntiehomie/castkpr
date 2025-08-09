// PART 1: Updated Webhook Handler (src/app/api/webhook/route.ts)
import { NextRequest, NextResponse } from 'next/server'
import { CastService, ContentParser, supabase } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

// Enhanced function to fetch parent cast data from Farcaster API
async function fetchParentCastData(parentHash: string, parentAuthorFid?: number) {
  console.log('🔍 Attempting to fetch parent cast data for:', parentHash)
  
  try {
    // Method 1: Try Neynar API (if you have access)
    if (process.env.NEYNAR_API_KEY) {
      console.log('📡 Trying Neynar API...')
      const neynarResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
        {
          headers: {
            'Accept': 'application/json',
            'api_key': process.env.NEYNAR_API_KEY
          }
        }
      )
      
      if (neynarResponse.ok) {
        const data = await neynarResponse.json()
        console.log('✅ Neynar API response received')
        
        if (data.cast) {
          return {
            text: data.cast.text,
            author: {
              username: data.cast.author.username,
              display_name: data.cast.author.display_name,
              fid: data.cast.author.fid,
              pfp_url: data.cast.author.pfp_url
            },
            timestamp: data.cast.timestamp,
            url: `https://warpcast.com/${data.cast.author.username}/${parentHash.slice(0, 10)}`,
            engagement: {
              likes: data.cast.reactions?.likes_count || 0,
              replies: data.cast.replies?.count || 0,
              recasts: data.cast.reactions?.recasts_count || 0
            }
          }
        }
      }
    }
    
    // Method 2: Try Farcaster Hub API (free but more complex)
    console.log('📡 Trying direct Hub API...')
    const hubResponse = await fetch(
      `https://hub.pinata.cloud/v1/castById?hash=${parentHash}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )
    
    if (hubResponse.ok) {
      const hubData = await hubResponse.json()
      console.log('✅ Hub API response received')
      
      if (hubData.data) {
        const castData = hubData.data
        return {
          text: castData.castAddBody?.text || 'Cast content from Hub',
          author: {
            username: `user-${castData.fid}`,
            display_name: `User ${castData.fid}`,
            fid: castData.fid,
            pfp_url: undefined
          },
          timestamp: new Date(castData.timestamp * 1000).toISOString(),
          url: `https://warpcast.com/~/conversations/${parentHash}`,
          engagement: {
            likes: 0,
            replies: 0,
            recasts: 0
          }
        }
      }
    }
    
    console.log('❌ Could not fetch parent cast data from any API')
    return null
    
  } catch (error) {
    console.error('❌ Error fetching parent cast data:', error)
    return null
  }
}

// Conversational response function (same as before but with better logging)
async function sendReplyToCast(
  replyToCastHash: string, 
  options: {
    savedCast?: SavedCast;
    requesterUsername: string;
    originalAuthor?: string;
    type?: 'success' | 'duplicate' | 'error' | 'help' | 'stats' | 'opinion';
    userStats?: { totalCasts: number };
    userMessage?: string;
    castContent?: string;
  }
) {
  try {
    console.log('💬 Sending conversational response...', options.type)
    
    let replyText = '';
    
    switch (options.type) {
      case 'duplicate':
        replyText = `Hey @${options.requesterUsername}! 🤔 You've already saved this cast by @${options.originalAuthor}. 

Check your CastKPR dashboard to see all your saved casts! 📚✨

🔗 castkeeper.vercel.app`;
        break;
        
      case 'error':
        replyText = `Sorry @${options.requesterUsername}! 😅 Something went wrong while trying to save that cast. 

Please try again later or contact support if the issue persists. 🛠️`;
        break;
        
      case 'help':
        replyText = `Hi @${options.requesterUsername}! 👋 I'm CastKPR, your personal Farcaster cast keeper! 

🤖 Commands:
• Reply "@cstkpr save this" to any cast to save it
• Ask me "@cstkpr what do you think about [topic]?" for my thoughts
• "@cstkpr stats" to see your save statistics
• I automatically extract URLs, mentions, hashtags & more
• All your casts are organized at castkeeper.vercel.app

Try chatting with me or saving some casts! 🚀`;
        break;

      case 'stats':
        const total = options.userStats?.totalCasts || 0;
        replyText = `📊 Your CastKPR Stats, @${options.requesterUsername}:

📚 Total saved casts: ${total}
🎯 Ready to save more amazing content!

View your full collection: castkeeper.vercel.app 🚀`;
        break;

      case 'opinion':
        replyText = generateOpinionResponse(options.requesterUsername, options.userMessage, options.castContent);
        break;
        
      default: // success
        if (options.savedCast) {
          const wordCount = options.savedCast.parsed_data?.word_count || 0;
          const hasUrls = (options.savedCast.parsed_data?.urls?.length || 0) > 0;
          const hasMentions = (options.savedCast.parsed_data?.mentions?.length || 0) > 0;
          const hasHashtags = (options.savedCast.parsed_data?.hashtags?.length || 0) > 0;
          
          let extractedFeatures = [];
          if (hasUrls) extractedFeatures.push('🔗 Links');
          if (hasMentions) extractedFeatures.push('👥 Mentions');
          if (hasHashtags) extractedFeatures.push('🏷️ Hashtags');
          
          replyText = `✅ Saved for @${options.requesterUsername}! 

📚 Cast by @${options.originalAuthor} is now in your collection!

🤖 Auto-extracted: ${extractedFeatures.length > 0 ? extractedFeatures.join(', ') : 'Content parsed'}
📝 ${wordCount} words analyzed

View & organize at: castkeeper.vercel.app 🚀`;
        } else {
          replyText = `✅ Cast saved for @${options.requesterUsername}! 

📚 Your cast has been saved and auto-parsed by CastKPR!

View your organized collection: castkeeper.vercel.app 🚀✨`;
        }
    }
    
    console.log('📤 Would send reply:', replyText.substring(0, 100) + '...')
    console.log('📤 Reply to cast hash:', replyToCastHash)
    
    // TODO: Implement actual Farcaster API call here
    
  } catch (error) {
    console.error('❌ Error sending conversational response:', error);
  }
}

// Opinion response generator (same as before, truncated for space)
function generateOpinionResponse(username: string, userMessage?: string, castContent?: string): string {
  const responses = [
    `@${username} That's an interesting perspective! 🤔 As a cast-organizing bot, I see so many different viewpoints flow through my systems. What draws you to this particular topic?`,
    `Great question @${username}! 💭 From processing thousands of casts, I've learned that the most engaging content often sparks exactly these kinds of discussions.`,
    `@${username} I appreciate you asking! 🤖 Conversations like this are what make social platforms special. Care to save this moment for your collection?`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Webhook received!')
    
    const body = await request.json()
    console.log('📦 Webhook payload keys:', Object.keys(body))
    console.log('📦 Event type:', body.type)
    
    // Check event type
    if (body.type !== 'cast.created') {
      console.log('❌ Not a cast.created event, skipping')
      return NextResponse.json({ message: 'Event type not handled' })
    }
    
    const cast = body.data
    console.log('📝 Processing cast from:', cast.author?.username || 'unknown')
    console.log('📝 Cast FID:', cast.author?.fid)
    console.log('📝 Full cast keys:', Object.keys(cast))
    
    // Check for mentions
    const mentions = cast.mentioned_profiles || []
    const mentionsBot = mentions.some((profile: { username?: string; fid?: number }) => {
      return profile.username === 'cstkpr'
    })
    
    console.log('🤖 Bot mentioned?', mentionsBot)
    console.log('🤖 Mentioned profiles:', mentions.map((p: any) => p.username))
    
    if (!mentionsBot) {
      console.log('❌ Bot not mentioned, skipping')
      return NextResponse.json({ message: 'Bot not mentioned' })
    }
    
    // Get text from cast
    const text = (cast.text || '').toLowerCase()
    console.log('💬 Cast text:', cast.text)
    
    // Handle different bot commands and conversations
    if (text.includes('help')) {
      console.log('❓ Help command detected')
      await sendReplyToCast(cast.hash, {
        type: 'help',
        requesterUsername: cast.author.username
      })
      return NextResponse.json({ message: 'Help response sent' })
    }
    
    if (text.includes('stats')) {
      console.log('📊 Stats command detected')
      try {
        const userStats = await CastService.getUserStats(cast.author.username)
        await sendReplyToCast(cast.hash, {
          type: 'stats',
          requesterUsername: cast.author.username,
          userStats
        })
      } catch (error) {
        console.error('Error fetching user stats:', error)
        await sendReplyToCast(cast.hash, {
          type: 'error',
          requesterUsername: cast.author.username
        })
      }
      return NextResponse.json({ message: 'Stats response sent' })
    }
    
    // Check for save command
    const isSaveCommand = text.includes('save this') || text.includes('save')
    console.log('💾 Is save command?', isSaveCommand)
    
    // Check for opinion/conversation patterns
    const isOpinionRequest = !isSaveCommand && (
      text.includes('what do you think') ||
      text.includes('thoughts on') ||
      text.includes('opinion') ||
      text.includes('should i') ||
      text.includes('advice') ||
      text.includes('?')
    )
    
    console.log('💭 Is opinion/conversation request?', isOpinionRequest)
    
    if (isOpinionRequest) {
      console.log('💬 Engaging in conversation...')
      await sendReplyToCast(cast.hash, {
        type: 'opinion',
        requesterUsername: cast.author.username,
        userMessage: cast.text,
        castContent: cast.text
      })
      return NextResponse.json({ message: 'Opinion response sent' })
    }
    
    if (!isSaveCommand) {
      console.log('❌ Not a recognized command, sending help')
      await sendReplyToCast(cast.hash, {
        type: 'help',
        requesterUsername: cast.author.username
      })
      return NextResponse.json({ message: 'Help response sent for unrecognized command' })
    }
    
    // Handle save command
    const parentHash = cast.parent_hash
    console.log('👆 Parent hash:', parentHash)
    console.log('👆 Parent author FID:', cast.parent_author?.fid)
    console.log('👆 Available parent data keys:', cast.parent_author ? Object.keys(cast.parent_author) : 'none')
    
    if (!parentHash) {
      console.log('❌ No parent cast to save')
      await sendReplyToCast(cast.hash, {
        type: 'error',
        requesterUsername: cast.author.username
      })
      return NextResponse.json({ message: 'No parent cast to save' })
    }
    
    // Try to fetch actual parent cast content
    console.log('🔍 Fetching parent cast content...')
    const parentCastData = await fetchParentCastData(parentHash, cast.parent_author?.fid)
    
    // Extract content with better fallbacks
    let castContent = 'Cast content not available';
    let authorUsername = 'unknown';
    let authorDisplayName = 'Unknown User';
    let authorFid = 0;
    let authorPfpUrl = undefined;
    let castTimestamp = new Date().toISOString();
    let castUrl = `https://warpcast.com/~/conversations/${parentHash}`;
    let engagement = { likes: 0, replies: 0, recasts: 0 };
    
    if (parentCastData) {
      console.log('✅ Using fetched parent cast data')
      castContent = parentCastData.text;
      authorUsername = parentCastData.author.username;
      authorDisplayName = parentCastData.author.display_name || authorUsername;
      authorFid = parentCastData.author.fid;
      authorPfpUrl = parentCastData.author.pfp_url;
      castTimestamp = parentCastData.timestamp;
      castUrl = parentCastData.url;
      engagement = parentCastData.engagement;
    } else if (cast.parent_author) {
      console.log('⚠️ Using webhook parent author data as fallback')
      authorUsername = cast.parent_author.username || `user-${cast.parent_author.fid}`;
      authorDisplayName = cast.parent_author.display_name || cast.parent_author.displayName || authorUsername;
      authorFid = cast.parent_author.fid || 0;
      authorPfpUrl = cast.parent_author.pfp_url || cast.parent_author.pfpUrl;
      castContent = `📝 Cast by @${authorUsername} - view full content at ${castUrl}`;
    } else {
      console.log('❌ No parent cast data available')
    }
    
    console.log('📝 Final extracted data:')
    console.log('   Content preview:', castContent.substring(0, 100) + '...')
    console.log('   Author:', authorUsername, '(FID:', authorFid, ')')
    console.log('   Display name:', authorDisplayName)
    
    // Parse the content
    const parsedData = ContentParser.parseContent(castContent);
    
    // Create cast data
    const castData = {
      username: authorUsername,
      fid: authorFid,
      cast_hash: parentHash,
      cast_content: castContent,
      cast_timestamp: castTimestamp,
      tags: ['saved-via-bot', ...(parsedData.hashtags?.slice(0, 3) || [])] as string[],
      likes_count: engagement.likes,
      replies_count: engagement.replies,
      recasts_count: engagement.recasts,
      cast_url: castUrl,
      author_pfp_url: authorPfpUrl,
      author_display_name: authorDisplayName,
      saved_by_user_id: cast.author.username,
      category: 'saved-via-bot',
      notes: `💾 Saved via @cstkpr bot by @${cast.author.username} on ${new Date().toLocaleDateString()}`,
      parsed_data: {
        ...parsedData,
        topics: ['saved-cast', ...(parsedData.topics || [])]
      }
    } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
    
    console.log('💾 Saving cast with extracted content...')
    
    // Test Supabase connection
    console.log('🔍 Testing Supabase connection...')
    try {
      const { error: testError } = await supabase
        .from('saved_casts')
        .select('id')
        .limit(1)
      
      if (testError) {
        console.error('❌ Supabase connection test failed:', testError)
        return NextResponse.json({ 
          error: 'Database connection failed', 
          details: testError.message 
        }, { status: 500 })
      }
      
      console.log('✅ Supabase connection test successful')
    } catch (connectionError) {
      console.error('❌ Supabase connection error:', connectionError)
      return NextResponse.json({ 
        error: 'Database connection error'
      }, { status: 500 })
    }
    
    // Save to database
    try {
      const savedCast = await CastService.saveCast(castData)
      console.log('✅ Cast saved successfully:', savedCast.cast_hash)
      console.log('📄 Saved content preview:', savedCast.cast_content.substring(0, 100) + '...')
      
      // Send success response
      await sendReplyToCast(cast.hash, {
        savedCast,
        requesterUsername: cast.author.username,
        originalAuthor: authorUsername
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Cast saved successfully',
        cast_id: savedCast.cast_hash,
        saved_cast_id: savedCast.id,
        content_preview: savedCast.cast_content.substring(0, 100) + '...',
        author: `${authorDisplayName} (@${authorUsername})`
      })
      
    } catch (saveError) {
      console.error('❌ Error saving cast:', saveError)
      
      if (saveError instanceof Error && saveError.message.includes('already saved')) {
        await sendReplyToCast(cast.hash, {
          type: 'duplicate',
          requesterUsername: cast.author.username,
          originalAuthor: authorUsername
        })
        
        return NextResponse.json({ 
          success: false, 
          message: 'Cast already saved by this user',
          error: 'duplicate_cast' 
        })
      }
      
      await sendReplyToCast(cast.hash, {
        type: 'error',
        requesterUsername: cast.author.username
      })
      
      return NextResponse.json({ 
        error: 'Failed to save cast', 
        details: saveError instanceof Error ? saveError.message : 'Unknown error' 
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PART 2: Database Schema Update Script
// Create a new file: scripts/update-database-schema.sql

/*
-- Database Schema Updates for CastKPR
-- Run this in your Supabase SQL editor

-- 1. Ensure the saved_casts table has the correct structure
CREATE TABLE IF NOT EXISTS saved_casts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  fid BIGINT NOT NULL,
  cast_hash TEXT NOT NULL,
  cast_content TEXT NOT NULL,
  cast_timestamp TIMESTAMPTZ NOT NULL,
  cast_url TEXT,
  author_pfp_url TEXT,
  author_display_name TEXT,
  parsed_data JSONB,
  saved_by_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  notes TEXT,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  recasts_count INTEGER DEFAULT 0
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_casts_saved_by_user_id ON saved_casts(saved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_casts_cast_hash ON saved_casts(cast_hash);
CREATE INDEX IF NOT EXISTS idx_saved_casts_fid ON saved_casts(fid);
CREATE INDEX IF NOT EXISTS idx_saved_casts_username ON saved_casts(username);
CREATE INDEX IF NOT EXISTS idx_saved_casts_timestamp ON saved_casts(cast_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_saved_casts_tags ON saved_casts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_saved_casts_parsed_data ON saved_casts USING GIN(parsed_data);

-- 3. Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_casts_unique_user_cast 
ON saved_casts(cast_hash, saved_by_user_id);

-- 4. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_saved_casts_updated_at 
  BEFORE UPDATE ON saved_casts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Add RLS policies (Row Level Security)
ALTER TABLE saved_casts ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own saved casts
CREATE POLICY IF NOT EXISTS "Users can view their own saved casts" 
ON saved_casts FOR SELECT 
USING (true); -- For now, allow all reads. Modify based on your auth setup

-- Allow inserting new saved casts
CREATE POLICY IF NOT EXISTS "Users can insert saved casts" 
ON saved_casts FOR INSERT 
WITH CHECK (true); -- Modify based on your auth setup

-- Allow users to update their own saved casts
CREATE POLICY IF NOT EXISTS "Users can update their own saved casts" 
ON saved_casts FOR UPDATE 
USING (true); -- Modify based on your auth setup

-- Allow users to delete their own saved casts
CREATE POLICY IF NOT EXISTS "Users can delete their own saved casts" 
ON saved_casts FOR DELETE 
USING (true); -- Modify based on your auth setup

-- 6. Verify the schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'saved_casts' 
ORDER BY ordinal_position;
*/