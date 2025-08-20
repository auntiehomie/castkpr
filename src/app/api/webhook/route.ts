import { NextRequest, NextResponse } from 'next/server'
import { CastService, CstkprIntelligenceService, ContentParser, supabase } from '@/lib/supabase'
import type { SavedCast } from '@/lib/supabase'

// Response templates for variety
const RESPONSES = {
  SAVE_SUCCESS: [
    "✅ Cast saved! I've got it safely stored for you.",
    "💾 Saved! That's a keeper for sure.",
    "🎯 Got it! Cast saved to your collection.",
    "✨ Saved successfully! Another one for the books.",
    "📚 Filed away! Your cast is now saved.",
    "🔒 Locked in! Cast saved to your vault.",
    "⭐ Starred! This cast is now in your saved collection.",
    "📝 Noted! I've saved this cast for you.",
    "💯 Done! Cast saved and parsed.",
    "🎉 Success! Your cast is now safely saved."
  ],
  
  SAVE_ERROR: [
    "❌ Oops! I couldn't save that cast. Try again?",
    "⚠️ Something went wrong while saving. Give it another shot!",
    "💥 Save failed! I might be having technical difficulties.",
    "🤖 Beep boop! Error saving cast. Please retry.",
    "😅 That didn't work. Let me try again in a moment.",
    "🔧 Technical hiccup! Failed to save that cast.",
    "❗ Save unsuccessful. I'll investigate this issue.",
    "🚫 Couldn't save that one. Please try again later."
  ],
  
  ALREADY_SAVED: [
    "📋 I've already saved that cast for you!",
    "✋ Hold up! That cast is already in your collection.",
    "🔄 Déjà vu! I've saved this cast before.",
    "📚 Already got it! That cast is in your vault.",
    "✅ No need - that cast is already saved!",
    "🎯 I'm ahead of you! Already saved that one.",
    "📝 Previously saved! It's in your collection."
  ],
  
  NO_PARENT: [
    "🤔 I don't see a cast to save here. Reply to a cast with 'save this'!",
    "❓ What should I save? Reply to a cast to save it.",
    "📍 Point me to a cast! I need something to save.",
    "🎯 Target needed! Reply to a cast with the save command.",
    "💡 Tip: Reply to any cast with '@cstkpr save this' to save it!",
    "🔍 Looking for a cast to save... Reply to one!",
    "📌 I need a cast to save! Try replying to one."
  ],
  
  HELP: [
    `🤖 **CastKPR Bot Commands:**

💾 **@cstkpr save this** - Save any cast
🧠 **@cstkpr what's your opinion** - Get my AI opinion
💭 **@cstkpr your thoughts** - Alternative opinion request
📊 **@cstkpr stats** - Your save statistics  
❓ **@cstkpr help** - Show this help menu
🔍 **@cstkpr search [term]** - Search your saved casts
📋 **@cstkpr list** - Recent saved casts
🗑️ **@cstkpr delete [hash]** - Delete a saved cast
🏷️ **@cstkpr tag [hashtag]** - Add tags to last saved cast

🌐 **View your collection:** castkpr.vercel.app`,

    `🎯 **Quick Start Guide:**

1️⃣ Reply to any interesting cast with "@cstkpr save this"
2️⃣ Visit castkpr.vercel.app to view your collection  
3️⃣ Use "@cstkpr stats" to see your progress
4️⃣ Search with "@cstkpr search [keyword]"

✨ I automatically parse URLs, hashtags, mentions, and engagement data!`,

    `📚 **CastKPR Features:**

🔄 Auto-save casts with smart parsing
🏷️ Extract hashtags, URLs, and mentions
📊 Track engagement metrics
🔍 Powerful search capabilities
📱 Beautiful web dashboard
🤖 AI-powered organization

Try: "@cstkpr save this" on any cast!`
  ],
  
  STATS: [
    "📊 Let me fetch your stats! Check castkpr.vercel.app for detailed analytics.",
    "📈 Your save stats are waiting at castkpr.vercel.app/dashboard",
    "🎯 Stats time! Visit the dashboard for your complete overview.",
    "📋 I've saved [X] casts for you! See more at castkpr.vercel.app"
  ],
  
  SEARCH: [
    "🔍 Search results are best viewed at castkpr.vercel.app - try the search there!",
    "🎯 For powerful search, visit castkpr.vercel.app and use the search bar!",
    "📱 The web dashboard has amazing search features - check it out!"
  ],

  OPINION: [
    "🧠 Let me analyze this cast and share my opinion...",
    "💭 Analyzing the content and forming my thoughts...",
    "🤖 Processing cast data to generate my perspective...",
    "✨ Give me a moment to analyze and respond thoughtfully..."
  ],

  OPINION_ERROR: [
    "🤖 Sorry, I couldn't analyze that cast right now. Technical difficulties!",
    "⚠️ Opinion analysis failed. I might be having some processing issues.",
    "💥 Couldn't generate opinion - something went wrong on my end.",
    "🔧 Analysis error! Please try again later."
  ],
  
  UNKNOWN_COMMAND: [
    "🤔 I didn't understand that command. Try '@cstkpr help' for options!",
    "❓ Not sure what you mean. Use '@cstkpr help' to see available commands.",
    "🤖 Command not recognized. Type '@cstkpr help' for assistance!",
    "💡 Need help? Try '@cstkpr help' to see what I can do!",
    "🎯 Unknown command! '@cstkpr help' shows all available options.",
    "📚 I don't know that one. '@cstkpr help' for the full menu!"
  ],
  
  GENERAL_ERROR: [
    "🤖 Something went wrong on my end. Try again in a moment!",
    "⚠️ Technical difficulties! I'll be back to normal soon.",
    "🔧 Experiencing some issues. Please retry your command!",
    "💥 Oops! Temporary glitch. Give me another try!"
  ]
}

