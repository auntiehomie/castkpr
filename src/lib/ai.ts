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

  // Chat about saved casts
  static async chatAboutCasts(
    question: string, 
    userCasts: Array<{content: string, author: string, timestamp: string}>
  ): Promise<string> {
    const castsContext = userCasts.map(cast => 
      `Cast by ${cast.author} (${cast.timestamp}): ${cast.content}`
    ).join('\n\n')

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are CastKPR's AI assistant. Help users understand and explore their saved Farcaster casts. Be conversational and insightful.`
        },
        {
          role: "user",
          content: `Here are my saved casts:\n\n${castsContext}\n\nQuestion: ${question}`
        }
      ],
      max_tokens: 500
    })

    return response.choices[0].message.content || "I couldn't analyze that right now."
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