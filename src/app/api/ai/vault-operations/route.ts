import { NextRequest, NextResponse } from 'next/server'
import { CollectionService, CastService } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, castId, collectionId, vaultName, castHash } = body

    console.log('🤖 AI Vault Operation:', { action, userId, castId, collectionId, vaultName, castHash })

    switch (action) {
      case 'addToVault': {
        // If we have a vault name instead of ID, find the vault first
        if (vaultName && !collectionId) {
          const vaults = await CollectionService.getUserCollections(userId)
          const vault = vaults.find(v => 
            v.name.toLowerCase() === vaultName.toLowerCase()
          )
          
          if (!vault) {
            console.log('❌ Vault not found:', vaultName)
            return NextResponse.json({ 
              success: false, 
              error: `Vault "${vaultName}" not found` 
            }, { status: 404 })
          }

          // Add cast to found vault
          await CollectionService.addCastToCollection(castId, vault.id)
          console.log('✅ Cast added to vault by name:', vaultName)
          
          return NextResponse.json({ 
            success: true, 
            message: `Cast added to vault "${vaultName}"`,
            vaultId: vault.id 
          })
        }
        
        // If we have a collection ID, use it directly
        if (collectionId) {
          await CollectionService.addCastToCollection(castId, collectionId)
          console.log('✅ Cast added to vault by ID:', collectionId)
          
          return NextResponse.json({ 
            success: true, 
            message: 'Cast added to vault' 
          })
        }

        return NextResponse.json({ 
          success: false, 
          error: 'Vault name or ID required' 
        }, { status: 400 })
      }

      case 'findCastByHash': {
        // Find a cast by its hash (useful if AI only knows the hash)
        if (!castHash) {
          return NextResponse.json({ 
            success: false, 
            error: 'Cast hash required' 
          }, { status: 400 })
        }

        const cast = await CastService.getCastByHash(castHash)
        if (!cast) {
          return NextResponse.json({ 
            success: false, 
            error: 'Cast not found' 
          }, { status: 404 })
        }

        return NextResponse.json({ 
          success: true, 
          cast 
        })
      }

      case 'listVaults': {
        // List all vaults for a user
        const vaults = await CollectionService.getUserCollections(userId)
        console.log('📚 Found vaults:', vaults.length)
        
        return NextResponse.json({ 
          success: true, 
          vaults: vaults.map(v => ({
            id: v.id,
            name: v.name,
            description: v.description,
            is_public: v.is_public
          }))
        })
      }

      case 'listCastsInVault': {
        // List casts in a specific vault
        if (!collectionId && !vaultName) {
          return NextResponse.json({ 
            success: false, 
            error: 'Vault ID or name required' 
          }, { status: 400 })
        }

        let vaultId = collectionId

        // Find vault by name if needed
        if (vaultName && !collectionId) {
          const vaults = await CollectionService.getUserCollections(userId)
          const vault = vaults.find(v => 
            v.name.toLowerCase() === vaultName.toLowerCase()
          )
          
          if (!vault) {
            return NextResponse.json({ 
              success: false, 
              error: `Vault "${vaultName}" not found` 
            }, { status: 404 })
          }
          
          vaultId = vault.id
        }

        const casts = await CollectionService.getCollectionCasts(vaultId!)
        console.log('📦 Found casts in vault:', casts.length)
        
        return NextResponse.json({ 
          success: true, 
          casts: casts.map(c => ({
            id: c.id,
            hash: c.cast_hash,
            content: c.cast_content,
            username: c.username,
            timestamp: c.cast_timestamp
          }))
        })
      }

      case 'createVault': {
        // Create a new vault
        const { name, description, isPublic } = body
        
        if (!name) {
          return NextResponse.json({ 
            success: false, 
            error: 'Vault name required' 
          }, { status: 400 })
        }

        const vault = await CollectionService.createCollection(
          name,
          description || '',
          userId,
          isPublic || false
        )
        
        console.log('✅ Vault created:', vault.name)
        
        return NextResponse.json({ 
          success: true, 
          vault: {
            id: vault.id,
            name: vault.name,
            description: vault.description
          }
        })
      }

      default:
        return NextResponse.json({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ AI Vault Operation Error:', error)
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred'
    
    // Check for specific error types
    if (errorMessage.includes('already in the vault')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cast is already in this vault' 
      }, { status: 409 })
    }
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 })
  }
}

// GET endpoint to check vault status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID required' 
      }, { status: 400 })
    }

    const vaults = await CollectionService.getUserCollections(userId)
    
    // Get cast counts for each vault
    const vaultsWithStats = await Promise.all(
      vaults.map(async (vault) => {
        const casts = await CollectionService.getCollectionCasts(vault.id)
        return {
          id: vault.id,
          name: vault.name,
          description: vault.description,
          is_public: vault.is_public,
          cast_count: casts.length
        }
      })
    )

    return NextResponse.json({ 
      success: true, 
      vaults: vaultsWithStats 
    })
  } catch (error) {
    console.error('❌ Error fetching vaults:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch vaults' 
    }, { status: 500 })
  }
}