import { spawn } from 'child_process'
import path from 'path'

interface MCPTool {
  name: string
  description: string
  inputSchema: any
}

interface MCPResponse {
  content: Array<{
    type: string
    text: string
  }>
}

export class MCPClient {
  private process: any = null
  private requestId = 0

  async initialize() {
    if (this.process) {
      return
    }

    const serverPath = path.join(process.cwd(), 'mcp-server', 'dist', 'index.js')
    
    this.process = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    })

    // Wait for initialization
    await new Promise((resolve) => {
      setTimeout(resolve, 1000)
    })
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.process) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId
      
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: {
          name,
          arguments: args
        }
      }

      let responseData = ''
      let timeoutId: NodeJS.Timeout
      
      const onData = (data: Buffer) => {
        responseData += data.toString()
        
        try {
          const response = JSON.parse(responseData)
          if (response.id === requestId) {
            this.process.stdout.removeListener('data', onData)
            clearTimeout(timeoutId)
            
            if (response.error) {
              reject(new Error(response.error.message))
            } else {
              resolve(response.result)
            }
          }
        } catch (e) {
          // Wait for more data
        }
      }

      const onError = (error: any) => {
        this.process.stdout.removeListener('data', onData)
        this.process.removeListener('error', onError)
        clearTimeout(timeoutId)
        reject(new Error(`MCP process error: ${error.message}`))
      }

      this.process.stdout.on('data', onData)
      this.process.on('error', onError)
      
      try {
        this.process.stdin.write(JSON.stringify(request) + '\n')
      } catch (writeError) {
        clearTimeout(timeoutId)
        reject(new Error(`Failed to write to MCP process: ${writeError}`))
        return
      }
      
      // Reduced timeout to 10 seconds
      timeoutId = setTimeout(() => {
        this.process.stdout.removeListener('data', onData)
        this.process.removeListener('error', onError)
        reject(new Error('MCP request timeout'))
      }, 10000)
    })
  }

  async analyzeCastPerformance(castHash: string, userId: string) {
    return this.callTool('analyze_cast_performance', { cast_hash: castHash, user_id: userId })
  }

  async compareCasts(castHash1: string, castHash2: string, userId: string) {
    return this.callTool('compare_casts', { 
      cast_hash_1: castHash1, 
      cast_hash_2: castHash2, 
      user_id: userId 
    })
  }

  async getTrendingInsights(userId: string, days: number = 7) {
    return this.callTool('get_trending_insights', { user_id: userId, days })
  }

  async generateCastOpinion(castHash: string, userId: string, perspective: string = 'general') {
    return this.callTool('generate_cast_opinion', { 
      cast_hash: castHash, 
      user_id: userId, 
      perspective 
    })
  }

  async findSimilarCasts(castHash: string, userId: string, limit: number = 5) {
    return this.callTool('find_similar_casts', { 
      cast_hash: castHash, 
      user_id: userId, 
      limit 
    })
  }

  disconnect() {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }
}

// Singleton instance
let mcpClient: MCPClient | null = null

export function getMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient()
  }
  return mcpClient
}
