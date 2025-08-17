'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Sparkles, X } from 'lucide-react'
import { VaultService, CastService, ContentParser, type Vault, type SavedCast } from '@/lib/supabase'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface AICharPanelProps {
  userId: string
  onClose?: () => void
  onCastUpdate?: () => void
}

export default function AICharPanel({ userId, onClose, onCastUpdate }: AICharPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI assistant. I can help you organize your saved casts into vaults, analyze patterns, and manage your knowledge base. Try commands like:\n• 'List my vaults'\n• 'Analyze my recent casts'\n• 'Organize my casts into vaults'\n• 'Show casts about [topic]'\n• 'Create a vault for [topic]'",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [vaults, setVaults] = useState<Vault[]>([])
  const [casts, setCasts] = useState<SavedCast[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load vaults and casts on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [userVaults, userCasts] = await Promise.all([
          VaultService.getUserVaults(userId),
          CastService.getUserCasts(userId, 100)
        ])
        setVaults(userVaults)
        setCasts(userCasts)
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }
    loadData()
  }, [userId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Enhanced functions for AI to use
  const functions = [
    {
      name: 'list_vaults',
      description: 'List all vaults for the user',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'create_vault',
      description: 'Create a new vault',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the vault' },
          description: { type: 'string', description: 'Description of the vault' },
          rules: { type: 'array', items: { type: 'string' }, description: 'Rules for auto-categorization' }
        },
        required: ['name', 'description']
      }
    },
    {
      name: 'add_cast_to_vault',
      description: 'Add a cast to a specific vault',
      parameters: {
        type: 'object',
        properties: {
          cast_hash: { type: 'string', description: 'Hash of the cast to add' },
          vault_name: { type: 'string', description: 'Name of the vault' }
        },
        required: ['cast_hash', 'vault_name']
      }
    },
    {
      name: 'organize_casts_into_vaults',
      description: 'Automatically organize casts into appropriate vaults based on content',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of casts to organize (default: all)' }
        }
      }
    },
    {
      name: 'analyze_recent_casts',
      description: 'Analyze patterns and themes in recent casts',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of recent casts to analyze' }
        }
      }
    },
    {
      name: 'search_casts',
      description: 'Search for casts by content, author, or tags',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          vault_id: { type: 'string', description: 'Optional: search within specific vault' }
        },
        required: ['query']
      }
    },
    {
      name: 'get_vault_casts',
      description: 'Get all casts in a specific vault',
      parameters: {
        type: 'object',
        properties: {
          vault_name: { type: 'string', description: 'Name of the vault' }
        },
        required: ['vault_name']
      }
    },
    {
      name: 'organize_by_sentiment',
      description: 'Organize casts by sentiment (positive, negative, neutral)',
      parameters: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_first_saved_cast',
      description: 'Get the first/oldest saved cast',
      parameters: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_most_recent_cast',
      description: 'Get the most recent/newest saved cast',
      parameters: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'read_cast_content',
      description: 'Read the full content and metadata of a specific cast',
      parameters: {
        type: 'object',
        properties: {
          cast_hash: { type: 'string', description: 'Hash of the cast to read' }
        },
        required: ['cast_hash']
      }
    },
    {
      name: 'analyze_cast_for_vaults',
      description: 'Analyze a cast content and suggest which existing vaults it might belong to',
      parameters: {
        type: 'object',
        properties: {
          cast_hash: { type: 'string', description: 'Hash of the cast to analyze' }
        },
        required: ['cast_hash']
      }
    },
    {
      name: 'get_vault_details',
      description: 'Get detailed information about a specific vault including its purpose and existing cast themes',
      parameters: {
        type: 'object',
        properties: {
          vault_name: { type: 'string', description: 'Name of the vault to analyze' }
        },
        required: ['vault_name']
      }
    },
    {
      name: 'smart_organize_single_cast',
      description: 'Intelligently organize a single cast by analyzing its content against all available vaults',
      parameters: {
        type: 'object',
        properties: {
          cast_hash: { type: 'string', description: 'Hash of the cast to organize' }
        },
        required: ['cast_hash']
      }
    },
    {
      name: 'analyze_all_casts_content',
      description: 'Analyze content themes across all saved casts to identify patterns and suggest vault organization',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of casts to analyze (default: all)' }
        }
      }
    }
  ]

  // Function implementations
  const executeFunction = async (name: string, args: any) => {
    try {
      switch (name) {
        case 'list_vaults': {
          const vaults = await VaultService.getUserVaults(userId)
          const vaultList = vaults.map((v: Vault) => ({
            name: v.name,
            description: v.description,
            cast_count: v.cast_count || 0,
            rules: v.auto_add_rules
          }))
          return {
            success: true,
            vaults: vaultList,
            total: vaults.length,
            message: vaults.length > 0 
              ? `You have ${vaults.length} vault${vaults.length !== 1 ? 's' : ''}` 
              : 'You have no vaults yet. Would you like me to create some based on your saved casts?'
          }
        }

        case 'create_vault': {
          const vault = await VaultService.createVault(
            args.name,
            args.description || '',
            args.rules || [],
            userId
          )
          
          // Refresh data in parent component
          onCastUpdate?.()
          
          return {
            success: true,
            vault: vault,
            message: `Created vault "${args.name}" successfully!`
          }
        }

        case 'add_cast_to_vault': {
          // Find the vault by name
          const vault = vaults.find(v => v.name.toLowerCase() === args.vault_name.toLowerCase())
          if (!vault) {
            return { success: false, message: `Vault "${args.vault_name}" not found` }
          }

          // Find the cast
          const cast = casts.find(c => c.cast_hash === args.cast_hash)
          if (!cast) {
            return { success: false, message: 'Cast not found' }
          }

          await VaultService.addCastToVault(cast.id, vault.id)
          
          // Refresh data in parent component
          onCastUpdate?.()
          
          return {
            success: true,
            message: `Added cast to vault "${args.vault_name}"`
          }
        }

        case 'organize_casts_into_vaults': {
          const limit = args.limit || casts.length
          const castsToOrganize = casts.slice(0, limit)
          const results = []

          // Create default vaults if none exist
          if (vaults.length === 0) {
            const defaultVaults = [
              { name: 'Technical', description: 'Programming, crypto, and technical content', rules: ['programming', 'crypto', 'blockchain', 'code', 'technical'] },
              { name: 'Social', description: 'Social interactions and community content', rules: ['gm', 'community', 'social', 'friends'] },
              { name: 'Finance', description: 'Financial and investment content', rules: ['defi', 'trading', 'investment', 'finance', 'money'] },
              { name: 'Learning', description: 'Educational and learning resources', rules: ['learn', 'tutorial', 'guide', 'education', 'resource'] }
            ]

            for (const v of defaultVaults) {
              const newVault = await VaultService.createVault(v.name, v.description, v.rules, userId)
              vaults.push(newVault)
            }
          }

          // Organize casts into vaults
          for (const cast of castsToOrganize) {
            const content = cast.cast_content.toLowerCase()
            
            for (const vault of vaults) {
              const rules = vault.auto_add_rules || []
              const matches = rules.some((rule: string) => content.includes(rule.toLowerCase()))
              
              if (matches) {
                try {
                  await VaultService.addCastToVault(cast.id, vault.id)
                  results.push({ cast: cast.cast_hash, vault: vault.name })
                } catch (error) {
                  // Cast might already be in vault
                }
                break // Only add to first matching vault
              }
            }
          }

          // Refresh data in parent component
          onCastUpdate?.()

          return {
            success: true,
            organized: results.length,
            results: results,
            message: `Organized ${results.length} casts into vaults`
          }
        }

        case 'analyze_recent_casts': {
          const limit = args.limit || 10
          const recentCasts = casts.slice(0, limit)
          
          // Analyze patterns
          const topics = new Map<string, number>()
          const authors = new Map<string, number>()
          const hashtags = new Set<string>()
          const urls = new Set<string>()
          
          recentCasts.forEach(cast => {
            // Count authors
            authors.set(cast.username, (authors.get(cast.username) || 0) + 1)
            
            // Extract hashtags
            const hashtagMatches = cast.cast_content.match(/#\w+/g) || []
            hashtagMatches.forEach(tag => hashtags.add(tag))
            
            // Extract URLs
            const urlMatches = cast.cast_content.match(/https?:\/\/[^\s]+/g) || []
            urlMatches.forEach(url => urls.add(url))
            
            // Simple topic detection
            const topicKeywords = {
              'crypto': ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft'],
              'farcaster': ['farcaster', 'warpcast', 'cast', 'frame'],
              'ai': ['ai', 'gpt', 'llm', 'machine learning', 'artificial'],
              'development': ['code', 'programming', 'developer', 'github', 'build']
            }
            
            Object.entries(topicKeywords).forEach(([topic, keywords]) => {
              if (keywords.some(keyword => cast.cast_content.toLowerCase().includes(keyword))) {
                topics.set(topic, (topics.get(topic) || 0) + 1)
              }
            })
          })

          return {
            success: true,
            analysis: {
              total_casts: recentCasts.length,
              top_topics: Array.from(topics.entries()).sort((a, b) => b[1] - a[1]),
              top_authors: Array.from(authors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
              hashtags: Array.from(hashtags).slice(0, 10),
              urls_found: urls.size,
              average_length: Math.round(recentCasts.reduce((sum, c) => sum + c.cast_content.length, 0) / recentCasts.length)
            },
            message: `Analyzed ${recentCasts.length} recent casts`
          }
        }

        case 'search_casts': {
          const results = await CastService.searchCasts(userId, args.query)
          
          return {
            success: true,
            found: results.length,
            casts: results.slice(0, 5).map(c => ({
              hash: c.cast_hash,
              author: c.username,
              content: c.cast_content.substring(0, 100) + (c.cast_content.length > 100 ? '...' : ''),
              timestamp: c.cast_timestamp
            })),
            message: `Found ${results.length} casts matching "${args.query}"`
          }
        }

        case 'get_vault_casts': {
          const vault = vaults.find(v => v.name.toLowerCase() === args.vault_name.toLowerCase())
          if (!vault) {
            return { success: false, message: `Vault "${args.vault_name}" not found` }
          }

          const vaultCasts = await VaultService.getVaultCasts(vault.id)
          
          return {
            success: true,
            vault: args.vault_name,
            cast_count: vaultCasts.length,
            casts: vaultCasts.slice(0, 5).map((c: SavedCast) => ({
              hash: c.cast_hash,
              author: c.username,
              content: c.cast_content.substring(0, 100) + (c.cast_content.length > 100 ? '...' : ''),
              timestamp: c.cast_timestamp
            })),
            message: `Vault "${args.vault_name}" contains ${vaultCasts.length} casts`
          }
        }

        case 'organize_by_sentiment': {
          // Create sentiment vaults if they don't exist
          const sentimentVaults = {
            positive: null as Vault | null,
            negative: null as Vault | null,
            neutral: null as Vault | null
          }

          for (const [sentiment, _] of Object.entries(sentimentVaults)) {
            let vault = vaults.find(v => v.name.toLowerCase() === sentiment)
            if (!vault) {
              vault = await VaultService.createVault(
                sentiment.charAt(0).toUpperCase() + sentiment.slice(1),
                `Casts with ${sentiment} sentiment`,
                [],
                userId
              )
              vaults.push(vault)
            }
            sentimentVaults[sentiment as keyof typeof sentimentVaults] = vault
          }

          // Simple sentiment analysis
          const results = []
          const positiveWords = ['good', 'great', 'awesome', 'love', 'amazing', 'excellent', 'happy', 'gm', '🎉', '❤️', '🚀']
          const negativeWords = ['bad', 'hate', 'terrible', 'awful', 'angry', 'sad', 'disappointed', '😞', '😢', '😡']

          for (const cast of casts) {
            const content = cast.cast_content.toLowerCase()
            const positiveScore = positiveWords.filter(word => content.includes(word)).length
            const negativeScore = negativeWords.filter(word => content.includes(word)).length
            
            let sentiment: keyof typeof sentimentVaults = 'neutral'
            if (positiveScore > negativeScore) sentiment = 'positive'
            else if (negativeScore > positiveScore) sentiment = 'negative'

            const vault = sentimentVaults[sentiment]
            if (vault) {
              try {
                await VaultService.addCastToVault(cast.id, vault.id)
                results.push({ cast: cast.cast_hash, sentiment })
              } catch (error) {
                // Cast might already be in vault
              }
            }
          }

          // Refresh data in parent component
          onCastUpdate?.()

          return {
            success: true,
            organized: results.length,
            breakdown: {
              positive: results.filter(r => r.sentiment === 'positive').length,
              negative: results.filter(r => r.sentiment === 'negative').length,
              neutral: results.filter(r => r.sentiment === 'neutral').length
            },
            message: `Organized ${results.length} casts by sentiment`
          }
        }

        case 'get_first_saved_cast': {
          if (casts.length === 0) {
            return {
              success: false,
              message: 'You have no saved casts yet'
            }
          }

          // Sort by created_at to get the oldest
          const sortedCasts = [...casts].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
          
          const firstCast = sortedCasts[0]
          
          return {
            success: true,
            cast: {
              hash: firstCast.cast_hash,
              author: firstCast.username,
              content: firstCast.cast_content,
              saved_at: firstCast.created_at,
              timestamp: firstCast.cast_timestamp,
              url: firstCast.cast_url
            },
            message: `Your first saved cast was from @${firstCast.username} on ${new Date(firstCast.created_at).toLocaleDateString()}`
          }
        }

        case 'get_most_recent_cast': {
          if (casts.length === 0) {
            return {
              success: false,
              message: 'You have no saved casts yet'
            }
          }

          // Since casts are already ordered by cast_timestamp (newest first) from getUserCasts(),
          // the first cast is the most recent by original cast time
          const recentCast = casts[0]
          
          return {
            success: true,
            cast: {
              hash: recentCast.cast_hash,
              author: recentCast.username,
              content: recentCast.cast_content,
              saved_at: recentCast.created_at,
              timestamp: recentCast.cast_timestamp,
              url: recentCast.cast_url
            },
            message: `Your most recent cast was saved on ${new Date(recentCast.created_at).toLocaleDateString()}, and it was authored by **${recentCast.username}**. Here's a brief overview:

- **Content**: "${recentCast.cast_content}"
- **Timestamp**: ${new Date(recentCast.cast_timestamp).toLocaleDateString()}, ${new Date(recentCast.cast_timestamp).toLocaleTimeString()} UTC
- **URL**: [View Cast](${recentCast.cast_url})

If you need any further actions or details, let me know!`
          }
        }

        case 'read_cast_content': {
          const cast = casts.find(c => c.cast_hash === args.cast_hash)
          if (!cast) {
            return { success: false, message: `Cast with hash ${args.cast_hash} not found` }
          }

          // Parse the cast content using existing ContentParser
          const parsedData = ContentParser.parseContent(cast.cast_content)
          
          return {
            success: true,
            cast: {
              hash: cast.cast_hash,
              author: cast.username,
              display_name: cast.author_display_name,
              content: cast.cast_content,
              timestamp: cast.cast_timestamp,
              saved_at: cast.created_at,
              url: cast.cast_url,
              parsed: {
                word_count: parsedData.word_count,
                sentiment: parsedData.sentiment,
                topics: parsedData.topics,
                hashtags: parsedData.hashtags,
                mentions: parsedData.mentions,
                urls: parsedData.urls,
                key_phrases: ContentParser.extractKeyPhrases(cast.cast_content)
              }
            },
            message: `Read cast by @${cast.username} - ${parsedData.word_count} words, ${parsedData.sentiment} sentiment`
          }
        }

        case 'analyze_cast_for_vaults': {
          const cast = casts.find(c => c.cast_hash === args.cast_hash)
          if (!cast) {
            return { success: false, message: `Cast with hash ${args.cast_hash} not found` }
          }

          if (vaults.length === 0) {
            return { 
              success: false, 
              message: 'No vaults exist yet. Create some vaults first to organize casts into them.' 
            }
          }

          // Parse the cast content
          const parsedData = ContentParser.parseContent(cast.cast_content)
          const suggestions = []

          // Analyze against each vault
          for (const vault of vaults) {
            let score = 0
            const reasons = []

            // Check vault auto-add rules
            if (vault.auto_add_rules && vault.auto_add_rules.length > 0) {
              for (const rule of vault.auto_add_rules) {
                if (cast.cast_content.toLowerCase().includes(rule.toLowerCase())) {
                  score += 3
                  reasons.push(`Matches rule: "${rule}"`)
                }
              }
            }

            // Check if vault description relates to cast topics
            if (vault.description && parsedData.topics) {
              for (const topic of parsedData.topics) {
                if (vault.description.toLowerCase().includes(topic.toLowerCase()) ||
                    vault.name.toLowerCase().includes(topic.toLowerCase())) {
                  score += 2
                  reasons.push(`Topic match: "${topic}"`)
                }
              }
            }

            // Check hashtag relevance
            if (parsedData.hashtags && vault.description) {
              for (const hashtag of parsedData.hashtags) {
                if (vault.name.toLowerCase().includes(hashtag.toLowerCase()) ||
                    vault.description.toLowerCase().includes(hashtag.toLowerCase())) {
                  score += 1
                  reasons.push(`Hashtag relevance: #${hashtag}`)
                }
              }
            }

            if (score > 0) {
              suggestions.push({
                vault_name: vault.name,
                vault_description: vault.description,
                match_score: score,
                reasons: reasons
              })
            }
          }

          // Sort by score
          suggestions.sort((a, b) => b.match_score - a.match_score)

          return {
            success: true,
            cast_content: cast.cast_content.substring(0, 200) + (cast.cast_content.length > 200 ? '...' : ''),
            cast_topics: parsedData.topics,
            suggestions: suggestions.slice(0, 3), // Top 3 suggestions
            message: suggestions.length > 0 
              ? `Found ${suggestions.length} potential vault matches for this cast`
              : 'No vault matches found. This cast may need a new vault or manual categorization.'
          }
        }

        case 'get_vault_details': {
          const vault = vaults.find(v => v.name.toLowerCase() === args.vault_name.toLowerCase())
          if (!vault) {
            return { success: false, message: `Vault "${args.vault_name}" not found` }
          }

          // Get casts in this vault
          const vaultCasts = await VaultService.getVaultCasts(vault.id)
          
          // Analyze common themes in vault casts
          const allTopics = []
          const allHashtags = []
          const authors = new Set()
          const sentiments = { positive: 0, negative: 0, neutral: 0 }

          for (const cast of vaultCasts) {
            const parsed = ContentParser.parseContent(cast.cast_content)
            if (parsed.topics) {
              allTopics.push(...parsed.topics)
            }
            if (parsed.hashtags) {
              allHashtags.push(...parsed.hashtags)
            }
            authors.add(cast.username)
            if (parsed.sentiment) {
              sentiments[parsed.sentiment as keyof typeof sentiments]++
            }
          }

          // Count topic frequency
          const topicCounts = allTopics.reduce((acc, topic) => {
            acc[topic] = (acc[topic] || 0) + 1
            return acc
          }, {} as Record<string, number>)

          const topTopics = Object.entries(topicCounts)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([topic, count]) => ({ topic, count: count as number }))

          return {
            success: true,
            vault: {
              name: vault.name,
              description: vault.description,
              cast_count: vaultCasts.length,
              auto_add_rules: vault.auto_add_rules,
              created_at: vault.created_at
            },
            themes: {
              top_topics: topTopics,
              common_hashtags: [...new Set(allHashtags)].slice(0, 10),
              unique_authors: authors.size,
              sentiment_breakdown: sentiments
            },
            sample_casts: vaultCasts.slice(0, 3).map(c => ({
              author: c.username,
              content: c.cast_content.substring(0, 100) + '...',
              timestamp: c.cast_timestamp
            })),
            message: `Vault "${vault.name}" contains ${vaultCasts.length} casts with themes: ${topTopics.map(t => t.topic).join(', ')}`
          }
        }

        case 'smart_organize_single_cast': {
          const cast = casts.find(c => c.cast_hash === args.cast_hash)
          if (!cast) {
            return { success: false, message: `Cast with hash ${args.cast_hash} not found` }
          }

          if (vaults.length === 0) {
            return { 
              success: false, 
              message: 'No vaults exist. Create vaults first or use the general organize function to create default vaults.' 
            }
          }

          // Analyze cast directly instead of recursive call
          const parsedData = ContentParser.parseContent(cast.cast_content)
          const suggestions = []

          // Analyze against each vault
          for (const vault of vaults) {
            let score = 0
            const reasons = []

            // Check vault auto-add rules
            if (vault.auto_add_rules && vault.auto_add_rules.length > 0) {
              for (const rule of vault.auto_add_rules) {
                if (cast.cast_content.toLowerCase().includes(rule.toLowerCase())) {
                  score += 3
                  reasons.push(`Matches rule: "${rule}"`)
                }
              }
            }

            // Check if vault description relates to cast topics
            if (vault.description && parsedData.topics) {
              for (const topic of parsedData.topics) {
                if (vault.description.toLowerCase().includes(topic.toLowerCase()) ||
                    vault.name.toLowerCase().includes(topic.toLowerCase())) {
                  score += 2
                  reasons.push(`Topic match: "${topic}"`)
                }
              }
            }

            // Check hashtag relevance
            if (parsedData.hashtags && vault.description) {
              for (const hashtag of parsedData.hashtags) {
                if (vault.name.toLowerCase().includes(hashtag.toLowerCase()) ||
                    vault.description.toLowerCase().includes(hashtag.toLowerCase())) {
                  score += 1
                  reasons.push(`Hashtag relevance: #${hashtag}`)
                }
              }
            }

            if (score > 0) {
              suggestions.push({
                vault_name: vault.name,
                vault_description: vault.description,
                match_score: score,
                reasons: reasons
              })
            }
          }

          // Sort by score
          suggestions.sort((a, b) => b.match_score - a.match_score)

          if (suggestions.length === 0) {
            return {
              success: false,
              message: 'Could not find a suitable vault for this cast. Consider creating a new vault or manual categorization.',
              cast_content: cast.cast_content.substring(0, 200) + '...'
            }
          }

          // Use the highest scoring suggestion
          const bestMatch = suggestions[0]
          const vault = vaults.find(v => v.name === bestMatch.vault_name)
          
          if (!vault) {
            return { success: false, message: 'Best matching vault not found' }
          }

          // Check if cast is already in this vault
          const isAlreadyInVault = await VaultService.isCastInVault(cast.id, vault.id)
          if (isAlreadyInVault) {
            return {
              success: true,
              already_organized: true,
              message: `Cast is already in vault "${vault.name}"`
            }
          }

          // Add cast to the vault
          await VaultService.addCastToVault(cast.id, vault.id)
          
          // Refresh data in parent component
          onCastUpdate?.()

          return {
            success: true,
            organized: true,
            vault_name: vault.name,
            match_score: bestMatch.match_score,
            reasons: bestMatch.reasons,
            message: `Successfully added cast to "${vault.name}" (score: ${bestMatch.match_score})`
          }
        }

        case 'analyze_all_casts_content': {
          const limit = args.limit || casts.length
          const castsToAnalyze = casts.slice(0, limit)
          
          if (castsToAnalyze.length === 0) {
            return { success: false, message: 'No casts to analyze' }
          }

          // Analyze all casts for themes
          const allTopics = []
          const topicsByAuthor = new Map()
          const hashtagCounts = new Map()
          const mentionCounts = new Map()
          const sentiments = { positive: 0, negative: 0, neutral: 0 }
          const urlDomains = new Map()

          for (const cast of castsToAnalyze) {
            const parsed = ContentParser.parseContent(cast.cast_content)
            
            // Collect topics
            if (parsed.topics) {
              allTopics.push(...parsed.topics)
            }
            
            // Topics by author
            if (!topicsByAuthor.has(cast.username)) {
              topicsByAuthor.set(cast.username, new Set())
            }
            if (parsed.topics) {
              parsed.topics.forEach(topic => topicsByAuthor.get(cast.username)!.add(topic))
            }
            
            // Count hashtags and mentions
            if (parsed.hashtags) {
              parsed.hashtags.forEach(tag => {
                hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1)
              })
            }
            if (parsed.mentions) {
              parsed.mentions.forEach(mention => {
                mentionCounts.set(mention, (mentionCounts.get(mention) || 0) + 1)
              })
            }
            
            // Sentiment
            if (parsed.sentiment) {
              sentiments[parsed.sentiment as keyof typeof sentiments]++
            }
            
            // URL domains
            if (parsed.urls) {
              parsed.urls.forEach(url => {
                try {
                  const domain = new URL(url).hostname
                  urlDomains.set(domain, (urlDomains.get(domain) || 0) + 1)
                } catch (e) {
                  // Invalid URL, skip
                }
              })
            }
          }

          // Calculate topic frequency
          const topicCounts = allTopics.reduce((acc, topic) => {
            acc[topic] = (acc[topic] || 0) + 1
            return acc
          }, {} as Record<string, number>)

          const topTopics = Object.entries(topicCounts)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 10)
            .map(([topic, count]) => ({ topic, count: count as number, percentage: Math.round((count as number) / castsToAnalyze.length * 100) }))

          // Suggest vault categories based on analysis
          const suggestedVaults = []
          if (topicCounts['crypto'] > 2) suggestedVaults.push({ name: 'Crypto & Web3', description: 'Cryptocurrency and blockchain related content' })
          if (topicCounts['ai'] > 2) suggestedVaults.push({ name: 'AI & Tech', description: 'Artificial intelligence and technology discussions' })
          if (topicCounts['development'] > 2) suggestedVaults.push({ name: 'Development', description: 'Programming and software development' })
          if (sentiments.positive > castsToAnalyze.length * 0.6) suggestedVaults.push({ name: 'Positive Vibes', description: 'Uplifting and positive content' })

          return {
            success: true,
            analysis: {
              total_analyzed: castsToAnalyze.length,
              top_topics: topTopics,
              top_hashtags: Array.from(hashtagCounts.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([tag, count]) => ({ hashtag: tag, count })),
              top_mentions: Array.from(mentionCounts.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([mention, count]) => ({ mention, count })),
              sentiment_breakdown: {
                positive: sentiments.positive,
                negative: sentiments.negative,
                neutral: sentiments.neutral,
                positive_percentage: Math.round(sentiments.positive / castsToAnalyze.length * 100)
              },
              top_domains: Array.from(urlDomains.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([domain, count]) => ({ domain, count }))
            },
            suggested_vaults: suggestedVaults,
            message: `Analyzed ${castsToAnalyze.length} casts. Top themes: ${topTopics.slice(0, 3).map(t => t.topic).join(', ')}`
          }
        }

        default:
          return { success: false, message: `Unknown function: ${name}` }
      }
    } catch (error) {
      console.error(`Error executing function ${name}:`, error)
      return { 
        success: false, 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Create context about current state
      const context = {
        vault_count: vaults.length,
        cast_count: casts.length,
        vault_names: vaults.map(v => v.name),
        recent_casts: casts.slice(0, 5).map(c => ({
          author: c.username,
          preview: c.cast_content.substring(0, 50)
        }))
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a helpful AI assistant for CastKPR, a Farcaster cast management system. 
              
              Current context:
              - User has ${context.vault_count} vaults: ${context.vault_names.join(', ') || 'none'}
              - User has ${context.cast_count} saved casts
              
              You can help users:
              1. List and manage vaults
              2. Organize casts into vaults automatically
              3. Analyze patterns in saved casts
              4. Search for specific casts
              5. Create new vaults with rules
              6. Organize casts by sentiment or topic
              
              Always be helpful and suggest next actions. When organizing casts, provide clear summaries of what was done.
              Format your responses with clear sections and bullet points when listing items.`
            },
            ...messages.slice(-10), // Include last 10 messages for context
            userMessage
          ],
          functions,
          userId
        })
      })

      const data = await response.json()

      // Handle function calls
      if (data.function_call) {
        const functionResult = await executeFunction(
          data.function_call.name,
          data.function_call.arguments
        )

        // Send function result back to get final response
        const finalResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              ...messages.slice(-5),
              userMessage,
              {
                role: 'assistant',
                content: data.content || '',
                function_call: data.function_call
              },
              {
                role: 'function',
                name: data.function_call.name,
                content: JSON.stringify(functionResult)
              }
            ],
            userId
          })
        })

        const finalData = await finalResponse.json()
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: finalData.content || finalData.message || 'Operation completed',
          timestamp: new Date()
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.content || data.message || 'I understand. How can I help you organize your casts?',
          timestamp: new Date()
        }])
      }

      // Reload data after operations
      const [updatedVaults, updatedCasts] = await Promise.all([
        VaultService.getUserVaults(userId),
        CastService.getUserCasts(userId, 100)
      ])
      setVaults(updatedVaults)
      setCasts(updatedCasts)
      
      // Notify parent component to refresh its data too
      onCastUpdate?.()

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white">AI Assistant</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="animate-pulse flex gap-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to organize your casts..."
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}