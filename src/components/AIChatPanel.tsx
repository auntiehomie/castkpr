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

  // Natural language parsing helper
  const parseVaultFromMessage = (message: string): { name?: string; description?: string } => {
    const lowerMessage = message.toLowerCase()
    
    // Patterns to extract vault name
    const patterns = [
      /create.*vault.*(?:named|called)\s+"([^"]+)"/i,
      /create.*vault.*(?:named|called)\s+([a-zA-Z0-9\s&]+?)(?:\s+(?:for|with|about))/i,
      /create.*vault.*(?:named|called)\s+([a-zA-Z0-9\s&]+?)$/i,
      /vault.*(?:named|called)\s+"([^"]+)"/i,
      /vault.*(?:named|called)\s+([a-zA-Z0-9\s&]+?)(?:\s+(?:for|with|about))/i,
      /vault.*(?:named|called)\s+([a-zA-Z0-9\s&]+?)$/i,
      /"([^"]+)"\s*vault/i,
      /create\s+"([^"]+)"/i
    ]
    
    let extractedName = ''
    let extractedDescription = ''
    
    // Try to extract name using patterns
    for (const pattern of patterns) {
      const match = message.match(pattern)
      if (match && match[1]) {
        extractedName = match[1].trim()
        break
      }
    }
    
    // Try to extract description
    const descPatterns = [
      /(?:for|about|containing|with)\s+([a-zA-Z0-9\s,&-]+?)(?:\.|$)/i,
      /vault.*(?:for|about)\s+([a-zA-Z0-9\s,&-]+?)(?:\.|$)/i
    ]
    
    for (const pattern of descPatterns) {
      const match = message.match(pattern)
      if (match && match[1]) {
        extractedDescription = match[1].trim()
        break
      }
    }
    
    console.log('🔍 Natural language parsing results:', { 
      message: message.substring(0, 100), 
      extractedName, 
      extractedDescription 
    })
    
    return {
      name: extractedName || undefined,
      description: extractedDescription || undefined
    }
  }

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
      description: 'List all vaults for the user with creation dates and sorting options',
      parameters: {
        type: 'object',
        properties: {
          sort_by: { 
            type: 'string', 
            enum: ['name', 'created_at', 'updated_at', 'cast_count'], 
            description: 'How to sort the vaults (default: created_at)' 
          },
          order: { 
            type: 'string', 
            enum: ['asc', 'desc'], 
            description: 'Sort order (default: desc for newest first)' 
          }
        },
        required: []
      }
    },
    {
      name: 'find_vaults_by_age',
      description: 'Find vaults by their age or creation date. Useful for finding recently created vaults or old duplicates.',
      parameters: {
        type: 'object',
        properties: {
          max_age_days: { type: 'number', description: 'Find vaults newer than this many days old' },
          min_age_days: { type: 'number', description: 'Find vaults older than this many days old' },
          created_after: { type: 'string', description: 'Find vaults created after this date (YYYY-MM-DD)' },
          created_before: { type: 'string', description: 'Find vaults created before this date (YYYY-MM-DD)' },
          name_pattern: { type: 'string', description: 'Optional: filter by vault name pattern (for finding duplicates)' }
        }
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
      name: 'search_casts_by_content',
      description: 'Search through all saved casts for specific words or phrases mentioned by the user',
      parameters: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: 'The word, phrase, or topic to search for in cast content' 
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Whether the search should be case sensitive (default: false)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'smart_cast_search',
      description: 'Intelligently search for casts based on natural language queries from the user',
      parameters: {
        type: 'object',
        properties: {
          user_query: { 
            type: 'string', 
            description: 'The user\'s natural language search query' 
          }
        },
        required: ['user_query']
      }
    },
    {
      name: 'analyze_cast_topics',
      description: 'Analyze the topics and themes in a specific cast or the most recent cast',
      parameters: {
        type: 'object',
        properties: {
          cast_hash: { 
            type: 'string', 
            description: 'Optional: Hash of specific cast to analyze. If not provided, analyzes the most recent cast' 
          }
        }
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
      name: 'find_casts_by_topic',
      description: 'Find all saved casts that contain specific words, topics, or keywords mentioned by the user',
      parameters: {
        type: 'object',
        properties: {
          keywords: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'Any words or phrases to search for (e.g., ["crypto", "bitcoin"], ["AI", "machine learning"], ["pizza", "food"])' 
          }
        },
        required: ['keywords']
      }
    },
    {
      name: 'debug_cast_analysis',
      description: 'Debug function to show what topics and keywords the AI can detect in your saved casts',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of casts to analyze (default: 10)' }
        }
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
    },
    {
      name: 'add_topic_casts_to_vault',
      description: 'Find casts that match a specific topic (like crypto, AI, etc.) and add them to the specified vault. This function combines searching and adding in one step.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic to search for (e.g., "crypto", "AI", "tech")' },
          vault_name: { type: 'string', description: 'Name of the vault to add matching casts to' },
          create_vault_if_missing: { type: 'boolean', description: 'Whether to create the vault if it doesn\'t exist (default: true)' }
        },
        required: ['topic', 'vault_name']
      }
    },
    {
      name: 'request_vault_deletion',
      description: 'Handle vault deletion requests. Call with vault_name for initial request, or with confirmation=true when user says "I want the vault deleted"',
      parameters: {
        type: 'object',
        properties: {
          vault_name: { type: 'string', description: 'Name of the vault to delete (required for initial request)' },
          confirmation: { type: 'boolean', description: 'Set to true ONLY when user says exactly "I want the vault deleted" or very similar confirmation phrase' },
          user_message: { type: 'string', description: 'The exact user message (for confirmation detection)' }
        }
      }
    },
    {
      name: 'bulk_delete_vaults',
      description: 'Delete multiple vaults at once. Use when user wants to delete several specific vaults or all vaults.',
      parameters: {
        type: 'object',
        properties: {
          vault_names: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Array of vault names to delete. Use ["ALL"] to delete all vaults.' 
          },
          confirmation: { type: 'boolean', description: 'Set to true when user confirms bulk deletion with "I want all the vaults deleted" or similar' },
          user_message: { type: 'string', description: 'The exact user message (for confirmation detection)' }
        },
        required: ['vault_names']
      }
    },
    {
      name: 'bulk_delete_casts',
      description: 'Delete multiple saved casts at once. Use when user wants to delete several casts or all their saved casts.',
      parameters: {
        type: 'object',
        properties: {
          cast_ids: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Array of cast IDs to delete. Use ["ALL"] to delete all casts for the user.' 
          },
          confirmation: { type: 'boolean', description: 'Set to true when user confirms bulk deletion with "I want all the casts deleted" or similar' },
          user_message: { type: 'string', description: 'The exact user message (for confirmation detection)' }
        },
        required: ['cast_ids']
      }
    },
    {
      name: 'delete_cast',
      description: 'Delete a single saved cast. Use when user wants to delete a specific cast.',
      parameters: {
        type: 'object',
        properties: {
          cast_id: { type: 'string', description: 'ID of the cast to delete' },
          confirmation: { type: 'boolean', description: 'Set to true when user confirms deletion' },
          user_message: { type: 'string', description: 'The exact user message' }
        },
        required: ['cast_id']
      }
    }
  ]

  // Function implementations
  const executeFunction = async (name: string, args: any) => {
    try {
      // Debug: Log the raw arguments to understand the format
      console.log('🔧 executeFunction called with:', { name, args, argsType: typeof args })
      
      // Parse arguments if they come as a JSON string
      let parsedArgs = args
      if (typeof args === 'string') {
        try {
          parsedArgs = JSON.parse(args)
          console.log('📝 Parsed JSON string args:', parsedArgs)
        } catch (parseError) {
          console.error('❌ Failed to parse args as JSON:', parseError)
          console.log('Raw args string:', args)
        }
      }
      
      console.log('✅ Final args for processing:', parsedArgs)
      
      switch (name) {
        case 'list_vaults': {
          const { sort_by = 'created_at', order = 'desc' } = args
          const vaults = await VaultService.getUserVaults(userId)
          const vaultList = vaults.map((v: Vault) => ({
            name: v.name,
            description: v.description,
            cast_count: v.cast_count || 0,
            rules: v.auto_add_rules,
            created_at: v.created_at,
            updated_at: v.updated_at,
            age_days: Math.floor((new Date().getTime() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24))
          }))
          
          // Sort based on parameters
          vaultList.sort((a, b) => {
            let comparison = 0
            switch (sort_by) {
              case 'name':
                comparison = a.name.localeCompare(b.name)
                break
              case 'cast_count':
                comparison = a.cast_count - b.cast_count
                break
              case 'updated_at':
                comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
                break
              case 'created_at':
              default:
                comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                break
            }
            return order === 'desc' ? -comparison : comparison
          })
          
          return {
            success: true,
            vaults: vaultList,
            total: vaults.length,
            sorting: { sort_by, order },
            message: vaults.length > 0 
              ? `You have ${vaults.length} vault${vaults.length !== 1 ? 's' : ''}, sorted by ${sort_by} (${order}). ${vaultList.length > 0 ? `${order === 'desc' ? 'Newest' : 'Oldest'} vault: "${vaultList[0].name}" created ${vaultList[0].age_days} days ago.` : ''}` 
              : 'You have no vaults yet. Would you like me to create some based on your saved casts?'
          }
        }

        case 'find_vaults_by_age': {
          const { max_age_days, min_age_days, created_after, created_before, name_pattern } = args
          const vaults = await VaultService.getUserVaults(userId)
          
          let filteredVaults = vaults.filter(v => {
            const createdDate = new Date(v.created_at)
            const ageDays = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
            
            // Check age constraints
            if (max_age_days !== undefined && ageDays > max_age_days) return false
            if (min_age_days !== undefined && ageDays < min_age_days) return false
            
            // Check date constraints
            if (created_after && createdDate < new Date(created_after)) return false
            if (created_before && createdDate > new Date(created_before)) return false
            
            // Check name pattern
            if (name_pattern && !v.name.toLowerCase().includes(name_pattern.toLowerCase())) return false
            
            return true
          })
          
          const vaultList = filteredVaults.map((v: Vault) => ({
            name: v.name,
            description: v.description,
            cast_count: v.cast_count || 0,
            created_at: v.created_at,
            updated_at: v.updated_at,
            age_days: Math.floor((new Date().getTime() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24)),
            created_date_friendly: new Date(v.created_at).toLocaleDateString()
          }))
          
          // Sort by creation date (newest first)
          vaultList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          
          // Build filter summary for the message
          const filters = []
          if (max_age_days !== undefined) filters.push(`newer than ${max_age_days} days`)
          if (min_age_days !== undefined) filters.push(`older than ${min_age_days} days`)
          if (created_after) filters.push(`created after ${created_after}`)
          if (created_before) filters.push(`created before ${created_before}`)
          if (name_pattern) filters.push(`name contains "${name_pattern}"`)
          
          const filterSummary = filters.length > 0 ? ` (filtered by: ${filters.join(', ')})` : ''
          
          return {
            success: true,
            vaults: vaultList,
            total_found: vaultList.length,
            total_all_vaults: vaults.length,
            filters_applied: {
              max_age_days,
              min_age_days,
              created_after,
              created_before,
              name_pattern
            },
            message: vaultList.length > 0 
              ? `Found ${vaultList.length} vault${vaultList.length !== 1 ? 's' : ''}${filterSummary}. ${vaultList.length > 0 ? `Newest match: "${vaultList[0].name}" (${vaultList[0].age_days} days old).` : ''}` 
              : `No vaults found matching the specified criteria${filterSummary}.`
          }
        }

        case 'create_vault': {
          try {
            console.log('🏗️ Raw create_vault args:', parsedArgs)
            console.log('🏗️ Args type:', typeof parsedArgs)
            console.log('🏗️ Args keys:', Object.keys(parsedArgs))
            console.log('🏗️ Full args object:', JSON.stringify(parsedArgs, null, 2))
            
            // Extract and validate parameters with robust handling
            let vaultName: string = ''
            let vaultDescription: string = ''
            let vaultRules: string[] = []
            
            // Method 1: Direct property access
            if (parsedArgs.name && typeof parsedArgs.name === 'string') {
              vaultName = parsedArgs.name
            }
            if (parsedArgs.description && typeof parsedArgs.description === 'string') {
              vaultDescription = parsedArgs.description
            }
            
            // Method 2: Handle object properties 
            if (typeof parsedArgs.name === 'object' && parsedArgs.name !== null) {
              const nameObj = parsedArgs.name as any
              vaultName = nameObj.name || nameObj.value || String(nameObj)
            }
            if (typeof parsedArgs.description === 'object' && parsedArgs.description !== null) {
              const descObj = parsedArgs.description as any
              vaultDescription = descObj.description || descObj.value || String(descObj)
            }
            
            // Method 3: Try to extract from the raw args object directly
            if (!vaultName && parsedArgs) {
              // Look for any property that might contain the name
              const possibleNames = [parsedArgs.name, parsedArgs.vault_name, parsedArgs.vaultName, parsedArgs.title]
              for (const possible of possibleNames) {
                if (possible && typeof possible === 'string' && possible.trim()) {
                  vaultName = possible.trim()
                  break
                }
              }
            }
            
            // Method 4: Fallback - try to parse from any string values in args
            if (!vaultName) {
              const allValues = Object.values(parsedArgs).filter(v => typeof v === 'string' && v.trim())
              if (allValues.length > 0) {
                vaultName = allValues[0] as string
                if (allValues.length > 1) {
                  vaultDescription = allValues[1] as string
                }
              }
            }
            
            // Handle rules array
            if (Array.isArray(parsedArgs.rules)) {
              vaultRules = parsedArgs.rules.map((rule: any) => String(rule))
            } else if (parsedArgs.rules) {
              vaultRules = [String(parsedArgs.rules)]
            }
            
            console.log('🏗️ Processed params:', { vaultName, vaultDescription, vaultRules })
            
            // Final validation with helpful error
            if (!vaultName.trim()) {
              console.log('🔍 Attempting natural language parsing from user message...')
              
              // Get the last user message for natural language parsing
              const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || ''
              const parsed = parseVaultFromMessage(lastUserMessage)
              
              if (parsed.name) {
                vaultName = parsed.name
                if (parsed.description && !vaultDescription.trim()) {
                  vaultDescription = parsed.description
                }
                console.log('✅ Extracted from natural language:', { vaultName, vaultDescription })
              }
            }
            
            if (!vaultName.trim()) {
              console.error('❌ Could not extract vault name from args:', parsedArgs)
              throw new Error('Could not determine vault name from the request. Please try: "Create a vault named [Name]" or "Create a vault called [Name]"')
            }
            
            const vault = await VaultService.createVault(
              vaultName.trim(),
              vaultDescription.trim(),
              vaultRules,
              userId,
              false // isPublic default to false
            )
            
            // Update local state
            const updatedVaults = await VaultService.getUserVaults(userId)
            setVaults(updatedVaults)
            
            // Refresh data in parent component
            onCastUpdate?.()
            
            return {
              success: true,
              vault: vault,
              message: `Created vault "${vaultName}" successfully!`
            }
          } catch (error) {
            console.error('Error creating vault:', error)
            return {
              success: false,
              message: `Failed to create vault: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
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

          console.log(`🏗️ Organizing ${castsToOrganize.length} casts into ${vaults.length} existing vaults`)

          // Create default vaults if none exist
          if (vaults.length === 0) {
            const defaultVaults = [
              { name: 'Crypto & Web3', description: 'Cryptocurrency, blockchain, DeFi, and Web3 content', rules: ['crypto', 'bitcoin', 'ethereum', 'defi', 'blockchain', 'web3', 'nft', 'dao', 'token'] },
              { name: 'Tech & Development', description: 'Programming, AI, and technical discussions', rules: ['programming', 'code', 'ai', 'tech', 'development', 'software', 'github', 'api'] },
              { name: 'Social & Community', description: 'Social interactions and community content', rules: ['gm', 'community', 'social', 'friends', 'hello', 'thanks', 'farcaster'] },
              { name: 'Finance & Trading', description: 'Financial markets, trading, and investment content', rules: ['trading', 'investment', 'finance', 'money', 'market', 'price', 'pump', 'yield'] }
            ]

            for (const v of defaultVaults) {
              const newVault = await VaultService.createVault(v.name, v.description, v.rules, userId)
              vaults.push(newVault)
            }
            console.log(`✅ Created ${defaultVaults.length} default vaults`)
          }

          // Organize casts into vaults using enhanced analysis
          for (const cast of castsToOrganize) {
            // Parse the cast content for topics, hashtags, etc.
            const parsedData = ContentParser.parseContent(cast.cast_content)
            const content = cast.cast_content.toLowerCase()
            let bestVault = null
            let bestScore = 0

            for (const vault of vaults) {
              let score = 0
              
              // Check vault auto-add rules
              const rules = vault.auto_add_rules || []
              for (const rule of rules) {
                if (content.includes(rule.toLowerCase())) {
                  score += 3 // High weight for explicit rules
                }
              }

              // Check parsed topics against vault name and description
              if (parsedData.topics) {
                for (const topic of parsedData.topics) {
                  if (vault.name.toLowerCase().includes(topic.toLowerCase())) {
                    score += 2
                  }
                  if (vault.description?.toLowerCase().includes(topic.toLowerCase())) {
                    score += 1
                  }
                }
              }

              // Check hashtags
              if (parsedData.hashtags) {
                for (const hashtag of parsedData.hashtags) {
                  if (vault.name.toLowerCase().includes(hashtag.toLowerCase())) {
                    score += 1
                  }
                }
              }

              // Special crypto detection
              const cryptoKeywords = ['bitcoin', 'ethereum', 'crypto', 'defi', 'nft', 'dao', 'token', 'coin', 'blockchain', 'web3']
              if (vault.name.toLowerCase().includes('crypto') || vault.name.toLowerCase().includes('web3')) {
                const hasCrypto = cryptoKeywords.some(keyword => content.includes(keyword))
                if (hasCrypto) score += 2
              }

              // Special tech detection
              const techKeywords = ['code', 'programming', 'development', 'ai', 'tech', 'software', 'api', 'github']
              if (vault.name.toLowerCase().includes('tech') || vault.name.toLowerCase().includes('dev')) {
                const hasTech = techKeywords.some(keyword => content.includes(keyword))
                if (hasTech) score += 2
              }

              if (score > bestScore) {
                bestScore = score
                bestVault = vault
              }
            }

            // Only add to vault if we have a reasonable confidence score
            if (bestVault && bestScore >= 1) {
              try {
                // Check if cast is already in this vault
                const isAlreadyInVault = await VaultService.isCastInVault(cast.id, bestVault.id)
                if (!isAlreadyInVault) {
                  await VaultService.addCastToVault(cast.id, bestVault.id)
                  results.push({ 
                    cast: cast.cast_hash, 
                    vault: bestVault.name,
                    score: bestScore,
                    content_preview: cast.cast_content.substring(0, 50) + '...'
                  })
                  console.log(`✅ Added cast to ${bestVault.name} (score: ${bestScore})`)
                }
              } catch (error) {
                console.error('Error adding cast to vault:', error)
              }
            } else {
              console.log(`❌ No suitable vault found for cast: ${cast.cast_content.substring(0, 50)}...`)
            }
          }

          // Refresh data in parent component
          onCastUpdate?.()

          return {
            success: true,
            organized: results.length,
            total_analyzed: castsToOrganize.length,
            results: results,
            message: `Organized ${results.length} out of ${castsToOrganize.length} casts into vaults. ${castsToOrganize.length - results.length} casts didn't match any vault criteria.`
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

        case 'search_casts_by_content': {
          const query = args.query
          const caseSensitive = args.case_sensitive || false
          const searchTerm = caseSensitive ? query : query.toLowerCase()
          const matchingCasts = []

          console.log(`🔍 Searching ${casts.length} casts for: "${query}" (case sensitive: ${caseSensitive})`)

          for (const cast of casts) {
            const contentToSearch = caseSensitive ? cast.cast_content : cast.cast_content.toLowerCase()
            const usernameToSearch = caseSensitive ? cast.username : cast.username.toLowerCase()
            const tagsToSearch = caseSensitive 
              ? cast.tags.join(' ')
              : cast.tags.map(t => t.toLowerCase()).join(' ')

            // Check if the search term appears in content, username, or tags
            if (contentToSearch.includes(searchTerm) || 
                usernameToSearch.includes(searchTerm) || 
                tagsToSearch.includes(searchTerm)) {
              
              // Find where the match occurred and extract context
              let matchContext = ''
              let matchType = ''
              
              if (contentToSearch.includes(searchTerm)) {
                matchType = 'content'
                const index = contentToSearch.indexOf(searchTerm)
                const start = Math.max(0, index - 30)
                const end = Math.min(cast.cast_content.length, index + searchTerm.length + 30)
                matchContext = '...' + cast.cast_content.substring(start, end) + '...'
              } else if (usernameToSearch.includes(searchTerm)) {
                matchType = 'author'
                matchContext = `Author: @${cast.username}`
              } else if (tagsToSearch.includes(searchTerm)) {
                matchType = 'tags'
                matchContext = `Tags: ${cast.tags.join(', ')}`
              }

              matchingCasts.push({
                hash: cast.cast_hash,
                author: cast.username,
                content: cast.cast_content,
                content_preview: cast.cast_content.substring(0, 150) + (cast.cast_content.length > 150 ? '...' : ''),
                match_type: matchType,
                match_context: matchContext,
                timestamp: cast.cast_timestamp,
                saved_at: cast.created_at,
                url: cast.cast_url,
                tags: cast.tags
              })
            }
          }

          console.log(`📊 Found ${matchingCasts.length} matching casts`)

          return {
            success: true,
            search_query: query,
            case_sensitive: caseSensitive,
            total_searched: casts.length,
            found: matchingCasts.length,
            matches: matchingCasts.slice(0, 10), // Show top 10 matches
            all_matches_count: matchingCasts.length,
            message: matchingCasts.length > 0 
              ? `Found ${matchingCasts.length} casts containing "${query}"`
              : `No casts found containing "${query}". Try different keywords or check spelling.`
          }
        }

        case 'smart_cast_search': {
          const userQuery = args.user_query.toLowerCase()
          
          // Extract potential keywords from the user's natural language query
          const stopWords = new Set(['find', 'show', 'me', 'get', 'search', 'for', 'about', 'with', 'containing', 'that', 'have', 'posts', 'casts', 'any', 'all', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'from'])
          
          const potentialKeywords = userQuery
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter((word: string) => word.length > 2 && !stopWords.has(word))
          
          console.log(`🧠 Smart search interpreting: "${args.user_query}"`)
          console.log(`🔑 Extracted keywords:`, potentialKeywords)

          const matchingCasts = []

          // Search through all casts
          for (const cast of casts) {
            const content = cast.cast_content.toLowerCase()
            const username = cast.username.toLowerCase()
            const tags = cast.tags?.map(t => t.toLowerCase()) || []
            
            let relevanceScore = 0
            const matchedKeywords = []
            const matchDetails = []

            // Check each potential keyword
            for (const keyword of potentialKeywords) {
              if (content.includes(keyword)) {
                relevanceScore += 2
                matchedKeywords.push(keyword)
                matchDetails.push(`Content matches: "${keyword}"`)
              }
              if (username.includes(keyword)) {
                relevanceScore += 1
                matchedKeywords.push(keyword)
                matchDetails.push(`Author matches: "${keyword}"`)
              }
              if (tags.some(tag => tag.includes(keyword))) {
                relevanceScore += 1
                matchedKeywords.push(keyword)
                matchDetails.push(`Tag matches: "${keyword}"`)
              }
            }

            // Also check if the entire query appears anywhere
            if (content.includes(userQuery) || username.includes(userQuery)) {
              relevanceScore += 3
              matchDetails.push(`Exact phrase match: "${args.user_query}"`)
            }

            if (relevanceScore > 0) {
              matchingCasts.push({
                hash: cast.cast_hash,
                author: cast.username,
                content: cast.cast_content,
                content_preview: cast.cast_content.substring(0, 150) + (cast.cast_content.length > 150 ? '...' : ''),
                relevance_score: relevanceScore,
                matched_keywords: [...new Set(matchedKeywords)],
                match_details: matchDetails,
                timestamp: cast.cast_timestamp,
                saved_at: cast.created_at,
                url: cast.cast_url,
                tags: cast.tags
              })
            }
          }

          // Sort by relevance score (highest first)
          matchingCasts.sort((a, b) => b.relevance_score - a.relevance_score)

          console.log(`📊 Smart search found ${matchingCasts.length} relevant casts`)

          return {
            success: true,
            original_query: args.user_query,
            interpreted_keywords: potentialKeywords,
            total_searched: casts.length,
            found: matchingCasts.length,
            results: matchingCasts.slice(0, 10), // Top 10 most relevant
            message: matchingCasts.length > 0 
              ? `Found ${matchingCasts.length} casts relevant to "${args.user_query}". Showing top ${Math.min(10, matchingCasts.length)} results.`
              : `No casts found matching "${args.user_query}". Try different keywords or phrases.`
          }
        }

        case 'analyze_cast_topics': {
          // Use the most recent cast if no specific hash is provided
          const targetCast = args.cast_hash 
            ? casts.find(c => c.cast_hash === args.cast_hash)
            : casts[0] // Most recent cast

          if (!targetCast) {
            return {
              success: false,
              message: args.cast_hash 
                ? `Cast with hash ${args.cast_hash} not found`
                : 'No casts found'
            }
          }

          // Perform comprehensive analysis
          const parsedData = ContentParser.parseContent(targetCast.cast_content)
          const keyPhrases = ContentParser.extractKeyPhrases(targetCast.cast_content, 8)
          
          // Additional analysis for better topic detection
          const content = targetCast.cast_content.toLowerCase()
          const additionalTopics = []
          
          // Enhanced crypto detection
          if (content.includes('crypto') || content.includes('bitcoin') || content.includes('ethereum') || 
              content.includes('defi') || content.includes('blockchain') || content.includes('web3') ||
              content.includes('nft') || content.includes('token')) {
            additionalTopics.push('cryptocurrency')
          }
          
          // Enhanced tech detection  
          if (content.includes('ai') || content.includes('artificial intelligence') || content.includes('machine learning') ||
              content.includes('programming') || content.includes('code') || content.includes('development')) {
            additionalTopics.push('technology')
          }
          
          // Financial topics
          if (content.includes('pay') || content.includes('rent') || content.includes('money') || 
              content.includes('finance') || content.includes('investment') || content.includes('trading')) {
            additionalTopics.push('finance')
          }
          
          // Combine detected topics
          const allTopics = [...new Set([...(parsedData.topics || []), ...additionalTopics])]
          
          // Determine primary topic
          let primaryTopic = 'General Discussion'
          if (allTopics.length > 0) {
            // Prioritize certain topics
            if (allTopics.includes('cryptocurrency') || allTopics.includes('crypto')) {
              primaryTopic = 'Cryptocurrency & Web3'
            } else if (allTopics.includes('technology') || allTopics.includes('tech')) {
              primaryTopic = 'Technology & Development'
            } else if (allTopics.includes('finance')) {
              primaryTopic = 'Finance & Economics'
            } else {
              primaryTopic = allTopics[0].charAt(0).toUpperCase() + allTopics[0].slice(1)
            }
          }

          // Generate topic summary
          const topicAnalysis = []
          if (content.includes('ethereum') && content.includes('rent')) {
            topicAnalysis.push('This cast discusses using Ethereum for real-world payments, specifically rent payments')
          }
          if (content.includes('argentina')) {
            topicAnalysis.push('Mentions experiences in Argentina')
          }
          if (content.includes('national id') || content.includes('document')) {
            topicAnalysis.push('Discusses documentation/identity challenges')
          }
          
          return {
            success: true,
            cast: {
              hash: targetCast.cast_hash,
              author: targetCast.username,
              content_preview: targetCast.cast_content.substring(0, 150) + '...'
            },
            analysis: {
              primary_topic: primaryTopic,
              all_topics: allTopics,
              key_phrases: keyPhrases,
              sentiment: parsedData.sentiment,
              word_count: parsedData.word_count,
              hashtags: parsedData.hashtags || [],
              mentions: parsedData.mentions || [],
              topic_analysis: topicAnalysis,
              confidence: allTopics.length > 0 ? 'High' : 'Low'
            },
            message: `**Topic Analysis Complete**

**Primary Topic**: ${primaryTopic}
**All Detected Topics**: ${allTopics.length > 0 ? allTopics.join(', ') : 'No specific topics detected'}
**Key Phrases**: ${keyPhrases.join(', ')}
**Sentiment**: ${parsedData.sentiment || 'Neutral'}

${topicAnalysis.length > 0 ? '**Specific Insights**: ' + topicAnalysis.join('. ') : ''}

This cast would fit well in a "${primaryTopic}" vault.`
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
          
          // Parse the cast content to analyze topics and themes
          const parsedData = ContentParser.parseContent(recentCast.cast_content)
          const keyPhrases = ContentParser.extractKeyPhrases(recentCast.cast_content, 5)
          
          // Determine the main topic based on analysis
          let mainTopic = 'General'
          if (parsedData.topics && parsedData.topics.length > 0) {
            mainTopic = parsedData.topics[0].charAt(0).toUpperCase() + parsedData.topics[0].slice(1)
          }
          
          // Create a summary of what the cast is about
          let topicSummary = ''
          if (parsedData.topics && parsedData.topics.length > 0) {
            topicSummary = `This cast appears to be about **${parsedData.topics.join(', ')}**.`
          } else if (keyPhrases.length > 0) {
            topicSummary = `Key themes include: ${keyPhrases.join(', ')}.`
          } else {
            topicSummary = 'This appears to be a general conversation or social post.'
          }

          // Suggest appropriate vault
          let vaultSuggestion = ''
          if (parsedData.topics && parsedData.topics.length > 0) {
            const suggestedVault = parsedData.topics.includes('crypto') || parsedData.topics.includes('ethereum') || parsedData.topics.includes('defi') 
              ? 'Crypto & Web3' 
              : parsedData.topics.includes('tech') || parsedData.topics.includes('ai') || parsedData.topics.includes('development')
              ? 'Tech & Development'
              : parsedData.topics.includes('social') || parsedData.topics.includes('community')
              ? 'Social & Community'
              : 'General'
            
            vaultSuggestion = ` I'd suggest organizing this into a "${suggestedVault}" vault.`
          }
          
          return {
            success: true,
            cast: {
              hash: recentCast.cast_hash,
              author: recentCast.username,
              content: recentCast.cast_content,
              saved_at: recentCast.created_at,
              timestamp: recentCast.cast_timestamp,
              url: recentCast.cast_url,
              analysis: {
                main_topic: mainTopic,
                detected_topics: parsedData.topics || [],
                key_phrases: keyPhrases,
                sentiment: parsedData.sentiment,
                word_count: parsedData.word_count,
                hashtags: parsedData.hashtags || [],
                mentions: parsedData.mentions || []
              }
            },
            message: `Your most recent cast was saved on ${new Date(recentCast.created_at).toLocaleDateString()}, authored by **${recentCast.username}**.

**Topic Analysis**: ${topicSummary}

**Content**: "${recentCast.cast_content.length > 200 ? recentCast.cast_content.substring(0, 200) + '...' : recentCast.cast_content}"

**Detected Topics**: ${parsedData.topics && parsedData.topics.length > 0 ? parsedData.topics.join(', ') : 'None detected'}
**Sentiment**: ${parsedData.sentiment || 'Neutral'}
**Key Phrases**: ${keyPhrases.length > 0 ? keyPhrases.join(', ') : 'None identified'}

${vaultSuggestion}`
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

        case 'debug_cast_analysis': {
          const limit = args.limit || 10
          const castsToAnalyze = casts.slice(0, limit)
          const analysis = []

          console.log(`🔍 Debugging analysis of ${castsToAnalyze.length} casts`)

          for (const cast of castsToAnalyze) {
            const parsedData = ContentParser.parseContent(cast.cast_content)
            analysis.push({
              cast_hash: cast.cast_hash.substring(0, 10) + '...',
              author: cast.username,
              content_preview: cast.cast_content.substring(0, 100) + (cast.cast_content.length > 100 ? '...' : ''),
              detected_topics: parsedData.topics || [],
              detected_hashtags: parsedData.hashtags || [],
              detected_mentions: parsedData.mentions || [],
              sentiment: parsedData.sentiment,
              word_count: parsedData.word_count,
              has_urls: (parsedData.urls?.length || 0) > 0,
              timestamp: cast.cast_timestamp
            })
          }

          // Count all topics found
          const allTopics: Record<string, number> = {}
          analysis.forEach(a => {
            a.detected_topics.forEach(topic => {
              allTopics[topic] = (allTopics[topic] || 0) + 1
            })
          })

          return {
            success: true,
            total_casts: casts.length,
            analyzed_casts: castsToAnalyze.length,
            cast_analysis: analysis,
            topic_summary: Object.entries(allTopics)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .slice(0, 10)
              .map(([topic, count]) => ({ topic, count })),
            message: `Analyzed ${castsToAnalyze.length} casts. Most common topics: ${Object.entries(allTopics).sort(([,a], [,b]) => (b as number) - (a as number)).slice(0, 3).map(([topic]) => topic).join(', ')}`
          }
        }

        case 'find_casts_by_topic': {
          const keywords = args.keywords.map((k: string) => k.toLowerCase())
          const matchingCasts = []

          console.log(`🔍 Searching through ${casts.length} casts for keywords:`, keywords)
          
          for (const cast of casts) {
            const content = cast.cast_content.toLowerCase()
            const username = cast.username.toLowerCase()
            const tags = cast.tags?.map(t => t.toLowerCase()) || []
            
            // Check if any keyword appears in content, username, or tags
            const hasMatch = keywords.some((keyword: string) => 
              content.includes(keyword) || 
              username.includes(keyword) || 
              tags.some(tag => tag.includes(keyword))
            )

            if (hasMatch) {
              // Parse content to get more details
              const parsedData = ContentParser.parseContent(cast.cast_content)
              matchingCasts.push({
                hash: cast.cast_hash,
                author: cast.username,
                content: cast.cast_content,
                content_preview: cast.cast_content.substring(0, 150) + (cast.cast_content.length > 150 ? '...' : ''),
                timestamp: cast.cast_timestamp,
                saved_at: cast.created_at,
                url: cast.cast_url,
                matched_keywords: keywords.filter((keyword: string) => 
                  content.includes(keyword) || 
                  username.includes(keyword) || 
                  tags.some(tag => tag.includes(keyword))
                ),
                topics: parsedData.topics || [],
                hashtags: parsedData.hashtags || [],
                sentiment: parsedData.sentiment
              })
            }
          }

          console.log(`📊 Found ${matchingCasts.length} matching casts`)

          return {
            success: true,
            found: matchingCasts.length,
            searched_keywords: keywords,
            total_casts_searched: casts.length,
            matches: matchingCasts.slice(0, 10), // Limit to first 10 for response
            message: matchingCasts.length > 0 
              ? `Found ${matchingCasts.length} casts containing: ${keywords.join(', ')}`
              : `No casts found containing any of: ${keywords.join(', ')}`
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

        case 'add_topic_casts_to_vault': {
          console.log('🔍 add_topic_casts_to_vault args:', parsedArgs)
          
          // Extract and validate parameters
          const topic = parsedArgs.topic
          const vault_name = parsedArgs.vault_name
          const create_vault_if_missing = parsedArgs.create_vault_if_missing !== false // default to true
          
          // Validate required parameters
          if (!topic || typeof topic !== 'string') {
            return { 
              success: false, 
              message: 'Topic is required and must be a string' 
            }
          }
          
          if (!vault_name || typeof vault_name !== 'string') {
            return { 
              success: false, 
              message: 'Vault name is required and must be a string' 
            }
          }
          
          console.log('🔍 Searching for casts about:', topic)
          
          // Find casts matching the topic
          const topicLower = topic.toLowerCase()
          const matchingCasts = casts.filter(cast => {
            if (!cast.cast_content) return false
            
            try {
              const parsed = ContentParser.parseContent(cast.cast_content)
              return (parsed.topics && parsed.topics.some(t => t.toLowerCase().includes(topicLower))) || 
                     cast.cast_content.toLowerCase().includes(topicLower) ||
                     (cast.tags && cast.tags.some(tag => tag.toLowerCase().includes(topicLower)))
            } catch (error) {
              console.error('Error parsing cast content:', error)
              // Fallback to simple text search
              return cast.cast_content.toLowerCase().includes(topicLower)
            }
          })

          console.log('📊 Found', matchingCasts.length, 'matching casts out of', casts.length, 'total casts')

          if (matchingCasts.length === 0) {
            return { 
              success: false, 
              message: `No casts found matching topic "${topic}". I searched through ${casts.length} total casts.` 
            }
          }

          // Find or create the vault
          let vault = vaults.find(v => v.name && v.name.toLowerCase() === vault_name.toLowerCase())
          
          if (!vault && create_vault_if_missing) {
            console.log('🏗️ Creating vault:', vault_name)
            // Create the vault
            try {
              vault = await VaultService.createVault(
                vault_name,
                `Automatically created vault for ${topic} related content`,
                [topicLower],
                userId,
                false
              )
              
              // Update vaults state
              setVaults(prev => [...prev, vault!])
              console.log('✅ Vault created successfully:', vault.id)
              
            } catch (error) {
              console.error('❌ Failed to create vault:', error)
              return { 
                success: false, 
                message: `Failed to create vault "${vault_name}": ${error instanceof Error ? error.message : 'Unknown error'}` 
              }
            }
          } else if (!vault) {
            return { 
              success: false, 
              message: `Vault "${vault_name}" not found and create_vault_if_missing is false` 
            }
          }

          // Add matching casts to the vault
          console.log('🔗 Adding', matchingCasts.length, 'casts to vault:', vault!.name)
          const results = []
          let successCount = 0
          
          for (const cast of matchingCasts) {
            try {
              if (!cast.id) {
                console.error('⚠️ Cast missing ID:', cast)
                results.push({
                  cast_hash: cast.cast_hash,
                  author: cast.username || 'Unknown',
                  preview: (cast.cast_content || '').substring(0, 100),
                  success: false,
                  error: 'Cast ID is missing'
                })
                continue
              }

              await VaultService.addCastToVault(cast.id, vault!.id)
              results.push({
                cast_hash: cast.cast_hash,
                author: cast.username || 'Unknown',
                preview: (cast.cast_content || '').substring(0, 100),
                success: true
              })
              successCount++
              console.log('✅ Added cast to vault:', cast.cast_hash)
              
            } catch (error) {
              console.error('❌ Failed to add cast:', cast.cast_hash, error)
              results.push({
                cast_hash: cast.cast_hash,
                author: cast.username || 'Unknown',
                preview: (cast.cast_content || '').substring(0, 100),
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }

          console.log('📊 Vault operation complete:', {
            total: matchingCasts.length,
            success: successCount,
            failed: matchingCasts.length - successCount
          })

          // Refresh data in parent component
          onCastUpdate?.()

          return {
            success: true,
            topic_searched: topic,
            vault_name: vault_name,
            total_found: matchingCasts.length,
            successfully_added: successCount,
            failed: matchingCasts.length - successCount,
            matching_casts: results,
            message: `Found ${matchingCasts.length} casts matching "${topic}" and successfully added ${successCount} to vault "${vault_name}"`
          }
        }

        case 'request_vault_deletion': {
          const { vault_name, confirmation, user_message } = args
          
          // Check if user is providing the exact confirmation phrase
          const isExactConfirmation = user_message && 
                                     (user_message.toLowerCase().includes('i want the vault deleted') ||
                                      user_message.toLowerCase().includes('i want it deleted') ||
                                      user_message.toLowerCase() === 'i want the vault deleted')
          
          // If this is a confirmation (either parameter or detected phrase)
          if (confirmation === true || isExactConfirmation) {
            // Look for the vault we're supposed to delete from recent conversation
            let targetVault = null
            
            // Get the last few messages to find which vault was being discussed
            const recentMessages = messages.slice(-5)
            for (const msg of recentMessages.reverse()) {
              if (msg.role === 'assistant' && msg.content.includes('delete the vault')) {
                // Extract vault name from the assistant's confirmation request
                const match = msg.content.match(/delete the vault "([^"]+)"/i)
                if (match) {
                  const targetVaultName = match[1]
                  targetVault = vaults.find(v => v.name && v.name.toLowerCase() === targetVaultName.toLowerCase())
                  break
                }
              }
            }
            
            if (!targetVault) {
              return {
                success: false,
                message: "I couldn't determine which vault to delete. Please start over by specifying the vault name you want to delete."
              }
            }
            
            // Proceed with deletion
            try {
              const castCount = targetVault.cast_count || 0
              await VaultService.deleteVault(targetVault.id, userId)
              
              // Update local vaults state
              setVaults(prev => prev.filter(v => v.id !== targetVault.id))
              
              // Refresh data in parent component
              onCastUpdate?.()

              return {
                success: true,
                deleted_vault: {
                  name: targetVault.name,
                  description: targetVault.description,
                  cast_count: castCount
                },
                message: `✅ Successfully deleted vault "${targetVault.name}". The vault contained ${castCount} casts, but the casts themselves were not deleted and remain in your saved casts.`
              }
            } catch (error) {
              return {
                success: false,
                message: `Failed to delete vault "${targetVault.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            }
          }
          
          // This is an initial deletion request - ask for confirmation
          if (!vault_name || typeof vault_name !== 'string') {
            return { 
              success: false, 
              message: 'Please specify which vault you want to delete.' 
            }
          }
          
          // Find the vault by name with flexible matching
          const searchName = vault_name.toLowerCase().trim()
          let vault = vaults.find(v => v.name && v.name.toLowerCase() === searchName)
          
          // If no exact match, try partial matching
          if (!vault) {
            const partialMatches = vaults.filter(v => 
              v.name && v.name.toLowerCase().includes(searchName)
            )
            
            if (partialMatches.length === 1) {
              vault = partialMatches[0]
            } else if (partialMatches.length > 1) {
              // Provide detailed info about each matching vault to help user distinguish
              const matchDetails = partialMatches.map(v => {
                const ageDays = Math.floor((new Date().getTime() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24))
                return `"${v.name}" (${v.cast_count || 0} casts, created ${ageDays} days ago)`
              }).join(', ')
              
              return { 
                success: false, 
                message: `Multiple vaults match "${vault_name}": ${matchDetails}. Please be more specific with the exact vault name.` 
              }
            }
          }
          
          if (!vault) {
            const availableVaults = vaults.filter(v => v.name).map(v => v.name)
            return { 
              success: false, 
              message: `Vault "${vault_name}" not found. Available vaults: ${availableVaults.join(', ') || 'none'}` 
            }
          }

          const castCount = vault.cast_count || 0
          const createdDate = new Date(vault.created_at)
          const ageDays = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

          return {
            success: true,
            vault_info: {
              name: vault.name,
              description: vault.description,
              cast_count: castCount,
              created_at: vault.created_at,
              age_days: ageDays,
              created_date_friendly: createdDate.toLocaleDateString()
            },
            message: `⚠️  Are you sure you want to delete the vault "${vault.name}"?\n\n📊 Vault Details:\n• Contains: ${castCount} casts\n• Created: ${createdDate.toLocaleDateString()} (${ageDays} days ago)\n• Description: ${vault.description || 'No description'}\n\nThe vault will be deleted but your casts will remain saved.\n\nTo confirm, please respond with exactly: **"I want the vault deleted"**`
          }
        }

        case 'bulk_delete_vaults': {
          const { vault_names, confirmation, user_message } = args
          
          if (!vault_names || !Array.isArray(vault_names) || vault_names.length === 0) {
            return {
              success: false,
              message: 'Please specify which vaults to delete, or use ["ALL"] to delete all vaults.'
            }
          }

          // Check if user is providing bulk confirmation
          const isBulkConfirmation = user_message && 
                                   (user_message.toLowerCase().includes('i want all the vaults deleted') ||
                                    user_message.toLowerCase().includes('delete all vaults') ||
                                    user_message.toLowerCase().includes('i want them all deleted'))

          // If this is a confirmation
          if (confirmation === true || isBulkConfirmation) {
            // Determine what to delete based on recent conversation
            let targetVaults: Vault[] = []
            
            // Check if we're deleting all vaults
            if (vault_names.includes('ALL') || vault_names[0]?.toLowerCase() === 'all') {
              targetVaults = vaults
            } else {
              // Find specific vaults
              targetVaults = vaults.filter(v => 
                vault_names.some(name => 
                  v.name.toLowerCase().includes(name.toLowerCase()) ||
                  name.toLowerCase().includes(v.name.toLowerCase())
                )
              )
            }

            if (targetVaults.length === 0) {
              return {
                success: false,
                message: "No vaults found to delete. Please specify vault names or use 'all vaults' to delete everything."
              }
            }

            // Proceed with bulk deletion
            try {
              const deletionResults = []
              let successCount = 0
              let failCount = 0

              for (const vault of targetVaults) {
                try {
                  await VaultService.deleteVault(vault.id, userId)
                  deletionResults.push({
                    name: vault.name,
                    success: true,
                    cast_count: vault.cast_count || 0
                  })
                  successCount++
                } catch (error) {
                  deletionResults.push({
                    name: vault.name,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  })
                  failCount++
                }
              }
              
              // Update local vaults state
              const deletedVaultIds = deletionResults
                .filter(r => r.success)
                .map(r => targetVaults.find(v => v.name === r.name)?.id)
                .filter(Boolean)
              
              setVaults(prev => prev.filter(v => !deletedVaultIds.includes(v.id)))
              
              // Refresh data in parent component
              onCastUpdate?.()

              const totalCasts = deletionResults
                .filter(r => r.success)
                .reduce((sum, r) => sum + (r.cast_count || 0), 0)

              return {
                success: successCount > 0,
                deleted_vaults: deletionResults.filter(r => r.success),
                failed_deletions: deletionResults.filter(r => !r.success),
                summary: {
                  total_attempted: targetVaults.length,
                  successful: successCount,
                  failed: failCount,
                  total_casts_affected: totalCasts
                },
                message: `Bulk deletion completed: ${successCount} vault${successCount !== 1 ? 's' : ''} deleted successfully${failCount > 0 ? `, ${failCount} failed` : ''}. Total casts in deleted vaults: ${totalCasts} (casts remain in your saved casts).`
              }
            } catch (error) {
              return {
                success: false,
                message: `Bulk deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            }
          }

          // This is an initial bulk deletion request - ask for confirmation
          let targetVaults: Vault[] = []
          let isAll = false

          if (vault_names.includes('ALL') || vault_names[0]?.toLowerCase() === 'all') {
            targetVaults = vaults
            isAll = true
          } else {
            // Find specific vaults by name matching
            targetVaults = vaults.filter(v => 
              vault_names.some(name => 
                v.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(v.name.toLowerCase())
              )
            )
          }

          if (targetVaults.length === 0) {
            const availableVaults = vaults.filter(v => v.name).map(v => v.name)
            return {
              success: false,
              message: `No vaults found matching: ${vault_names.join(', ')}. Available vaults: ${availableVaults.join(', ') || 'none'}`
            }
          }

          const totalCasts = targetVaults.reduce((sum, v) => sum + (v.cast_count || 0), 0)
          const vaultDetails = targetVaults.map(v => {
            const ageDays = Math.floor((new Date().getTime() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24))
            return `• "${v.name}" (${v.cast_count || 0} casts, ${ageDays} days old)`
          }).join('\n')

          return {
            success: true,
            vaults_to_delete: targetVaults.map(v => ({
              name: v.name,
              cast_count: v.cast_count || 0,
              created_at: v.created_at
            })),
            summary: {
              count: targetVaults.length,
              total_casts: totalCasts,
              is_all_vaults: isAll
            },
            message: `⚠️  ${isAll ? 'DELETE ALL VAULTS' : 'BULK DELETE VAULTS'}\n\nYou want to delete ${targetVaults.length} vault${targetVaults.length !== 1 ? 's' : ''}:\n\n${vaultDetails}\n\n📊 Summary:\n• Total vaults: ${targetVaults.length}\n• Total casts: ${totalCasts}\n• All vaults will be deleted but your casts will remain saved.\n\nTo confirm, please respond with exactly: **"I want all the vaults deleted"**`
          }
        }

        case 'delete_cast': {
          const { cast_id, confirmation, user_message } = args
          
          if (!cast_id) {
            return {
              success: false,
              message: 'Please specify which cast to delete by providing the cast ID.'
            }
          }

          // Find the cast to get details
          const targetCast = casts.find(c => c.id === cast_id)
          if (!targetCast) {
            return {
              success: false,
              message: 'Cast not found. Please check the cast ID.'
            }
          }

          // Check if user is providing confirmation
          const isConfirmation = user_message && 
                               (user_message.toLowerCase().includes('i want the cast deleted') ||
                                user_message.toLowerCase().includes('delete the cast') ||
                                user_message.toLowerCase().includes('yes, delete it'))

          // If this is a confirmation, proceed with deletion
          if (confirmation === true || isConfirmation) {
            try {
              await CastService.deleteCast(cast_id, userId)
              
              return {
                success: true,
                data: {
                  deleted_cast_id: cast_id,
                  cast_preview: targetCast.cast_content.substring(0, 100)
                },
                message: `✅ Successfully deleted cast by @${targetCast.username}: "${targetCast.cast_content.substring(0, 100)}${targetCast.cast_content.length > 100 ? '...' : ''}"`
              }
            } catch (error) {
              console.error('Error deleting cast:', error)
              return {
                success: false,
                message: `Error deleting cast: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            }
          } else {
            // Show confirmation prompt
            return {
              success: false,
              data: {
                action: 'confirmation_required',
                cast_id: cast_id,
                cast_preview: targetCast.cast_content.substring(0, 100)
              },
              message: `⚠️  Are you sure you want to delete this cast?\n\n📄 Cast Details:\n• Author: @${targetCast.username}\n• Content: "${targetCast.cast_content.substring(0, 150)}${targetCast.cast_content.length > 150 ? '...' : ''}"\n• Saved: ${new Date(targetCast.created_at).toLocaleDateString()}\n\nTo confirm, please respond with: **"I want the cast deleted"**`
            }
          }
        }

        case 'bulk_delete_casts': {
          const { cast_ids, confirmation, user_message } = args
          
          if (!cast_ids || !Array.isArray(cast_ids) || cast_ids.length === 0) {
            return {
              success: false,
              message: 'Please specify which casts to delete, or use ["ALL"] to delete all casts.'
            }
          }

          // Check if user is providing bulk confirmation
          const isBulkConfirmation = user_message && 
                                   (user_message.toLowerCase().includes('i want all the casts deleted') ||
                                    user_message.toLowerCase().includes('delete all casts') ||
                                    user_message.toLowerCase().includes('i want them all deleted'))

          // If this is a confirmation
          if (confirmation === true || isBulkConfirmation) {
            // Determine what to delete based on request
            let targetCastIds: string[] = []
            const isAll = cast_ids.includes('ALL') || cast_ids[0]?.toLowerCase() === 'all'
            
            if (isAll) {
              // Delete all user casts using the new deleteAllUserCasts function
              try {
                const result = await CastService.deleteAllUserCasts(userId, 'DELETE_ALL_CASTS_CONFIRMED')
                
                if (result.success) {
                  return {
                    success: true,
                    data: {
                      deleted_count: result.deletedCount,
                      is_all_casts: true
                    },
                    message: `✅ Successfully deleted all ${result.deletedCount} saved casts.`
                  }
                } else {
                  return {
                    success: false,
                    message: result.message
                  }
                }
              } catch (error) {
                console.error('Error deleting all casts:', error)
                return {
                  success: false,
                  message: `Error deleting all casts: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
              }
            } else {
              // Delete specific casts
              targetCastIds = cast_ids.filter(id => typeof id === 'string' && id !== 'ALL')
              
              if (targetCastIds.length === 0) {
                return {
                  success: false,
                  message: "No valid cast IDs found to delete."
                }
              }

              try {
                const result = await CastService.bulkDeleteCasts(targetCastIds, userId)
                
                return {
                  success: result.success,
                  data: {
                    deleted_count: result.deletedCount,
                    failed_count: result.failedCount,
                    errors: result.errors,
                    is_all_casts: false
                  },
                  message: `Bulk cast deletion completed: ${result.deletedCount} cast${result.deletedCount !== 1 ? 's' : ''} deleted successfully${result.failedCount > 0 ? `, ${result.failedCount} failed` : ''}.`
                }
              } catch (error) {
                console.error('Error in bulk cast deletion:', error)
                return {
                  success: false,
                  message: `Error during bulk deletion: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
              }
            }
          } else {
            // Show confirmation prompt
            const isAll = cast_ids.includes('ALL') || cast_ids[0]?.toLowerCase() === 'all'
            
            if (isAll) {
              const totalCasts = casts.length
              return {
                success: false,
                data: {
                  action: 'confirmation_required',
                  cast_ids: ['ALL'],
                  count: totalCasts,
                  is_all_casts: true
                },
                message: `⚠️  DELETE ALL SAVED CASTS\n\nYou want to delete ALL of your ${totalCasts} saved casts.\n\n📊 Summary:\n• Total casts: ${totalCasts}\n• This action cannot be undone\n• All your saved casts will be permanently removed\n\nTo confirm, please respond with exactly: **"I want all the casts deleted"**`
              }
            } else {
              const validCastIds = cast_ids.filter(id => typeof id === 'string' && id !== 'ALL')
              const targetCasts = casts.filter(c => validCastIds.includes(c.id))
              
              if (targetCasts.length === 0) {
                return {
                  success: false,
                  message: "No valid casts found with the provided IDs."
                }
              }

              const castDetails = targetCasts.slice(0, 5).map(cast => 
                `• @${cast.username}: "${cast.cast_content.substring(0, 60)}${cast.cast_content.length > 60 ? '...' : ''}"`
              ).join('\n')

              return {
                success: false,
                data: {
                  action: 'confirmation_required',
                  cast_ids: validCastIds,
                  count: targetCasts.length,
                  is_all_casts: false
                },
                message: `⚠️  BULK DELETE CASTS\n\nYou want to delete ${targetCasts.length} cast${targetCasts.length !== 1 ? 's' : ''}:\n\n${castDetails}${targetCasts.length > 5 ? `\n... and ${targetCasts.length - 5} more` : ''}\n\n📊 Summary:\n• Total casts: ${targetCasts.length}\n• This action cannot be undone\n\nTo confirm, please respond with exactly: **"I want all the casts deleted"**`
              }
            }
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
              1. List and manage vaults (with creation dates and sorting)
              2. Organize casts into vaults automatically
              3. Analyze patterns in saved casts
              4. Search for specific casts
              5. Create new vaults with rules
              6. Organize casts by sentiment or topic
              7. Delete vaults (with confirmation and creation date info)
              8. Find vaults by age or creation date (useful for identifying duplicates)
              9. Delete individual or multiple saved casts
              
              VAULT DELETION RULES:
              - For single vault: use request_vault_deletion with vault_name
              - For multiple/all vaults: use bulk_delete_vaults with vault_names array
              - When user says "I want the vault deleted" → confirmation=true for single vault
              - When user says "I want all the vaults deleted" → confirmation=true for bulk deletion
              - Always pass user_message parameter with exact user input
              - For all vaults: use vault_names: ["ALL"]
              - For multiple specific vaults: use vault_names: ["vault1", "vault2"]
              - Use find_vaults_by_age to help identify duplicate vaults by creation date when multiple vaults have similar names
              
              CAST DELETION RULES:
              - For single cast: use delete_cast with cast_id
              - For multiple/all casts: use bulk_delete_casts with cast_ids array
              - When user says "I want the cast deleted" → confirmation=true for single cast
              - When user says "I want all the casts deleted" → confirmation=true for bulk deletion
              - Always pass user_message parameter with exact user input
              - For all casts: use cast_ids: ["ALL"]
              - For multiple specific casts: use cast_ids: ["cast1", "cast2"]
              - Cast deletion is permanent and cannot be undone
              
              IMPORTANT: Maintain conversation context and remember what you've previously analyzed or discussed.
              When users refer to previously mentioned topics or results, reference that information.
              If you find casts matching a topic the user mentioned, offer to add them to relevant vaults.
              
              Always be helpful and suggest next actions. When organizing casts, provide clear summaries of what was done.
              Format your responses with clear sections and bullet points when listing items.`
            },
            ...messages.slice(-12), // Include more messages for better context
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
              {
                role: 'system',
                content: `You are a helpful AI assistant for CastKPR. Maintain conversation context and remember what you've analyzed.

                Current context:
                - User has ${context.vault_count} vaults: ${context.vault_names.join(', ') || 'none'}
                - User has ${context.cast_count} saved casts
                
                Function just executed: ${data.function_call.name}
                Function result summary: ${typeof functionResult === 'object' && functionResult.message ? functionResult.message : 'Function completed'}
                
                Remember to reference previous analysis results when relevant.`
              },
              ...messages.slice(-8), // Include last 8 messages for better context
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