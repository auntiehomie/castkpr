#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { 
  AnalyzeCastArgs, 
  CompareCastsArgs, 
  TrendingInsightsArgs, 
  CastOpinionArgs, 
  SimilarCastsArgs 
} from './types'

// Types
interface CastData {
  id: string
  cast_hash: string
  author: string
  text: string
  timestamp: string
  parsed_data: any
  user_id: string
}

interface CastComparison {
  cast1: CastData
  cast2: CastData
  similarity_score: number
  key_differences: string[]
  quality_comparison: {
    cast1_quality: number
    cast2_quality: number
    winner: string
    reasoning: string
  }
  engagement_comparison: {
    cast1_engagement: any
    cast2_engagement: any
    better_performer: string
    insights: string[]
  }
}

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

class CastKPRMCPServer {
  private server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'castkpr-insights',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupToolHandlers()
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'analyze_cast_performance',
            description: 'Analyze the performance metrics and quality of a specific cast',
            inputSchema: {
              type: 'object',
              properties: {
                cast_hash: {
                  type: 'string',
                  description: 'The hash of the cast to analyze'
                },
                user_id: {
                  type: 'string',
                  description: 'User ID to filter casts'
                }
              },
              required: ['cast_hash', 'user_id']
            }
          },
          {
            name: 'compare_casts',
            description: 'Compare two casts and provide detailed analysis of their differences and performance',
            inputSchema: {
              type: 'object',
              properties: {
                cast_hash_1: {
                  type: 'string',
                  description: 'Hash of the first cast to compare'
                },
                cast_hash_2: {
                  type: 'string',
                  description: 'Hash of the second cast to compare'
                },
                user_id: {
                  type: 'string',
                  description: 'User ID to filter casts'
                }
              },
              required: ['cast_hash_1', 'cast_hash_2', 'user_id']
            }
          },
          {
            name: 'get_trending_insights',
            description: 'Get trending topics and insights from recent casts',
            inputSchema: {
              type: 'object',
              properties: {
                user_id: {
                  type: 'string',
                  description: 'User ID to filter casts'
                },
                days: {
                  type: 'number',
                  description: 'Number of days to look back (default: 7)',
                  default: 7
                }
              },
              required: ['user_id']
            }
          },
          {
            name: 'generate_cast_opinion',
            description: 'Generate an AI-powered opinion on a cast based on its content and context',
            inputSchema: {
              type: 'object',
              properties: {
                cast_hash: {
                  type: 'string',
                  description: 'Hash of the cast to analyze'
                },
                user_id: {
                  type: 'string',
                  description: 'User ID to filter casts'
                },
                perspective: {
                  type: 'string',
                  description: 'Perspective for the opinion (e.g., "technical", "business", "social")',
                  default: 'general'
                }
              },
              required: ['cast_hash', 'user_id']
            }
          },
          {
            name: 'find_similar_casts',
            description: 'Find casts similar to a given cast based on content and metadata',
            inputSchema: {
              type: 'object',
              properties: {
                cast_hash: {
                  type: 'string',
                  description: 'Hash of the reference cast'
                },
                user_id: {
                  type: 'string',
                  description: 'User ID to filter casts'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of similar casts to return (default: 5)',
                  default: 5
                }
              },
              required: ['cast_hash', 'user_id']
            }
          }
        ]
      }
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params as { name: string, arguments: any }

      try {
        switch (name) {
          case 'analyze_cast_performance': {
            const typedArgs = args as AnalyzeCastArgs
            return await this.analyzeCastPerformance(typedArgs.cast_hash, typedArgs.user_id)
          }
          
          case 'compare_casts': {
            const typedArgs = args as CompareCastsArgs
            return await this.compareCasts(typedArgs.cast_hash_1, typedArgs.cast_hash_2, typedArgs.user_id)
          }
          
          case 'get_trending_insights': {
            const typedArgs = args as TrendingInsightsArgs
            return await this.getTrendingInsights(typedArgs.user_id, typedArgs.days || 7)
          }
          
          case 'generate_cast_opinion': {
            const typedArgs = args as CastOpinionArgs
            return await this.generateCastOpinion(typedArgs.cast_hash, typedArgs.user_id, typedArgs.perspective || 'general')
          }
          
          case 'find_similar_casts': {
            const typedArgs = args as SimilarCastsArgs
            return await this.findSimilarCasts(typedArgs.cast_hash, typedArgs.user_id, typedArgs.limit || 5)
          }
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error}`
        )
      }
    })
  }

  private async getCastData(castHash: string, userId: string): Promise<CastData | null> {
    const { data, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('cast_hash', castHash)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return data as CastData
  }

  private async analyzeCastPerformance(castHash: string, userId: string) {
    const cast = await this.getCastData(castHash, userId)
    
    if (!cast) {
      return {
        content: [{
          type: 'text',
          text: `Cast with hash ${castHash} not found for user ${userId}`
        }]
      }
    }

    const analysis = await this.performDetailedAnalysis(cast)
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(analysis, null, 2)
      }]
    }
  }

  private async compareCasts(castHash1: string, castHash2: string, userId: string) {
    const [cast1, cast2] = await Promise.all([
      this.getCastData(castHash1, userId),
      this.getCastData(castHash2, userId)
    ])

    if (!cast1 || !cast2) {
      return {
        content: [{
          type: 'text',
          text: `One or both casts not found for user ${userId}`
        }]
      }
    }

    const comparison = await this.performCastComparison(cast1, cast2)
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(comparison, null, 2)
      }]
    }
  }

  private async getTrendingInsights(userId: string, days: number) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: casts, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })

    if (error || !casts) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching casts: ${error?.message || 'Unknown error'}`
        }]
      }
    }

    const insights = await this.analyzeTrends(casts)
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(insights, null, 2)
      }]
    }
  }

  private async generateCastOpinion(castHash: string, userId: string, perspective: string) {
    const cast = await this.getCastData(castHash, userId)
    
    if (!cast) {
      return {
        content: [{
          type: 'text',
          text: `Cast with hash ${castHash} not found`
        }]
      }
    }

    const opinion = await this.generateAIOpinion(cast, perspective)
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(opinion, null, 2)
      }]
    }
  }

  private async findSimilarCasts(castHash: string, userId: string, limit: number) {
    const referenceCast = await this.getCastData(castHash, userId)
    
    if (!referenceCast) {
      return {
        content: [{
          type: 'text',
          text: `Cast with hash ${castHash} not found`
        }]
      }
    }

    const { data: allCasts, error } = await supabase
      .from('saved_casts')
      .select('*')
      .eq('user_id', userId)
      .neq('cast_hash', castHash)

    if (error || !allCasts) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching casts: ${error?.message || 'Unknown error'}`
        }]
      }
    }

    const similarCasts = await this.findSimilarContent(referenceCast, allCasts, limit)
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(similarCasts, null, 2)
      }]
    }
  }

  // AI Analysis Methods
  private async performDetailedAnalysis(cast: CastData) {
    const prompt = `Analyze this Farcaster cast in detail:

Content: "${cast.text}"
Author: ${cast.author}
Timestamp: ${cast.timestamp}
Current Data: ${JSON.stringify(cast.parsed_data)}

Provide a comprehensive analysis including:
1. Content quality score (1-10)
2. Engagement potential
3. Key topics and themes
4. Sentiment analysis
5. Recommendations for improvement
6. Competitive positioning

Format as JSON with clear structure.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    return JSON.parse(response.choices[0].message.content || '{}')
  }

  private async performCastComparison(cast1: CastData, cast2: CastData): Promise<CastComparison> {
    const prompt = `Compare these two Farcaster casts:

Cast 1:
- Content: "${cast1.text}"
- Author: ${cast1.author}
- Data: ${JSON.stringify(cast1.parsed_data)}

Cast 2:
- Content: "${cast2.text}"
- Author: ${cast2.author}
- Data: ${JSON.stringify(cast2.parsed_data)}

Provide a detailed comparison including:
1. Similarity score (0-100)
2. Key differences
3. Quality comparison with winner and reasoning
4. Engagement comparison
5. Strategic insights

Format as JSON with the CastComparison interface structure.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    return JSON.parse(response.choices[0].message.content || '{}')
  }

  private async analyzeTrends(casts: CastData[]) {
    const prompt = `Analyze trends from these ${casts.length} recent Farcaster casts:

${casts.map(cast => `- "${cast.text}" (${cast.timestamp})`).join('\n')}

Identify:
1. Trending topics and themes
2. Sentiment patterns
3. Engagement patterns
4. Content quality trends
5. Recommendations for future content

Format as JSON with clear insights.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    })

    return JSON.parse(response.choices[0].message.content || '{}')
  }

  private async generateAIOpinion(cast: CastData, perspective: string) {
    const prompt = `Generate a thoughtful opinion on this Farcaster cast from a ${perspective} perspective:

Content: "${cast.text}"
Author: ${cast.author}
Context: ${JSON.stringify(cast.parsed_data)}

Provide:
1. Overall assessment
2. Strengths and weaknesses
3. Market/audience fit
4. Potential impact
5. Specific recommendations
6. Confidence level in the opinion

Be honest, constructive, and insightful. Format as JSON.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6
    })

    return JSON.parse(response.choices[0].message.content || '{}')
  }

  private async findSimilarContent(referenceCast: CastData, allCasts: CastData[], limit: number) {
    // Simple similarity calculation - in production, you'd use vector embeddings
    const similarities = allCasts.map(cast => {
      const similarity = this.calculateTextSimilarity(referenceCast.text, cast.text)
      return { cast, similarity }
    })

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ cast, similarity }) => ({
        cast_hash: cast.cast_hash,
        author: cast.author,
        text: cast.text,
        similarity_score: similarity,
        timestamp: cast.timestamp
      }))
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity - replace with proper embeddings in production
    const words1 = new Set(text1.toLowerCase().split(' '))
    const words2 = new Set(text2.toLowerCase().split(' '))
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    return intersection.size / union.size
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CastKPRMCPServer()
  server.run().catch(console.error)
}

export { CastKPRMCPServer }
