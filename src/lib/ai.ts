// src/lib/ai.ts
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export class AIService {
  // Analyze a single cast
  static async analyzeCast(castContent: string, author: string): Promise<{
    sentiment: string
    topics: string[]
    keyInsights: string[]
    summary: string
  }> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that analyzes Farcaster casts. Provide sentiment, topics, key insights, and a brief summary."
        },
        {
          role: "user", 
          content: `Analyze this cast by ${author}: "${castContent}"`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_cast",
            description: "Analyze a Farcaster cast",
            parameters: {
              type: "object",
              properties: {
                sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
                topics: { type: "array", items: { type: "string" } },
                keyInsights: { type: "array", items: { type: "string" } },
                summary: { type: "string" }
              },
              required: ["sentiment", "topics", "keyInsights", "summary"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "analyze_cast" } }
    })

    const toolCall = response.choices[0].message.tool_calls?.[0]
    if (toolCall?.function.arguments) {
      return JSON.parse(toolCall.function.arguments)
    }

    // Fallback if tool call fails
    return {
      sentiment: "neutral",
      topics: [],
      keyInsights: [],
      summary: "Unable to analyze this cast."
    }
  }

  // Enhanced chat with function calling capabilities
  static async chatAboutCasts(
    question: string, 
    userCasts: Array<{content: string, author: string, timestamp: string, id?: string, tags?: string[]}>
  ): Promise<{
    response: string,
    actions?: Array<{
      type: 'add_tag' | 'remove_tag' | 'add_note',
      castId: string,
      value: string
    }>
  }> {
    const castsContext = userCasts.map(cast => 
      `Cast ID: ${cast.id || 'unknown'}
Author: ${cast.author}
Content: ${cast.content}
Current Tags: ${(cast.tags || []).join(', ')}
Timestamp: ${cast.timestamp}`
    ).join('\n\n')

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are CastKPR's AI assistant. You can help users understand their saved Farcaster casts AND perform actions on them.

Available functions:
- add_tag_to_cast: Add a tag to a specific cast
- remove_tag_from_cast: Remove a tag from a specific cast  
- add_note_to_cast: Add a note to a specific cast

When users ask you to tag casts, organize content, or modify their saved casts, use these functions.
Be conversational and helpful. Always explain what actions you're taking.`
        },
        {
          role: "user",
          content: `Here are my saved casts:

${castsContext}

Question: ${question}`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "add_tag_to_cast",
            description: "Add a tag to a specific cast",
            parameters: {
              type: "object",
              properties: {
                castId: { type: "string", description: "The ID of the cast to tag" },
                tag: { type: "string", description: "The tag to add (lowercase, no spaces)" }
              },
              required: ["castId", "tag"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "remove_tag_from_cast", 
            description: "Remove a tag from a specific cast",
            parameters: {
              type: "object",
              properties: {
                castId: { type: "string", description: "The ID of the cast" },
                tag: { type: "string", description: "The tag to remove" }
              },
              required: ["castId", "tag"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "add_note_to_cast",
            description: "Add or update a note on a specific cast", 
            parameters: {
              type: "object",
              properties: {
                castId: { type: "string", description: "The ID of the cast" },
                note: { type: "string", description: "The note content to add" }
              },
              required: ["castId", "note"]
            }
          }
        }
      ]
    })

    const message = response.choices[0].message
    const actions: Array<{type: 'add_tag' | 'remove_tag' | 'add_note', castId: string, value: string}> = []

    // Process any function calls
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments)
        
        switch (toolCall.function.name) {
          case 'add_tag_to_cast':
            actions.push({
              type: 'add_tag',
              castId: args.castId,
              value: args.tag.toLowerCase().trim()
            })
            break
          case 'remove_tag_from_cast':
            actions.push({
              type: 'remove_tag', 
              castId: args.castId,
              value: args.tag
            })
            break
          case 'add_note_to_cast':
            actions.push({
              type: 'add_note',
              castId: args.castId, 
              value: args.note
            })
            break
        }
      }
    }

    return {
      response: message.content || "I processed your request.",
      actions: actions.length > 0 ? actions : undefined
    }
  }

  // Generate insights across all casts
  static async generateInsights(casts: Array<{content: string, author: string}>): Promise<{
    topTopics: string[]
    interestingPatterns: string[]
    recommendedFollows: string[]
    summary: string
  }> {
    const allContent = casts.map(c => c.content).join(' ')
    const authors = [...new Set(casts.map(c => c.author))]

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Analyze a collection of saved Farcaster casts and provide insights about the user's interests and patterns."
        },
        {
          role: "user",
          content: `Analyze these ${casts.length} saved casts from authors: ${authors.join(', ')}\n\nContent: ${allContent}`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_insights",
            description: "Generate insights about saved casts",
            parameters: {
              type: "object", 
              properties: {
                topTopics: { type: "array", items: { type: "string" } },
                interestingPatterns: { type: "array", items: { type: "string" } },
                recommendedFollows: { type: "array", items: { type: "string" } },
                summary: { type: "string" }
              },
              required: ["topTopics", "interestingPatterns", "recommendedFollows", "summary"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "generate_insights" } }
    })

    const toolCall = response.choices[0].message.tool_calls?.[0]
    if (toolCall?.function.arguments) {
      return JSON.parse(toolCall.function.arguments)
    }

    // Fallback if tool call fails
    return {
      topTopics: [],
      interestingPatterns: [],
      recommendedFollows: [],
      summary: "Unable to generate insights."
    }
  }
}