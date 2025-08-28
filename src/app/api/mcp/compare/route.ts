import { NextRequest, NextResponse } from 'next/server'
import { getMCPClient } from '@/lib/mcp-client'

export async function POST(request: NextRequest) {
  try {
    const { cast_hash_1, cast_hash_2, user_id } = await request.json()
    
    if (!cast_hash_1 || !cast_hash_2 || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: cast_hash_1, cast_hash_2, user_id' },
        { status: 400 }
      )
    }

    const mcpClient = getMCPClient()
    const comparison = await mcpClient.compareCasts(cast_hash_1, cast_hash_2, user_id)
    
    return NextResponse.json({
      success: true,
      comparison: JSON.parse(comparison.content[0].text)
    })
  } catch (error) {
    console.error('❌ Error in MCP compare endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to compare casts' },
      { status: 500 }
    )
  }
}
