// src/app/api/ai-organize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { userCasts, userVaults, userMessage } = await request.json()

    // Call OpenAI to organize casts
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are CastKPR's AI assistant that helps organize Farcaster casts into vaults (collections).

Available actions:
- add_to_vault: Add a cast to an existing vault
- create_vault: Create a new vault with a name and description
- tag_cast: Add a tag to a cast
- remove_tag: Remove a tag from a cast

When users ask you to organize casts, analyze their content and suggest logical groupings.
Be helpful and explain your reasoning. Always provide a conversational response.

Current vaults: ${userVaults.map((v: any) => `"${v.name}" (${v.description || 'no description'})`).join(', ')}

Example responses should include both conversation and actions.`
        },
        {
          role: 'user',
          content: `Please help organize my saved casts based on this request: "${userMessage}"

Here are my ${userCasts.length} saved casts:

${userCasts.map((cast: any) => 
  `Cast ID: ${cast.id}
Author: @${cast.author}
Content: ${cast.content}
Current Tags: ${cast.tags.join(', ') || 'none'}
Category: ${cast.category || 'general'}`
).join('\n\n')}`
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'organize_casts',
            description: 'Organize casts into vaults with specific actions',
            parameters: {
              type: 'object',
              properties: {
                response: {
                  type: 'string',
                  description: 'Conversational response explaining what you are doing'
                },
                actions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['add_to_vault', 'create_vault', 'tag_cast', 'remove_tag']
                      },
                      castId: { type: 'string', description: 'Cast ID for cast-specific actions' },
                      vaultId: { type: 'string', description: 'Existing vault ID' },
                      vaultName: { type: 'string', description: 'Name for new vault' },
                      description: { type: 'string', description: 'Description for new vault' },
                      value: { type: 'string', description: 'Tag value for tagging actions' }
                    },
                    required: ['type']
                  }
                },
                confidence: {
                  type: 'number',
                  description: 'Confidence in the organization strategy (0-100)'
                }
              },
              required: ['response', 'actions', 'confidence']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'organize_casts' } }
    })

    const toolCall = response.choices[0].message.tool_calls?.[0]
    if (toolCall?.function.arguments) {
      const result = JSON.parse(toolCall.function.arguments)
      return NextResponse.json({
        response: result.response,
        confidence: result.confidence / 100, // Convert to 0-1 scale
        actions: result.actions
      })
    }

    // Fallback response
    return NextResponse.json({
      response: "I can help you organize your casts! Try asking me to organize by topic or create specific vaults.",
      confidence: 0.7,
      actions: []
    })

  } catch (error) {
    console.error('Error in AI organize:', error)
    
    // Return fallback organization
    return NextResponse.json({
      response: "I'm having trouble with AI processing right now, but I can still help organize your casts using smart rules. Try asking me to 'organize by topic'.",
      confidence: 0.8,
      actions: []
    })
  }
}