// Updated webhook route with fixed headers and optional payment
import { NextRequest, NextResponse } from 'next/server'
import { CastService, BotService } from '@/lib/supabase'
import type { SavedCast as OriginalSavedCast } from '@/lib/supabase'

// Extend or redefine SavedCast to include user_id
type SavedCast = OriginalSavedCast & {
  user_id: string;
  bot_cast_hash: string | null;
  user_text: string;
  bot_response: string;
  conversation_type: string;
  parent_hash: string | null;
  is_reply_to_bot: boolean;
  created_at: string;
};

// ... [keep all your existing type definitions and helper functions] ...

// Define the WebhookCast type if not already defined or import it from the correct module
type WebhookCast = {
  hash: string;
  text: string;
  author: {
    username: string;
    fid?: number;
  };
  mentioned_profiles?: Array<{ username?: string; fid?: number }>;
  // Add other properties as needed based on your webhook payload structure
};

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
    
    const cast: WebhookCast = body.data
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

    // Rate limiting check
    const userId = cast.author.username
    const now = Date.now()
    if (await isRateLimited(userId, now)) {
      console.log('⏱️ Rate limit hit for user:', userId)
      return NextResponse.json({ message: 'Rate limited' })
    }

    // [Keep all your existing logic for conversation checking and response generation]
    // ... existing code ...

    // Define currentCastHash from the cast object
    const currentCastHash = cast.hash;

    // Define parentHash from the cast object if available (adjust as needed)
    const parentHash = (cast as any).parent_hash ?? null;

    // Define conversationType and responseText before using them
    // Example: You should replace this logic with your actual conversation type and response text generation
    const conversationType = 'default'; // TODO: Replace with actual logic
    const responseText = 'This is a placeholder response.'; // TODO: Replace with actual logic

    // Define isReplyToBotConversation (replace with actual logic as needed)
    const isReplyToBotConversation = false;

    console.log('🤖 Bot responding with', conversationType + ':', responseText)
    
    // Post reply to Farcaster using Neynar API
    try {
      console.log('📤 Attempting to post reply to Farcaster via Neynar...')
      
      // Check if we have the required API key
      if (!process.env.NEYNAR_API_KEY) {
        console.error('❌ Missing NEYNAR_API_KEY environment variable')
        
        // Store conversation even if posting fails
        await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
        
        return NextResponse.json({ 
          error: 'Missing Neynar API key configuration',
          response_generated: responseText,
          conversation_stored: true
        }, { status: 500 })
      }
      
      if (!process.env.NEYNAR_SIGNER_UUID) {
        console.error('❌ Missing NEYNAR_SIGNER_UUID environment variable')
        
        // Store conversation even if posting fails
        await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
        
        return NextResponse.json({ 
          error: 'Missing Neynar signer configuration',
          response_generated: responseText,
          conversation_stored: true
        }, { status: 500 })
      }

      // Prepare headers with payment support
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'x-api-key': process.env.NEYNAR_API_KEY, // ✅ Fixed: lowercase x-api-key
        'Content-Type': 'application/json',
        // Add payment header based on the 402 error response you received
        'X-PAYMENT': JSON.stringify({
          scheme: 'exact',
          network: 'base',
          maxAmountRequired: '100', // From your error response
          resource: 'http://api.neynar.com/farcaster/cast',
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
          payTo: '0xA6a8736f18f383f1cc2d938576933E5eA7Df01A1',
          maxTimeoutSeconds: 60
        })
      }
      
      const replyResponse = await fetch('https://api.neynar.com/v2/farcaster/cast', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          signer_uuid: process.env.NEYNAR_SIGNER_UUID,
          text: responseText,
          parent: currentCastHash
        }),
      })
      
      if (!replyResponse.ok) {
        const errorText = await replyResponse.text()
        console.error('❌ Neynar API error:', replyResponse.status, errorText)
        
        // If it's a 402 payment error, provide specific guidance
        if (replyResponse.status === 402) {
          console.log('💳 Payment required for cast posting. Consider enabling ENABLE_CAST_PAYMENTS=true or using an alternative approach.')
          
          // Still store the conversation for tracking
          await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
          
          return NextResponse.json({ 
            error: 'Payment required for cast posting', 
            details: 'Neynar requires 0.01 USDC payment for posting casts. Set ENABLE_CAST_PAYMENTS=true to enable payments.',
            response_generated: responseText,
            conversation_stored: true,
            payment_info: {
              amount: '0.01 USDC',
              network: 'Base',
              required: true
            }
          }, { status: 402 })
        }
        
        // Still try to store conversation even if posting fails
        await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
        
        return NextResponse.json({ 
          error: 'Failed to post reply to Farcaster', 
          details: errorText,
          response_generated: responseText,
          conversation_stored: true
        }, { status: 500 })
      }
      
      const replyData = await replyResponse.json()
      const botCastHash = replyData.cast?.hash
      
      console.log('✅ Successfully posted reply to Farcaster:', botCastHash)
      
      // Store the bot conversation for future reference
      await storeBotConversation(userId, currentCastHash, botCastHash, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Bot response posted successfully',
        response_text: responseText,
        conversation_type: conversationType,
        bot_cast_hash: botCastHash
      })
      
    } catch (error) {
      console.error('❌ Error posting reply:', error)
      
      // Still try to store conversation even if posting fails
      try {
        await storeBotConversation(userId, currentCastHash, null, cast.text, responseText, conversationType, parentHash ?? null, isReplyToBotConversation)
      } catch (storageError) {
        console.error('❌ Failed to store conversation after post error:', storageError)
      }
      
      return NextResponse.json({ 
        error: 'Failed to post reply', 
        details: error instanceof Error ? error.message : 'Unknown error',
        response_generated: responseText,
        conversation_storage_attempted: true
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

async function storeBotConversation(
  userId: string,
  currentCastHash: string,
  botCastHash: string | null,
  userText: string,
  responseText: string,
  conversationType: string,
  parentHash: string | null,
  isReplyToBotConversation: boolean
): Promise<void> {
  // Example: Save conversation to Supabase (or your DB)
  try {
    const conversation: SavedCast = {
      user_id: userId,
      cast_hash: currentCastHash,
      bot_cast_hash: botCastHash,
      user_text: userText,
      bot_response: responseText,
      conversation_type: conversationType,
      parent_hash: parentHash,
      is_reply_to_bot: isReplyToBotConversation,
      created_at: new Date().toISOString()
    };
    // Replace with your actual DB logic
    await CastService.saveConversation(conversation);
    console.log('💾 Conversation stored:', conversation);
  } catch (err) {
    console.error('❌ Failed to store conversation:', err);
    // Don't throw, just log
  }
}
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 3;

// In-memory store for rate limiting (for demo/dev only; use Redis or DB in prod)
const userRateLimitMap: Map<string, number[]> = new Map();

async function isRateLimited(userId: string, now: number): Promise<boolean> {
  const timestamps = userRateLimitMap.get(userId) || [];
  // Remove timestamps outside the window
  const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  recentTimestamps.push(now);
  userRateLimitMap.set(userId, recentTimestamps);
  return recentTimestamps.length > RATE_LIMIT_MAX_REQUESTS;
}
// [Keep all your existing helper functions: isRateLimited, storeBotConversation, handleSaveCommand, etc.]