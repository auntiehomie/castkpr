#!/usr/bin/env node

// Setup script for MCP server
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

console.log('🚀 Setting up MCP Server for CastKPR...')

const mcpServerPath = path.join(__dirname, 'mcp-server')

// Check if MCP server directory exists
if (!fs.existsSync(mcpServerPath)) {
  console.error('❌ MCP server directory not found!')
  process.exit(1)
}

try {
  // Install MCP server dependencies
  console.log('📦 Installing MCP server dependencies...')
  execSync('npm install', { 
    cwd: mcpServerPath, 
    stdio: 'inherit' 
  })

  // Build MCP server
  console.log('🔨 Building MCP server...')
  execSync('npm run build', { 
    cwd: mcpServerPath, 
    stdio: 'inherit' 
  })

  console.log('✅ MCP Server setup complete!')
  console.log('')
  console.log('🎉 Your CastKPR MCP integration is ready!')
  console.log('')
  console.log('Features available:')
  console.log('  • 📊 Deep cast performance analysis')
  console.log('  • ⚖️ Side-by-side cast comparison')
  console.log('  • 💭 AI-powered cast opinions')
  console.log('  • 🔍 Similar cast discovery')
  console.log('  • 📈 Trending insights analysis')
  console.log('')
  console.log('Access these features in your Dashboard → "🤖 MCP Insights" tab')
  
} catch (error) {
  console.error('❌ Error setting up MCP server:', error.message)
  process.exit(1)
}
