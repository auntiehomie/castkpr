import { NextRequest, NextResponse } from 'next/server'
import { getMCPClient } from '@/lib/mcp-client'

export async function POST(request: NextRequest) {
  try {
    const { cast_hash, user_id, perspective = 'general' } = await request.json()
    
    if (!cast_hash || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: cast_hash, user_id' },
        { status: 400 }
      )
    }

    const mcpClient = getMCPClient()
    const opinion = await mcpClient.generateCastOpinion(cast_hash, user_id, perspective)
    
    return NextResponse.json({
      success: true,
      opinion: JSON.parse(opinion.content[0].text)
    })
  } catch (error) {
    console.error('❌ Error in MCP opinion endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to generate cast opinion' },
      { status: 500 }
    )
  }
}
