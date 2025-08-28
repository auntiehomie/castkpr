import { NextRequest, NextResponse } from 'next/server'
import { getMCPClient } from '@/lib/mcp-client'

export async function POST(request: NextRequest) {
  try {
    const { cast_hash, user_id } = await request.json()
    
    if (!cast_hash || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: cast_hash, user_id' },
        { status: 400 }
      )
    }

    const mcpClient = getMCPClient()
    const analysis = await mcpClient.analyzeCastPerformance(cast_hash, user_id)
    
    return NextResponse.json({
      success: true,
      analysis: JSON.parse(analysis.content[0].text)
    })
  } catch (error) {
    console.error('❌ Error in MCP analyze endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to analyze cast performance' },
      { status: 500 }
    )
  }
}
