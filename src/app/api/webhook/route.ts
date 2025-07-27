import { NextRequest, NextResponse } from 'next/server'
import { CastService, ContentParser } from '@/lib/supabase'
import { analyzeCast, isValidCastHash } from '@/lib/cast-analyzer'
import type { SavedCast } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Enhanced webhook received!')
    
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
    const text = cast.text.toLowerCase()
    console.log('💬 Cast text:', text)
    
    // Enhanced command detection
    const isSaveCommand = text.includes('save this') || text.includes('save')
    const isAnalyzeCommand = text.includes('analyze this') || text.includes('deep analysis')
    const isQualityCommand = text.includes('quality score') || text.includes('score this')
    const isSentimentCommand = text.includes('sentiment') || text.includes('mood')
    const isTopicsCommand = text.includes('topics') || text.includes('extract topics')
    const isHelpCommand = text.includes('help')
    const isStatsCommand = text.includes('stats') || text.includes('my stats')
    
    console.log('🔍 Enhanced command detection:', {
      save: isSaveCommand,
      analyze: isAnalyzeCommand,
      quality: isQualityCommand,
      sentiment: isSentimentCommand,
      topics: isTopicsCommand,
      help: isHelpCommand,
      stats: isStatsCommand
    })

    // Handle HELP command
    if (isHelpCommand) {
      console.log('❓ Help command detected')
      return NextResponse.json({
        success: true,
        message: 'CastKPR Bot Commands',
        commands: [
          '@cstkpr save this - Save cast with enhanced analysis',
          '@cstkpr analyze this - Deep analysis of cast content',
          '@cstkpr quality score - Get quality rating and insights',
          '@cstkpr sentiment - Analyze mood and sentiment',
          '@cstkpr topics - Extract topics and entities',
          '@cstkpr stats - Your save statistics',
          '@cstkpr help - Show this help'
        ],
        features: [
          '🧠 AI-powered content analysis',
          '📊 Quality scoring and insights',
          '😊 Sentiment analysis',
          '🏷️ Automatic topic extraction',
          '🔗 Link and media analysis',
          '📈 Personal analytics'
        ]
      })
    }

    // Handle STATS command
    if (isStatsCommand) {
      console.log('📊 Stats command detected')
      try {
        const stats = await CastService.getUserStats(cast.author.username)
        return NextResponse.json({
          success: true,
          message: `Your CastKPR Stats`,
          stats: {
            totalCasts: stats.totalCasts,
            user: cast.author.username
          }
        })
      } catch (error) {
        console.error('❌ Error fetching stats:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to fetch your stats'
        })
      }
    }

    // Get parent hash for commands that need it
    const parentHash = cast.parent_hash
    
    if ((isAnalyzeCommand || isQualityCommand || isSentimentCommand || isTopicsCommand || isSaveCommand) && !parentHash) {
      return NextResponse.json({
        success: false,
        message: 'Please reply to a cast to use this command'
      })
    }

    // Handle QUALITY SCORE command
    if (isQualityCommand) {
      console.log('📊 Quality score command detected')
      
      try {
        const analyzedCast = await analyzeCast(parentHash)
        
        if (!analyzedCast) {
          return NextResponse.json({
            success: false,
            message: 'Could not fetch cast data for analysis'
          })
        }

        // Calculate a simple quality score based on available metrics
        const qualityScore = calculateQualityScore(analyzedCast)
        
        return NextResponse.json({
          success: true,
          message: 'Quality Analysis Complete',
          quality_score: qualityScore,
          breakdown: {
            content_length: analyzedCast.text.length,
            word_count: analyzedCast.parsed_data.word_count || 0,
            has_urls: (analyzedCast.parsed_data.urls?.length || 0) > 0,
            has_hashtags: (analyzedCast.parsed_data.hashtags?.length || 0) > 0,
            has_mentions: (analyzedCast.parsed_data.mentions?.length || 0) > 0,
            sentiment: analyzedCast.parsed_data.sentiment,
            engagement: {
              likes: analyzedCast.reactions.likes_count,
              replies: analyzedCast.replies.count,
              recasts: analyzedCast.reactions.recasts_count
            }
          },
          cast_preview: analyzedCast.text.slice(0, 100) + (analyzedCast.text.length > 100 ? '...' : ''),
          author: analyzedCast.author.username
        })
      } catch (error) {
        console.error('❌ Quality score error:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to analyze cast quality'
        })
      }
    }

    // Handle SENTIMENT command
    if (isSentimentCommand) {
      console.log('😊 Sentiment command detected')
      
      try {
        const analyzedCast = await analyzeCast(parentHash)
        
        if (!analyzedCast) {
          return NextResponse.json({
            success: false,
            message: 'Could not fetch cast data for analysis'
          })
        }
        
        return NextResponse.json({
          success: true,
          message: 'Sentiment Analysis Complete',
          sentiment: analyzedCast.parsed_data.sentiment,
          details: {
            word_count: analyzedCast.parsed_data.word_count,
            topics: analyzedCast.parsed_data.topics || [],
            has_positive_indicators: analyzedCast.parsed_data.sentiment === 'positive',
            content_type: getContentType(analyzedCast.text)
          },
          cast_preview: analyzedCast.text.slice(0, 100) + (analyzedCast.text.length > 100 ? '...' : ''),
          author: analyzedCast.author.username
        })
      } catch (error) {
        console.error('❌ Sentiment analysis error:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to analyze sentiment'
        })
      }
    }

    // Handle TOPICS command
    if (isTopicsCommand) {
      console.log('🏷️ Topics command detected')
      
      try {
        const analyzedCast = await analyzeCast(parentHash)
        
        if (!analyzedCast) {
          return NextResponse.json({
            success: false,
            message: 'Could not fetch cast data for analysis'
          })
        }
        
        return NextResponse.json({
          success: true,
          message: 'Topic Extraction Complete',
          topics: analyzedCast.parsed_data.topics || [],
          hashtags: analyzedCast.parsed_data.hashtags || [],
          mentions: analyzedCast.parsed_data.mentions || [],
          urls: analyzedCast.parsed_data.urls || [],
          content_analysis: {
            word_count: analyzedCast.parsed_data.word_count,
            content_type: getContentType(analyzedCast.text),
            has_media: (analyzedCast.embeds?.length || 0) > 0
          },
          cast_preview: analyzedCast.text.slice(0, 100) + (analyzedCast.text.length > 100 ? '...' : ''),
          author: analyzedCast.author.username
        })
      } catch (error) {
        console.error('❌ Topic extraction error:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to extract topics'
        })
      }
    }

    // Handle ANALYZE command
    if (isAnalyzeCommand) {
      console.log('🔍 Enhanced analyze command detected')
      
      try {
        const analyzedCast = await analyzeCast(parentHash)
        
        if (!analyzedCast) {
          return NextResponse.json({
            success: false,
            message: 'Could not fetch cast data for analysis'
          })
        }

        const qualityScore = calculateQualityScore(analyzedCast)
        const contentType = getContentType(analyzedCast.text)
        const engagementPotential = calculateEngagementPotential(analyzedCast)
        
        return NextResponse.json({
          success: true,
          message: 'Enhanced Analysis Complete',
          analysis: {
            quality_score: qualityScore,
            sentiment: analyzedCast.parsed_data.sentiment,
            content_type: contentType,
            engagement_potential: engagementPotential,
            topics: analyzedCast.parsed_data.topics?.slice(0, 5) || [],
            media_analysis: {
              has_images: analyzedCast.embeds?.some(url => isImageUrl(url)) || false,
              has_videos: analyzedCast.embeds?.some(url => isVideoUrl(url)) || false,
              has_links: (analyzedCast.parsed_data.urls?.length || 0) > 0
            },
            social_signals: {
              has_hashtags: (analyzedCast.parsed_data.hashtags?.length || 0) > 0,
              has_mentions: (analyzedCast.parsed_data.mentions?.length || 0) > 0,
              word_count: analyzedCast.parsed_data.word_count
            }
          },
          cast_info: {
            author: analyzedCast.author.username,
            content_preview: analyzedCast.text.slice(0, 150) + (analyzedCast.text.length > 150 ? '...' : ''),
            engagement: {
              likes: analyzedCast.reactions.likes_count,
              recasts: analyzedCast.reactions.recasts_count,
              replies: analyzedCast.replies.count
            },
            timestamp: analyzedCast.timestamp
          }
        })
      } catch (error) {
        console.error('❌ Error analyzing cast:', error)
        return NextResponse.json({
          success: false,
          message: 'Failed to analyze cast'
        })
      }
    }

    // Handle SAVE command - Enhanced with full analysis
    if (isSaveCommand) {
      console.log('💾 Enhanced save command detected')
      
      try {
        console.log('🔍 Analyzing cast before saving...')
        const analyzedCast = await analyzeCast(parentHash)
        
        if (!analyzedCast) {
          console.log('❌ Failed to analyze cast data')
          return NextResponse.json({ error: 'Could not fetch cast data for analysis' }, { status: 500 })
        }
        
        console.log('✅ Cast analyzed successfully')
        console.log('📝 Cast author:', analyzedCast.author.username)
        console.log('📝 Cast text length:', analyzedCast.text.length)
        
        // Calculate enhanced metrics
        const qualityScore = calculateQualityScore(analyzedCast)
        const contentType = getContentType(analyzedCast.text)
        const engagementPotential = calculateEngagementPotential(analyzedCast)
        
        // Create enhanced cast data
        const enhancedCastData = {
          username: analyzedCast.author.username,
          fid: analyzedCast.author.fid,
          cast_hash: parentHash,
          cast_content: analyzedCast.text,
          cast_timestamp: analyzedCast.timestamp,
          tags: [
            ...(analyzedCast.parsed_data.topics || []),
            contentType,
            analyzedCast.parsed_data.sentiment || 'neutral',
            engagementPotential,
            'enhanced-analysis',
            'saved-via-bot'
          ] as string[],
          likes_count: analyzedCast.reactions.likes_count,
          replies_count: analyzedCast.replies.count,
          recasts_count: analyzedCast.reactions.recasts_count,
          
          // Enhanced metadata
          cast_url: analyzedCast.cast_url,
          author_pfp_url: analyzedCast.author.pfp_url,
          author_display_name: analyzedCast.author.display_name || analyzedCast.author.username,
          saved_by_user_id: cast.author.username,
          category: contentType,
          notes: `💡 Quality: ${qualityScore}/100 | Sentiment: ${analyzedCast.parsed_data.sentiment} | Type: ${contentType} | Engagement: ${engagementPotential}`,
          
          // Enhanced parsed data
          parsed_data: {
            ...analyzedCast.parsed_data,
            quality_score: qualityScore,
            content_type: contentType,
            engagement_potential: engagementPotential,
            analysis_version: '2.0'
          }
        } satisfies Omit<SavedCast, 'id' | 'created_at' | 'updated_at'>
        
        console.log('💾 Saving enhanced cast data...')
        console.log('🔍 Analysis results:', {
          quality: qualityScore,
          sentiment: analyzedCast.parsed_data.sentiment,
          topics: analyzedCast.parsed_data.topics?.slice(0, 3),
          engagement: engagementPotential
        })
        
        // Save to database
        const savedCast = await CastService.saveCast(enhancedCastData)
        console.log('✅ Enhanced cast saved successfully:', savedCast.cast_hash)
        
        return NextResponse.json({ 
          success: true, 
          message: 'Cast saved with enhanced analysis',
          cast_id: savedCast.cast_hash,
          saved_cast_id: savedCast.id,
          author: analyzedCast.author.username,
          content_preview: analyzedCast.text.slice(0, 100) + (analyzedCast.text.length > 100 ? '...' : ''),
          analysis_summary: {
            quality_score: qualityScore,
            sentiment: analyzedCast.parsed_data.sentiment,
            content_type: contentType,
            engagement_potential: engagementPotential,
            topics: analyzedCast.parsed_data.topics?.slice(0, 3) || [],
            word_count: analyzedCast.parsed_data.word_count
          }
        })
        
      } catch (saveError) {
        console.error('❌ Error saving enhanced cast:', saveError)
        
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
    }

    // If no recognized command
    console.log('❓ No recognized command')
    return NextResponse.json({
      success: false,
      message: 'Command not recognized. Try: @cstkpr help for all available commands'
    })
    
  } catch (error) {
    console.error('💥 Enhanced webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper functions for analysis

function calculateQualityScore(analyzedCast: any): number {
  let score = 50 // Base score
  
  // Content length scoring
  const textLength = analyzedCast.text.length
  if (textLength > 200) score += 15
  else if (textLength > 100) score += 10
  else if (textLength > 50) score += 5
  
  // Word count scoring
  const wordCount = analyzedCast.parsed_data.word_count || 0
  if (wordCount > 30) score += 10
  else if (wordCount > 15) score += 5
  
  // Engagement scoring
  const totalEngagement = analyzedCast.reactions.likes_count + 
                         analyzedCast.reactions.recasts_count + 
                         analyzedCast.replies.count
  if (totalEngagement > 50) score += 20
  else if (totalEngagement > 20) score += 15
  else if (totalEngagement > 10) score += 10
  else if (totalEngagement > 5) score += 5
  
  // Content richness scoring
  if (analyzedCast.parsed_data.urls?.length > 0) score += 5
  if (analyzedCast.parsed_data.hashtags?.length > 0) score += 5
  if (analyzedCast.parsed_data.mentions?.length > 0) score += 5
  if (analyzedCast.embeds?.length > 0) score += 5
  
  // Sentiment bonus
  if (analyzedCast.parsed_data.sentiment === 'positive') score += 5
  
  return Math.min(100, Math.max(0, score))
}

function getContentType(text: string): string {
  const lowerText = text.toLowerCase()
  
  if (lowerText.includes('?') && lowerText.split('?').length > 2) return 'question'
  if (lowerText.includes('gm') || lowerText.includes('good morning')) return 'greeting'
  if (lowerText.includes('alpha') || lowerText.includes('trade') || lowerText.includes('$')) return 'alpha'
  if (lowerText.includes('meme') || lowerText.includes('😂') || lowerText.includes('🤣')) return 'meme'
  if (lowerText.includes('news') || lowerText.includes('announcement')) return 'news'
  if (lowerText.includes('build') || lowerText.includes('ship') || lowerText.includes('dev')) return 'building'
  if (lowerText.includes('art') || lowerText.includes('design')) return 'creative'
  if (text.length > 200) return 'long-form'
  
  return 'general'
}

function calculateEngagementPotential(analyzedCast: any): string {
  const score = calculateQualityScore(analyzedCast)
  const hasMedia = (analyzedCast.embeds?.length || 0) > 0
  const hasHashtags = (analyzedCast.parsed_data.hashtags?.length || 0) > 0
  const isPositive = analyzedCast.parsed_data.sentiment === 'positive'
  
  let potential = 'low'
  
  if (score > 80 && hasMedia && hasHashtags) potential = 'very-high'
  else if (score > 70 && (hasMedia || hasHashtags)) potential = 'high'
  else if (score > 60 || isPositive) potential = 'medium'
  
  return potential
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|webm)$/i.test(url)
}