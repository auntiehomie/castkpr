import { NextRequest, NextResponse } from 'next/server'
import { getMCPClient } from '@/lib/mcp-client'

// Fallback analysis when MCP is unavailable
function generateFallbackAnalysis(cast_hash: string, user_id: string) {
  return {
    analysis_type: "fallback",
    cast_hash,
    user_id,
    status: "MCP server unavailable",
    fallback_insights: {
      message: "MCP analysis server is currently unavailable. This is a fallback response.",
      suggestions: [
        "The cast hash provided was: " + cast_hash.substring(0, 10) + "...",
        "Try again later when the MCP server is running",
        "Consider using the Analytics Overview for general insights"
      ],
      timestamp: new Date().toISOString()
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { cast_hash, user_id } = await request.json()
    
    if (!cast_hash || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: cast_hash, user_id' },
        { status: 400 }
      )
    }

    try {
      const mcpClient = getMCPClient()
      const analysis = await mcpClient.analyzeCastPerformance(cast_hash, user_id)
      
      return NextResponse.json({
        success: true,
        analysis: JSON.parse(analysis.content[0].text)
      })
    } catch (mcpError: any) {
      console.warn('⚠️ MCP server unavailable, using fallback:', mcpError?.message || mcpError)
      
      // Return fallback analysis instead of failing
      return NextResponse.json({
        success: true,
        analysis: generateFallbackAnalysis(cast_hash, user_id),
        fallback: true
      })
    }
  } catch (error) {
    console.error('❌ Error in MCP analyze endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to analyze cast performance' },
      { status: 500 }
    )
  }
}
