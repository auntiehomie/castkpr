// src/lib/ai-vault-organizer.ts
export class AIVaultOrganizer {
  // Main function to organize casts into vaults using AI
  static async organizeWithAI(context: {
    userCasts: Array<{id: string, content: string, author: string, tags: string[], category?: string}>
    userVaults: Array<{id: string, name: string, description?: string}>
    userMessage: string
  }): Promise<{
    response: string
    confidence: number
    actions?: Array<{
      type: 'add_to_vault' | 'create_vault' | 'tag_cast' | 'remove_tag'
      castId?: string
      vaultId?: string
      vaultName?: string
      description?: string
      value?: string
    }>
  }> {
    try {
      // Call our API route instead of OpenAI directly
      const response = await fetch('/api/ai-organize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context)
      })

      if (response.ok) {
        const result = await response.json()
        return result
      } else {
        console.error('API call failed:', response.status)
      }

    } catch (error) {
      console.error('Error calling AI organize API:', error)
    }

    // Fallback to rule-based organization
    return this.fallbackOrganization(context)
  }

  // Fallback organization when AI fails
  static fallbackOrganization(context: {
    userCasts: Array<{id: string, content: string, author: string, tags: string[], category?: string}>
    userVaults: Array<{id: string, name: string, description?: string}>
    userMessage: string
  }) {
    const message = context.userMessage.toLowerCase()
    
    if (message.includes('organize') && (message.includes('topic') || message.includes('category'))) {
      return this.organizeByTopics(context)
    }
    
    if (message.includes('crypto') || message.includes('defi') || message.includes('nft')) {
      return this.organizeCryptoContent(context)
    }
    
    if (message.includes('create') && message.includes('vault')) {
      return this.suggestNewVaults(context)
    }
    
    // Default helpful response
    return {
      response: `I can help you organize your ${context.userCasts.length} saved casts! Here are some things I can do:

🗂️ **Organize by topic**: "organize my casts by topic"
🏷️ **Smart tagging**: "tag my crypto casts"
📂 **Create themed vaults**: "create a vault for AI content"
🔍 **Find and group**: "group all my DeFi casts"

What would you like me to help with?`,
      confidence: 0.8
    }
  }

  // Organize casts by their main topics
  static organizeByTopics(context: {
    userCasts: Array<{id: string, content: string, author: string, tags: string[], category?: string}>
    userVaults: Array<{id: string, name: string, description?: string}>
    userMessage: string
  }) {
    // Group casts by their primary topic/category
    const topicGroups: Record<string, string[]> = {}
    
    context.userCasts.forEach(cast => {
      let topic = 'general'
      
      // Determine topic from category or tags
      if (cast.category && cast.category !== 'general') {
        topic = cast.category
      } else if (cast.tags.length > 0) {
        topic = cast.tags[0]
      } else {
        // Analyze content for topic
        const content = cast.content.toLowerCase()
        if (content.includes('crypto') || content.includes('bitcoin') || content.includes('ethereum')) {
          topic = 'crypto'
        } else if (content.includes('ai') || content.includes('artificial intelligence')) {
          topic = 'ai'
        } else if (content.includes('tech') || content.includes('development')) {
          topic = 'technology'
        } else if (content.includes('art') || content.includes('design')) {
          topic = 'creative'
        }
      }
      
      if (!topicGroups[topic]) {
        topicGroups[topic] = []
      }
      topicGroups[topic].push(cast.id)
    })
    
    // Generate actions
    const actions = []
    let response = `🗂️ I'll organize your ${context.userCasts.length} casts by topic! Here's my plan:\n\n`
    
    for (const [topic, castIds] of Object.entries(topicGroups)) {
      if (castIds.length === 0) continue
      
      // Check if a suitable vault already exists
      const existingVault = context.userVaults.find(vault => 
        vault.name.toLowerCase().includes(topic.toLowerCase()) ||
        vault.description?.toLowerCase().includes(topic.toLowerCase())
      )
      
      if (existingVault) {
        // Add casts to existing vault
        castIds.forEach(castId => {
          actions.push({
            type: 'add_to_vault' as const,
            castId,
            vaultId: existingVault.id
          })
        })
        response += `📂 Adding ${castIds.length} ${topic} casts to existing "${existingVault.name}" vault\n`
      } else {
        // Create new vault for this topic
        const vaultName = `${topic.charAt(0).toUpperCase() + topic.slice(1)} Collection`
        actions.push({
          type: 'create_vault' as const,
          vaultName,
          description: `Automatically organized collection of ${topic}-related casts`
        })
        response += `🆕 Creating "${vaultName}" vault for ${castIds.length} casts\n`
        
        // Add casts to the new vault (this would need to be handled after vault creation)
        // For now, we'll tag them so they can be added later
        castIds.forEach(castId => {
          actions.push({
            type: 'tag_cast' as const,
            castId,
            value: `vault-${topic}`
          })
        })
      }
    }
    
    response += `\n✨ Organization complete! Your casts are now better organized by topic.`
    
    return {
      response,
      confidence: 0.85,
      actions
    }
  }

  // Organize crypto-related content
  static organizeCryptoContent(context: {
    userCasts: Array<{id: string, content: string, author: string, tags: string[], category?: string}>
    userVaults: Array<{id: string, name: string, description?: string}>
    userMessage: string
  }) {
    const cryptoCasts = context.userCasts.filter(cast => {
      const content = cast.content.toLowerCase()
      const tags = cast.tags.join(' ').toLowerCase()
      
      return content.includes('crypto') || content.includes('bitcoin') || 
             content.includes('ethereum') || content.includes('defi') ||
             content.includes('nft') || tags.includes('crypto') ||
             tags.includes('defi') || tags.includes('nft')
    })
    
    if (cryptoCasts.length === 0) {
      return {
        response: "I didn't find any crypto-related casts in your collection. Try saving some crypto content first!",
        confidence: 0.9
      }
    }
    
    // Check if crypto vault exists
    const cryptoVault = context.userVaults.find(vault => 
      vault.name.toLowerCase().includes('crypto') || 
      vault.name.toLowerCase().includes('defi') ||
      vault.description?.toLowerCase().includes('crypto')
    )
    
    const actions = []
    let response = `🪙 Found ${cryptoCasts.length} crypto-related casts! `
    
    if (cryptoVault) {
      // Add to existing crypto vault
      cryptoCasts.forEach(cast => {
        actions.push({
          type: 'add_to_vault' as const,
          castId: cast.id,
          vaultId: cryptoVault.id
        })
      })
      response += `Adding them all to your existing "${cryptoVault.name}" vault.`
    } else {
      // Create new crypto vault
      actions.push({
        type: 'create_vault' as const,
        vaultName: 'Crypto & DeFi',
        description: 'Collection of cryptocurrency, DeFi, and blockchain-related casts'
      })
      
      // Tag crypto casts for organization
      cryptoCasts.forEach(cast => {
        actions.push({
          type: 'tag_cast' as const,
          castId: cast.id,
          value: 'crypto'
        })
      })
      
      response += `Creating a new "Crypto & DeFi" vault to organize them all.`
    }
    
    return {
      response,
      confidence: 0.9,
      actions
    }
  }

  // Suggest new vaults based on content analysis
  static suggestNewVaults(context: {
    userCasts: Array<{id: string, content: string, author: string, tags: string[], category?: string}>
    userVaults: Array<{id: string, name: string, description?: string}>
    userMessage: string
  }) {
    // Analyze cast content to suggest vault categories
    const suggestions = []
    const allTags = context.userCasts.flatMap(cast => cast.tags)
    const tagCounts = allTags.reduce((acc: Record<string, number>, tag) => {
      acc[tag] = (acc[tag] || 0) + 1
      return acc
    }, {})
    
    // Get top tags that could become vaults
    const topTags = Object.entries(tagCounts)
      .filter(([tag, count]) => count >= 3) // At least 3 casts with this tag
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
    
    let response = `💡 Based on your ${context.userCasts.length} casts, I suggest these vaults:\n\n`
    
    topTags.forEach(([tag, count]) => {
      const vaultName = `${tag.charAt(0).toUpperCase() + tag.slice(1)} Collection`
      suggestions.push({
        name: vaultName,
        description: `Collection of ${tag}-related content (${count} casts)`,
        count
      })
      response += `📂 "${vaultName}" - ${count} casts ready to organize\n`
    })
    
    if (suggestions.length === 0) {
      response = "You might want to save more casts first! Once you have more content, I can suggest better vault organization."
    } else {
      response += `\nWould you like me to create any of these vaults and organize your casts?`
    }
    
    return {
      response,
      confidence: 0.75,
      actions: [] // No actions for suggestions, just recommendations
    }
  }
}