// Helper function to get random response
function getRandomResponse(responseArray: string[]): string {
  return responseArray[Math.floor(Math.random() * responseArray.length)]
}

// Helper function to send a reply cast
async function sendReply(parentHash: string, text: string): Promise<void> {
  try {
    console.log(`🤖 Attempting to reply to ${parentHash}: ${text}`)
    
    const neynarApiKey = process.env.NEYNAR_API_KEY
    const signerUuid = process.env.NEYNAR_SIGNER_UUID
    
    if (!neynarApiKey || !signerUuid) {
      console.error('❌ Missing Neynar API key or signer UUID')
      console.log('🤖 Would reply to', parentHash, ':', text)
      return
    }
    
    const replyData = {
      text: text,
      parent: parentHash,
      signer_uuid: signerUuid
    }
    
    console.log('📤 Sending reply via Neynar API...')
    
    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api_key': neynarApiKey,
      },
      body: JSON.stringify(replyData)
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Reply sent successfully:', result.cast?.hash)
    } else {
      const errorText = await response.text()
      console.error('❌ Failed to send reply:', response.status, errorText)
      console.log('🤖 Would have replied:', text)
    }
    
  } catch (error) {
    console.error('💥 Error sending reply:', error)
    console.log('🤖 Would have replied to', parentHash, ':', text)
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
    
    // Parse command from cast text
    const text = cast.text.toLowerCase().trim()
    console.log('💬 Cast text:', text)
    
    // Identify command type
    let commandType = 'unknown'
    let responseText = ''
    
    if (text.includes('save this') || text.includes('save')) {
      commandType = 'save'
    } else if (text.includes("what's your opinion") || text.includes('your opinion') || text.includes('opinion') || text.includes('what do you think') || text.includes('thoughts')) {
      commandType = 'opinion'
    } else if (text.includes('help') || text.includes('commands') || text.includes('how')) {
      commandType = 'help'
    } else if (text.includes('stats') || text.includes('statistics') || text.includes('count')) {
      commandType = 'stats'
    } else if (text.includes('search') || text.includes('find')) {
      commandType = 'search'
    } else if (text.includes('list') || text.includes('recent') || text.includes('show')) {
      commandType = 'list'
    } else if (text.includes('delete') || text.includes('remove')) {
      commandType = 'delete'
    } else if (text.includes('tag') || text.includes('hashtag')) {
      commandType = 'tag'
    } else if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
      commandType = 'greeting'
    } else {
      commandType = 'unknown'
    }
    
    console.log('🎯 Command type:', commandType)
    
    // Handle different commands
    switch (commandType) {
      case 'save':
        await handleSaveCommand(cast, text)
        break
        
      case 'help':
        responseText = getRandomResponse(RESPONSES.HELP)
        await sendReply(cast.hash, responseText)
        break
        
      case 'opinion':
        await handleOpinionCommand(cast)
        break
        
      case 'stats':
        responseText = getRandomResponse(RESPONSES.STATS)
        await sendReply(cast.hash, responseText)
        break
        
      case 'search':
        responseText = getRandomResponse(RESPONSES.SEARCH)
        await sendReply(cast.hash, responseText)
        break
        
      case 'list':
        responseText = "📋 Your recent saves are at castkpr.vercel.app/dashboard - check them out!"
        await sendReply(cast.hash, responseText)
        break
        
      case 'delete':
        responseText = "🗑️ To delete saves, visit castkpr.vercel.app and use the delete buttons!"
        await sendReply(cast.hash, responseText)
        break
        
      case 'tag':
        responseText = "🏷️ Add tags and organize your saves at castkpr.vercel.app!"
        await sendReply(cast.hash, responseText)
        break
        
      case 'greeting':
        responseText = `👋 Hey ${cast.author.display_name || cast.author.username}! I'm CastKPR, your Farcaster cast-saving bot. Try '@cstkpr help' to see what I can do!`
        await sendReply(cast.hash, responseText)
        break
        
      default:
        responseText = getRandomResponse(RESPONSES.UNKNOWN_COMMAND)
        await sendReply(cast.hash, responseText)
        break
    }
    
    return NextResponse.json({ 
      success: true, 
      command: commandType,
      response: responseText 
    })
    
  } catch (error) {
    console.error('💥 Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handle save command specifically
async function handleSaveCommand(cast: any, text: string): Promise<void> {
  try {
    const parentHash = cast.parent_hash
    console.log('👆 Parent hash:', parentHash)
    
    if (!parentHash) {
      const responseText = getRandomResponse(RESPONSES.NO_PARENT)
      await sendReply(cast.hash, responseText)
      return
    }
    
    // Extract parent cast data from webhook payload
    console.log('🔍 Checking for parent cast data in webhook...')
    
    let parentCastContent = '🔗 Cast content not available in webhook data'
    let parentAuthor = cast.parent_author
    let parentCastData = null
    
    // Check if there's embedded parent cast data
    if (cast.parent_cast) {
      parentCastData = cast.parent_cast
      parentCastContent = parentCastData.text || parentCastContent
      parentAuthor = parentCastData.author || parentAuthor
      console.log('✅ Found parent cast data in webhook!')
    } else if (cast.parent) {
      parentCastData = cast.parent
      parentCastContent = parentCastData.text || parentCastContent
      parentAuthor = parentCastData.author || parentAuthor
      console.log('✅ Found parent data in webhook!')
    }
    
    // If we still don't have content, try Neynar API
    if (parentCastContent === '🔗 Cast content not available in webhook data') {
      console.log('🌐 Attempting to fetch cast data from Neynar...')
      try {
        const neynarResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
          {
            headers: {
              'api_key': process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS',
            },
          }
        )
        
        if (neynarResponse.ok) {
          const neynarData = await neynarResponse.json()
          if (neynarData.cast) {
            parentCastContent = neynarData.cast.text || parentCastContent
            parentAuthor = neynarData.cast.author || parentAuthor
            console.log('✅ Fetched cast content from Neynar API')
          }
        }
      } catch (apiError) {
        console.log('⚠️ Could not fetch from Neynar API:', apiError)
      }
    }
    
    // Parse content for metadata
    const parseContent = (text: string) => {
      const urls = text.match(/(https?:\/\/[^\s]+)/g) || []
      const mentions = [...text.matchAll(/@(\w+)/g)].map(match => match[1])
      const hashtags = [...text.matchAll(/#(\w+)/g)].map(match => match[1])
      
      return {
        urls,
        mentions,
        hashtags,
        word_count: text.split(' ').length,
        sentiment: 'neutral' as const,
        topics: hashtags.length > 0 ? hashtags : ['general']
      }
    }
    
    const parsedData = parseContent(parentCastContent)
    
    // Create cast data
    const castData = {
      username: parentAuthor?.username || `user-${parentAuthor?.fid || 'unknown'}`,
      fid: parentAuthor?.fid || 0,
      cast_hash: parentHash,
      cast_content: parentCastContent,
      cast_timestamp: new Date().toISOString(),
      tags: ['saved-via-bot', ...parsedData.hashtags] as string[],
      likes_count: 0,
      replies_count: 0,
      recasts_count: 0,
      cast_url: `https://warpcast.com/~/conversations/${parentHash}`,
      author_pfp_url: parentAuthor?.pfp_url,
      author_display_name: parentAuthor?.display_name || parentAuthor?.username,
      saved_by_user_id: cast.author.username,
      category: 'saved-via-bot',
      notes: `💾 Saved via @cstkpr bot by ${cast.author.username} on ${new Date().toLocaleDateString()}`,
      parsed_data: parsedData
    } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
    
    console.log('💾 Saving cast...')
    
    try {
      const savedCast = await CastService.saveCast(castData)
      console.log('✅ Cast saved successfully')
      
      const responseText = getRandomResponse(RESPONSES.SAVE_SUCCESS)
      await sendReply(cast.hash, responseText)
      
    } catch (saveError: any) {
      console.error('❌ Error saving cast:', saveError)
      
      if (saveError.message?.includes('already saved')) {
        const responseText = getRandomResponse(RESPONSES.ALREADY_SAVED)
        await sendReply(cast.hash, responseText)
      } else {
        const responseText = getRandomResponse(RESPONSES.SAVE_ERROR)
        await sendReply(cast.hash, responseText)
      }
    }
    
  } catch (error) {
    console.error('💥 Save command error:', error)
    const responseText = getRandomResponse(RESPONSES.GENERAL_ERROR)
    await sendReply(cast.hash, responseText)
  }
}

// Handle opinion command - analyze a cast and provide @cstkpr's opinion
async function handleOpinionCommand(cast: any): Promise<void> {
  try {
    console.log('🧠 Handling opinion request from:', cast.author.username)
    
    const parentHash = cast.parent_hash
    console.log('👆 Parent hash for opinion analysis:', parentHash)
    
    if (!parentHash) {
      const responseText = "🤔 I need a cast to analyze! Reply to any cast with '@cstkpr what's your opinion' to get my thoughts on it."
      await sendReply(cast.hash, responseText)
      return
    }
    
    // Send initial analysis message
    const initialResponse = getRandomResponse(RESPONSES.OPINION)
    await sendReply(cast.hash, initialResponse)
    
    // Extract parent cast data from webhook payload (if available)
    let parentCastContent = 'Cast content not available in webhook data'
    let parentAuthor = 'Unknown author'
    let parentCastMediaInfo = ''
    
    // Check if parent cast data is in the webhook payload
    if (cast.parent_cast?.text) {
      parentCastContent = cast.parent_cast.text
      parentAuthor = cast.parent_cast.author?.username || cast.parent_cast.author?.display_name || 'Unknown'
      
      // Extract media information
      if (cast.parent_cast.embeds && cast.parent_cast.embeds.length > 0) {
        const mediaTypes = cast.parent_cast.embeds.map((embed: any) => {
          if (embed.url) {
            if (embed.url.includes('youtube.com') || embed.url.includes('youtu.be')) {
              return 'YouTube video'
            } else if (embed.url.includes('.mp4') || embed.url.includes('.webm')) {
              return 'video'
            } else if (embed.url.includes('.jpg') || embed.url.includes('.png') || embed.url.includes('.gif')) {
              return 'image'
            } else {
              return 'link'
            }
          }
          return 'media'
        })
        parentCastMediaInfo = ` [Contains: ${mediaTypes.join(', ')}]`
      }
    } else if (cast.parent?.text) {
      parentCastContent = cast.parent.text
      parentAuthor = cast.parent.author?.username || cast.parent.author?.display_name || 'Unknown'
      
      // Extract media information from parent
      if (cast.parent.embeds && cast.parent.embeds.length > 0) {
        const mediaTypes = cast.parent.embeds.map((embed: any) => {
          if (embed.url) {
            if (embed.url.includes('youtube.com') || embed.url.includes('youtu.be')) {
              return 'YouTube video'
            } else if (embed.url.includes('.mp4') || embed.url.includes('.webm')) {
              return 'video'
            } else if (embed.url.includes('.jpg') || embed.url.includes('.png') || embed.url.includes('.gif')) {
              return 'image'
            } else {
              return 'link'
            }
          }
          return 'media'
        })
        parentCastMediaInfo = ` [Contains: ${mediaTypes.join(', ')}]`
      }
    } else {
      // Fallback: Try to fetch parent cast from Neynar API
      console.log('🔍 Parent cast data not in webhook, attempting to fetch from API...')
      try {
        const neynarApiKey = process.env.NEYNAR_API_KEY
        if (neynarApiKey) {
          const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`, {
            headers: {
              'Accept': 'application/json',
              'api_key': neynarApiKey,
            },
          })
          
          if (response.ok) {
            const castData = await response.json()
            if (castData.cast) {
              parentCastContent = castData.cast.text || 'No text content'
              parentAuthor = castData.cast.author?.username || castData.cast.author?.display_name || 'Unknown'
              
              // Extract media information
              if (castData.cast.embeds && castData.cast.embeds.length > 0) {
                const mediaTypes = castData.cast.embeds.map((embed: any) => {
                  if (embed.url) {
                    if (embed.url.includes('youtube.com') || embed.url.includes('youtu.be')) {
                      return 'YouTube video'
                    } else if (embed.url.includes('.mp4') || embed.url.includes('.webm')) {
                      return 'video'
                    } else if (embed.url.includes('.jpg') || embed.url.includes('.png') || embed.url.includes('.gif')) {
                      return 'image'
                    } else {
                      return 'link'
                    }
                  }
                  return 'media'
                })
                parentCastMediaInfo = ` [Contains: ${mediaTypes.join(', ')}]`
              }
              console.log('✅ Successfully fetched parent cast from API')
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch parent cast from API:', error)
      }
    }
    
    console.log('📝 Parent cast content for analysis:', parentCastContent.substring(0, 100))
    console.log('🎬 Media info:', parentCastMediaInfo || 'No media detected')
    
    // Generate @cstkpr's opinion using the intelligence service
    try {
      // Use a simplified approach that doesn't require database storage
      console.log('🧠 Generating enhanced opinion analysis...')
      
      // Enhance the content with media context
      const enhancedContent = parentCastContent + parentCastMediaInfo
      
      // Extract topics and analyze sentiment
      const topics = CstkprIntelligenceService.extractCastTopics(enhancedContent)
      const parsed = ContentParser.parseContent(enhancedContent)
      const sentiment = parsed.sentiment || 'neutral'
      
      // Try to get some related casts for better context
      let relatedCasts: any[] = []
      if (topics.length > 0) {
        try {
          // Get some related casts from the database
          for (const topic of topics.slice(0, 2)) { // Use top 2 topics
            try {
              const topicCasts = await CastService.getCastsByTopic(topic, 3)
              relatedCasts.push(...topicCasts)
            } catch (error) {
              console.log(`No casts found for topic: ${topic}`)
            }
          }
          
          // Remove duplicates
          relatedCasts = relatedCasts.filter((cast, index, self) => 
            index === self.findIndex(c => c.id === cast.id)
          ).slice(0, 5) // Limit to 5 related casts
          
          console.log(`🔍 Found ${relatedCasts.length} related casts for context`)
        } catch (error) {
          console.log('No related casts found in database')
        }
      }
      
      // Generate opinion using enhanced logic
      const opinion = await CstkprIntelligenceService.generateOpinion(
        enhancedContent,
        parentAuthor,
        topics,
        relatedCasts,
        null // No web research for now, but we could add this
      )
      
      // Format the opinion response with personality
      const confidenceEmoji = opinion.confidence > 0.8 ? '💯' : 
                            opinion.confidence > 0.6 ? '✨' : '🤔'
      
      const toneEmoji = {
        'analytical': '📊',
        'supportive': '👍',
        'critical': '🔍',
        'curious': '❓',
        'neutral': '💭'
      }[opinion.tone] || '💭'
      
      const responseText = `🧠 **My Opinion:** ${opinion.text} ${confidenceEmoji}
      
${toneEmoji} **Analysis:** ${Math.round(opinion.confidence * 100)}% confidence • ${opinion.tone} tone${parentCastMediaInfo ? `\n🎬 **Media Context:** ${parentCastMediaInfo.replace(/^\s*\[Contains:\s*/, '').replace(/\]$/, '')}` : ''}${relatedCasts.length > 0 ? `\n📚 **Context:** Based on ${relatedCasts.length} related saved casts` : ''}

📊 Enhanced analysis with ${topics.length > 0 ? `topics: ${topics.slice(0, 3).join(', ')}` : 'content patterns'}.

💡 *Want deeper analysis? Check the Intelligence Dashboard at castkpr.vercel.app*`
      
      await sendReply(cast.hash, responseText)
      
    } catch (analysisError) {
      console.error('💥 Opinion analysis error:', analysisError)
      const errorResponse = getRandomResponse(RESPONSES.OPINION_ERROR)
      await sendReply(cast.hash, errorResponse)
    }
    
  } catch (error) {
    console.error('💥 Opinion command error:', error)
    const responseText = getRandomResponse(RESPONSES.GENERAL_ERROR)
    await sendReply(cast.hash, responseText)
  }
}