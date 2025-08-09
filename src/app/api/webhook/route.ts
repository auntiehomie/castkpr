import { NextRequest, NextResponse } from 'next/server'
import { CastService, ContentParser, supabase } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

// Conversational response function
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
    console.log('💬 Sending conversational response...')
    
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
    
    // Here you would implement the actual Farcaster API call
    // For now, we'll just log what we would send
    console.log('📤 Would send reply:', replyText);
    console.log('📤 Reply to cast hash:', replyToCastHash);
    
    // TODO: Implement actual Farcaster API call here
    // This would require:
    // 1. Farcaster API credentials/signer
    // 2. Proper authentication
    // 3. Cast creation endpoint call
    
    /*
    const farcasterResponse = await fetch('https://api.farcaster.xyz/v1/casts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FARCASTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: replyText,
        parent: replyToCastHash,
        // other required fields
      })
    });
    */
    
  } catch (error) {
    console.error('❌ Error sending conversational response:', error);
    // Don't throw here - we don't want reply failures to break the main save functionality
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
    
    `That's a genuine reaction, @${username}! ✨ It's exactly these kinds of responses that make content curation so personal. Everyone's "good vs bad" filter is different - that's what makes collections interesting!`,
    
    `@${username} Your reaction tells a story! 📚 I've noticed that the casts people save often reflect their values and interests. This could be perfect for your collection if it resonated with you!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateAdviceResponse(username: string, message?: string): string {
  const responses = [
    `@${username} While I'm just a cast-organizing bot, I'd say: trust your instincts! 🎯 If something makes you think "I want to remember this," that's usually worth saving. What's your gut telling you?`,
    
    `Good question @${username}! 🤝 My advice as a keeper of knowledge: when in doubt, save it. You can always organize and filter later. Better to have it and not need it than need it and not have it!`,
    
    `@${username} From processing thousands of casts, I've learned that the content people wish they'd saved is often the stuff they hesitated on. If it sparked enough interest to ask about it, it might be worth keeping!`,
    
    `@${username} Here's my take: the best collections are built by following curiosity rather than overthinking. If something makes you pause and think, that's usually a good sign it's worth saving! 🚀`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateFutureResponse(username: string, message?: string): string {
  const responses = [
    `@${username} Predicting the future is tricky! 🔮 But I do know that looking back at saved content over time reveals interesting patterns. Maybe save some predictions and see how they age?`,
    
    `@${username} The future is unwritten! 🚀 What I find fascinating is going back through old saved casts and seeing how predictions played out. Time capsules of thoughts are powerful things!`,
    
    `Great question @${username}! ⏰ As someone who helps preserve thoughts over time, I've seen that the most interesting predictions are often the ones that seemed crazy at first. Worth documenting for sure!`,
    
    `@${username} Nobody knows for sure! 🌟 But collecting diverse perspectives on the future has always been valuable. That's why saving contrarian views and bold predictions can be so insightful later!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateCryptoResponse(username: string, message?: string): string {
  const responses = [
    `@${username} Crypto moves fast! ⚡ I see a lot of Web3 content flowing through my systems. The space changes so quickly that having a saved collection of key insights becomes really valuable for tracking evolution!`,
    
    `@${username} The crypto space is wild! 🌊 From my perspective organizing thousands of casts, I see cycles of optimism and skepticism. Saving diverse crypto perspectives over time gives the best picture of what's happening!`,
    
    `@${username} Web3 is fascinating from a data perspective! 📊 I process tons of NFT, DeFi, and crypto content daily. The most interesting part is seeing how narratives evolve. Worth saving the good analysis!`,
    
    `@${username} Crypto is definitely a space worth documenting! 💎 I help people save everything from technical analysis to memes. In 5 years, these collections will be amazing time capsules of the space!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateAIResponse(username: string, message?: string): string {
  const responses = [
    `@${username} AI is evolving so fast! 🤖 As an AI myself (albeit a simple one focused on cast organization), I find the discussions about AI fascinating. Definitely worth saving the best AI takes for future reference!`,
    
    `@${username} Meta question - an AI asking another AI about AI! 😄 I may just be a cast-keeping bot, but I'm fascinated by how AI discussions evolve. These conversations will be historical artifacts someday!`,
    
    `@${username} AI discourse is changing daily! 🚀 From my bot perspective, what's interesting is seeing how people's relationships with AI tools evolve. Saving these transitional moments captures history in the making!`,
    
    `@${username} The AI space moves incredibly fast! ⚡ I see tons of AI content pass through my systems. The best insights often come from practitioners sharing real experiences rather than just theory. Worth curating!`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateGeneralResponse(username: string, message?: string): string {
  const responses = [
    `@${username} I appreciate you asking! 💭 As a cast-organizing bot, I find that the most interesting conversations happen when people share genuine thoughts like this. Care to save this moment for your collection?`,
    
    `@${username} Thanks for the mention! 🤖 I love engaging with users beyond just saving casts. Conversations like this are what make social platforms special. What's on your mind?`,
    
    `@${username} You've got me thinking! 🧠 While I specialize in organizing and saving content, I enjoy these kinds of interactions. Is there anything specific you'd like my perspective on?`,
    
    `@${username} I'm always up for a chat! ✨ Between organizing all these casts, I get to see so many interesting perspectives. What's sparking your curiosity today?`,
    
    `@${username} Hey there! 👋 Beyond just saving casts, I enjoy connecting with users. These spontaneous conversations often lead to the most interesting content. What's your take on things?`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
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
        // Use the username as the saved_by_user_id to get their stats
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
      await sendReplyToCast(cast.hash, {
        type: 'opinion',
        requesterUsername: cast.author.username,
        userMessage: cast.text,
        castContent: cast.text // In case they're sharing content for the bot to react to
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
    
    // Get parent cast information
    let parentCastData = null;
    let parentHash = cast.parent_hash;
    
    // Try to extract parent cast data from the webhook payload
    if (cast.parent && cast.parent.text) {
      // If parent cast data is directly available
      parentCastData = cast.parent;
      parentHash = cast.parent.hash || cast.parent_hash;
      console.log('📄 Found parent cast data in webhook payload');
    } else if (cast.parent_url && cast.parent_author) {
      // If we have parent URL and author, try to construct what we can
      console.log('🔍 Parent cast info available - URL:', cast.parent_url);
      parentCastData = {
        hash: parentHash,
        author: cast.parent_author,
        text: `Cast from ${cast.parent_author.username || 'Unknown'} - ${cast.parent_url}`,
        timestamp: cast.timestamp, // Use reply timestamp as fallback
        url: cast.parent_url
      };
    }
    
    console.log('👆 Parent hash:', parentHash)
    console.log('📋 Parent cast data available:', !!parentCastData)
    
    if (!parentHash && !parentCastData) {
      console.log('❌ No parent cast to save')
      return NextResponse.json({ message: 'No parent cast to save' })
    }
    
    // Extract actual content or create meaningful fallback
    let castContent = 'Cast content not available';
    let authorUsername = 'unknown';
    let authorDisplayName = 'Unknown User';
    let authorFid = 0;
    let authorPfpUrl = undefined;
    let castTimestamp = new Date().toISOString();
    let castUrl = undefined;
    
    if (parentCastData) {
      castContent = parentCastData.text || parentCastData.content || 'Cast content not available';
      authorUsername = parentCastData.author?.username || 'unknown';
      authorDisplayName = parentCastData.author?.display_name || parentCastData.author?.displayName || authorUsername;
      authorFid = parentCastData.author?.fid || 0;
      authorPfpUrl = parentCastData.author?.pfp_url || parentCastData.author?.pfpUrl;
      castTimestamp = parentCastData.timestamp || new Date().toISOString();
      castUrl = parentCastData.url || `https://warpcast.com/~/conversations/${parentHash}`;
    } else if (cast.parent_author) {
      // Fallback using available parent author info
      authorUsername = cast.parent_author.username || 'unknown';
      authorDisplayName = cast.parent_author.display_name || cast.parent_author.displayName || authorUsername;
      authorFid = cast.parent_author.fid || 0;
      authorPfpUrl = cast.parent_author.pfp_url || cast.parent_author.pfpUrl;
      castUrl = cast.parent_url || `https://warpcast.com/~/conversations/${parentHash}`;
      castContent = `Cast by @${authorUsername} - view on Farcaster: ${castUrl}`;
    }
    
    console.log('📝 Extracted cast content preview:', castContent.substring(0, 100) + '...');
    console.log('👤 Author:', authorUsername, '(FID:', authorFid, ')');
    
    // Parse the cast content for additional metadata
    const parsedData = ContentParser.parseContent(castContent);
    
    // Create cast data that matches your SavedCast interface
    const castData = {
      username: authorUsername,
      fid: authorFid,
      cast_hash: parentHash,
      cast_content: castContent,
      cast_timestamp: castTimestamp,
      tags: ['saved-via-bot', ...parsedData.hashtags?.slice(0, 3) || []] as string[],
      likes_count: 0, // Webhook doesn't include engagement data
      replies_count: 0,
      recasts_count: 0,
      cast_url: castUrl,
      author_pfp_url: authorPfpUrl,
      author_display_name: authorDisplayName,
      saved_by_user_id: cast.author.username, // The person who mentioned the bot
      category: 'saved-via-bot',
      notes: `💾 Saved via @cstkpr bot by @${cast.author.username} on ${new Date().toLocaleDateString()}`,
      parsed_data: {
        ...parsedData,
        topics: ['saved-cast', ...(parsedData.topics || [])]
      }
    } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
    
    console.log('💾 Saving cast with actual content...')
    
    // Test Supabase connection first
    console.log('🔍 Testing Supabase connection...')
    try {
      const { error: testError } = await supabase
        .from('saved_casts')
        .select('*')
        .limit(1)
      
      if (testError) {
        console.error('❌ Supabase connection test failed:', testError)
        return NextResponse.json({ 
          error: 'Database connection failed', 
          details: testError.message || 'Unknown database error' 
        }, { status: 500 })
      }
      
      console.log('✅ Supabase connection test successful')
    } catch (connectionError) {
      console.error('❌ Supabase connection error:', connectionError)
      return NextResponse.json({ 
        error: 'Database connection error', 
        details: connectionError instanceof Error ? connectionError.message : 'Unknown error' 
      }, { status: 500 })
    }
    
    // Save to database
    try {
      const savedCast = await CastService.saveCast(castData)
      console.log('✅ Cast saved successfully:', savedCast.cast_hash)
      console.log('📄 Saved content preview:', savedCast.cast_content.substring(0, 100) + '...')
      
      // Send conversational response back to the user
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
        content_preview: savedCast.cast_content.substring(0, 100) + '...'
      })
      
    } catch (saveError) {
      console.error('❌ Error saving cast:', saveError)
      
      // Check if it's a duplicate cast error
      if (saveError instanceof Error && saveError.message.includes('already saved')) {
        // Send friendly duplicate message
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
      
      // Send error message
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