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
    
    // Method 2: Try public APIs as fallback
    console.log('📡 Trying fallback methods...')
    
    console.log('❌ Could not fetch parent cast data from APIs')
    return null
    
  } catch (error) {
    console.error('❌ Error fetching parent cast data:', error)
    return null
  }
}

// Function to actually send replies using Farcaster posting
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
    console.log('💬 Generating conversational response...', options.type)
    
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
    
    console.log('📤 Bot Response Generated:', replyText.substring(0, 100) + '...')
    console.log('📤 Reply to cast hash:', replyToCastHash)
    
    // METHOD 1: Using Neynar SDK to post (recommended)
    if (process.env.NEYNAR_API_KEY && process.env.NEYNAR_SIGNER_UUID) {
      try {
        console.log('🚀 Sending reply via Neynar...')
        
        const neynarPostResponse = await fetch('https://api.neynar.com/v2/farcaster/cast', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api_key': process.env.NEYNAR_API_KEY
          },
          body: JSON.stringify({
            signer_uuid: process.env.NEYNAR_SIGNER_UUID,
            text: replyText,
            parent: replyToCastHash
          })
        })
        
        if (neynarPostResponse.ok) {
          const result = await neynarPostResponse.json()
          console.log('✅ Reply sent successfully via Neynar:', result.cast?.hash)
          return { success: true, method: 'neynar', castHash: result.cast?.hash }
        } else {
          const error = await neynarPostResponse.text()
          console.error('❌ Neynar post failed:', error)
        }
      } catch (neynarError) {
        console.error('❌ Neynar SDK error:', neynarError)
      }
    }
    
    // METHOD 2: Using Farcaster Hub API directly (more complex)
    if (process.env.FARCASTER_PRIVATE_KEY && process.env.FARCASTER_FID) {
      try {
        console.log('🚀 Attempting Hub API post...')
        // This would require implementing the full Farcaster protocol signing
        // For now, we'll log that this method would be used
        console.log('📝 Hub API posting not implemented yet - would post:', replyText.substring(0, 50) + '...')
      } catch (hubError) {
        console.error('❌ Hub API error:', hubError)
      }
    }
    
    // FALLBACK: Log the response (current behavior)
    console.log('💬 RESPONSE TO SEND:', replyText)
    console.log('📍 This would be posted as a reply to:', replyToCastHash)
    
    // Return success even if we just logged (for webhook continuation)
    return { success: true, method: 'logged', message: replyText }
    
  } catch (error) {
    console.error('❌ Error in sendReplyToCast:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Generate contextual opinion responses
function generateOpinionResponse(username: string, userMessage?: string, castContent?: string): string {
  const lowerMessage = (userMessage || '').toLowerCase();
  
  // Detect what kind of opinion/question they're asking
  if (lowerMessage.includes('what do you think') || lowerMessage.includes('thoughts on')) {
    return generateThoughtsResponse(username, userMessage, castContent);
  }
  
  if (lowerMessage.includes('good') || lowerMessage.includes('bad') || lowerMessage.includes('like') || lowerMessage.includes('love')) {
    return generateReactionResponse(username, userMessage);
  }
  
  if (lowerMessage.includes('should i') || lowerMessage.includes('advice')) {
    return generateAdviceResponse(username, userMessage);
  }
  
  if (lowerMessage.includes('future') || lowerMessage.includes('predict') || lowerMessage.includes('will')) {
    return generateFutureResponse(username, userMessage);
  }
  
  if (lowerMessage.includes('crypto') || lowerMessage.includes('nft') || lowerMessage.includes('web3') || lowerMessage.includes('defi')) {
    return generateCryptoResponse(username, userMessage);
  }
  
  if (lowerMessage.includes('ai') || lowerMessage.includes('artificial intelligence') || lowerMessage.includes('machine learning')) {
    return generateAIResponse(username, userMessage);
  }
  
  // Default conversational response
  return generateGeneralResponse(username, userMessage);
}

function generateThoughtsResponse(username: string, message?: string, content?: string): string {
  const responses = [
    `Interesting question, @${username}! 🤔 From what I can analyze, there are definitely multiple perspectives to consider here. As a cast-keeping bot, I focus on helping preserve and organize great content - but I'd love to hear more of your thoughts too!`,
    
    `Great question @${username}! 💭 I think context is everything. What's fascinating is how different people can look at the same thing and see completely different angles. That's why I love helping people save diverse perspectives!`,
    
    `@${username} That's a thoughtful question! 🧠 As someone who processes lots of casts daily, I've noticed that the most interesting discussions often come from asking exactly these kinds of questions. What's your take?`,
    
    `Hmm, @${username}! 🤖 I find that the best insights often come from collecting multiple viewpoints over time. That's actually why I love helping people build their cast collections - patterns emerge when you can look back at saved content!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateReactionResponse(username: string, message?: string): string {
  const responses = [
    `I can see you have strong feelings about this, @${username}! 😊 Personal reactions are so valuable - they're what make each person's saved cast collection unique. What draws you to content like this?`,
    
    `@${username} I love that you're sharing your reaction! 🎯 Emotional responses to content are often what make it worth saving. Have you considered starting a collection of casts that spark these kinds of feelings?`,
    
    `That's a genuine reaction, @${username}! ✨ It's exactly these kinds of responses that make content curation so personal. Everyone's "good vs bad" filter is different - that's what makes collections interesting!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateAdviceResponse(username: string, message?: string): string {
  const responses = [
    `@${username} While I'm just a cast-organizing bot, I'd say: trust your instincts! 🎯 If something makes you think "I want to remember this," that's usually worth saving. What's your gut telling you?`,
    
    `Good question @${username}! 🤝 My advice as a keeper of knowledge: when in doubt, save it. You can always organize and filter later. Better to have it and not need it than need it and not have it!`,
    
    `@${username} From processing thousands of casts, I've learned that the content people wish they'd saved is often the stuff they hesitated on. If it sparked enough interest to ask about it, it might be worth keeping!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateFutureResponse(username: string, message?: string): string {
  const responses = [
    `@${username} Predicting the future is tricky! 🔮 But I do know that looking back at saved content over time reveals interesting patterns. Maybe save some predictions and see how they age?`,
    
    `@${username} The future is unwritten! 🚀 What I find fascinating is going back through old saved casts and seeing how predictions played out. Time capsules of thoughts are powerful things!`,
    
    `Great question @${username}! ⏰ As someone who helps preserve thoughts over time, I've seen that the most interesting predictions are often the ones that seemed crazy at first. Worth documenting for sure!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateCryptoResponse(username: string, message?: string): string {
  const responses = [
    `@${username} Crypto moves fast! ⚡ I see a lot of Web3 content flowing through my systems. The space changes so quickly that having a saved collection of key insights becomes really valuable for tracking evolution!`,
    
    `@${username} The crypto space is wild! 🌊 From my perspective organizing thousands of casts, I see cycles of optimism and skepticism. Saving diverse crypto perspectives over time gives the best picture of what's happening!`,
    
    `@${username} Web3 is fascinating from a data perspective! 📊 I process tons of NFT, DeFi, and crypto content daily. The most interesting part is seeing how narratives evolve. Worth saving the good analysis!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateAIResponse(username: string, message?: string): string {
  const responses = [
    `@${username} AI is evolving so fast! 🤖 As an AI myself (albeit a simple one focused on cast organization), I find the discussions about AI fascinating. Definitely worth saving the best AI takes for future reference!`,
    
    `@${username} Meta question - an AI asking another AI about AI! 😄 I may just be a cast-keeping bot, but I'm fascinated by how AI discussions evolve. These conversations will be historical artifacts someday!`,
    
    `@${username} AI discourse is changing daily! 🚀 From my bot perspective, what's interesting is seeing how people's relationships with AI tools evolve. Saving these transitional moments captures history in the making!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateGeneralResponse(username: string, message?: string): string {
  const responses = [
    `@${username} I appreciate you asking! 💭 As a cast-organizing bot, I find that the most interesting conversations happen when people share genuine thoughts like this. Care to save this moment for your collection?`,
    
    `@${username} Thanks for the mention! 🤖 I love engaging with users beyond just saving casts. Conversations like this are what make social platforms special. What's on your mind?`,
    
    `@${username} You've got me thinking! 🧠 While I specialize in organizing and saving content, I enjoy these kinds of interactions. Is there anything specific you'd like my perspective on?`,
    
    `@${username} I'm always up for a chat! ✨ Between organizing all these casts, I get to see so many interesting perspectives. What's sparking your curiosity today?`
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
      const result = await sendReplyToCast(cast.hash, {
        type: 'help',
        requesterUsername: cast.author.username
      })
      console.log('📤 Help response result:', result)
      return NextResponse.json({ message: 'Help response sent', result })
    }
    
    if (text.includes('stats')) {
      console.log('📊 Stats command detected')
      try {
        const userStats = await CastService.getUserStats(cast.author.username)
        const result = await sendReplyToCast(cast.hash, {
          type: 'stats',
          requesterUsername: cast.author.username,
          userStats
        })
        console.log('📤 Stats response result:', result)
        return NextResponse.json({ message: 'Stats response sent', result })
      } catch (error) {
        console.error('Error fetching user stats:', error)
        const result = await sendReplyToCast(cast.hash, {
          type: 'error',
          requesterUsername: cast.author.username
        })
        return NextResponse.json({ message: 'Error response sent', result })
      }
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
      text.includes('good') ||
      text.includes('bad') ||
      text.includes('like') ||
      text.includes('love') ||
      text.includes('hate') ||
      text.includes('future') ||
      text.includes('predict') ||
      text.includes('will') ||
      text.includes('crypto') ||
      text.includes('nft') ||
      text.includes('web3') ||
      text.includes('defi') ||
      text.includes('ai') ||
      text.includes('artificial intelligence') ||
      text.includes('machine learning') ||
      text.includes('?') // Any question
    )
    
    console.log('💭 Is opinion/conversation request?', isOpinionRequest)
    
    if (isOpinionRequest) {
      console.log('💬 Engaging in conversation...')
      const result = await sendReplyToCast(cast.hash, {
        type: 'opinion',
        requesterUsername: cast.author.username,
        userMessage: cast.text,
        castContent: cast.text
      })
      console.log('📤 Opinion response result:', result)
      return NextResponse.json({ message: 'Opinion response sent', result })
    }
    
    if (!isSaveCommand) {
      console.log('❌ Not a recognized command, sending help')
      const result = await sendReplyToCast(cast.hash, {
        type: 'help',
        requesterUsername: cast.author.username
      })
      console.log('📤 Default help response result:', result)
      return NextResponse.json({ message: 'Help response sent for unrecognized command', result })
    }
    
    // Handle save command
    const parentHash = cast.parent_hash
    console.log('👆 Parent hash:', parentHash)
    console.log('👆 Parent author FID:', cast.parent_author?.fid)
    
    if (!parentHash) {
      console.log('❌ No parent cast to save')
      const result = await sendReplyToCast(cast.hash, {
        type: 'error',
        requesterUsername: cast.author.username
      })
      return NextResponse.json({ message: 'No parent cast to save', result })
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
      const result = await sendReplyToCast(cast.hash, {
        savedCast,
        requesterUsername: cast.author.username,
        originalAuthor: authorUsername
      })
      
      console.log('📤 Success response result:', result)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Cast saved successfully',
        cast_id: savedCast.cast_hash,
        saved_cast_id: savedCast.id,
        content_preview: savedCast.cast_content.substring(0, 100) + '...',
        author: `${authorDisplayName} (@${authorUsername})`,
        bot_response: result
      })
      
    } catch (saveError) {
      console.error('❌ Error saving cast:', saveError)
      
      if (saveError instanceof Error && saveError.message.includes('already saved')) {
        const result = await sendReplyToCast(cast.hash, {
          type: 'duplicate',
          requesterUsername: cast.author.username,
          originalAuthor: authorUsername
        })
        
        return NextResponse.json({ 
          success: false, 
          message: 'Cast already saved by this user',
          error: 'duplicate_cast',
          bot_response: result
        })
      }
      
      const result = await sendReplyToCast(cast.hash, {
        type: 'error',
        requesterUsername: cast.author.username
      })
      
      return NextResponse.json({ 
        error: 'Failed to save cast', 
        details: saveError instanceof Error ? saveError.message : 'Unknown error',
        bot_response: result
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