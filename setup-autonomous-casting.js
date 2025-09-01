#!/usr/bin/env node
// setup-autonomous-casting.js
// Script to help set up autonomous casting for CastKPR

const readline = require('readline')
const fs = require('fs')
const path = require('path')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function main() {
  console.log('🤖 CastKPR Autonomous Casting Setup')
  console.log('=====================================\n')
  
  console.log('This script will help you set up automated posting for CastKPR.\n')
  
  // Check if .env.local exists
  const envPath = path.join(process.cwd(), '.env.local')
  const envExists = fs.existsSync(envPath)
  
  if (!envExists) {
    console.log('❌ .env.local file not found!')
    console.log('Please create a .env.local file with your API keys first.\n')
    return
  }
  
  // Read current .env.local
  const envContent = fs.readFileSync(envPath, 'utf8')
  
  // Check for required keys
  const requiredKeys = [
    'NEYNAR_API_KEY',
    'NEYNAR_SIGNER_UUID', 
    'OPENAI_API_KEY',
    'AUTONOMOUS_CAST_SECRET'
  ]
  
  const missingKeys = requiredKeys.filter(key => !envContent.includes(key + '='))
  
  if (missingKeys.length > 0) {
    console.log('❌ Missing required environment variables:')
    missingKeys.forEach(key => console.log(`   - ${key}`))
    console.log('\nPlease add these to your .env.local file.\n')
    
    if (missingKeys.includes('AUTONOMOUS_CAST_SECRET')) {
      console.log('For AUTONOMOUS_CAST_SECRET, you can use: CSTKPR_AUTO_CAST_SECRET_2024\n')
    }
    
    rl.close()
    return
  }
  
  console.log('✅ All required environment variables found!\n')
  
  console.log('📋 Setup Options:')
  console.log('1. Test autonomous casting locally')
  console.log('2. Set up external cron job (production)')
  console.log('3. View setup instructions')
  
  const choice = await question('\nChoose an option (1-3): ')
  
  switch (choice.trim()) {
    case '1':
      console.log('\n🧪 Local Testing Setup:')
      console.log('1. Run: npm run dev')
      console.log('2. Visit: http://localhost:3000/autonomous-cast-tester')
      console.log('3. Use the "Start Auto-Scheduler" button for local testing')
      console.log('4. Monitor the console for autonomous cast generation\n')
      break
      
    case '2':
      console.log('\n🌐 Production Cron Setup:')
      console.log('Use a service like cron-job.org or EasyCron:')
      console.log(`URL: https://castkpr.vercel.app/api/cron/autonomous-cast?secret=CSTKPR_AUTO_CAST_SECRET_2024`)
      console.log('Method: GET')
      console.log('Schedule: 0 9,14,19,23 * * * (4 times daily)')
      console.log('User-Agent: CastKPR-Cron/1.0\n')
      break
      
    case '3':
      console.log('\n📖 Complete Setup Instructions:')
      console.log('\n🔧 Environment Variables Required:')
      requiredKeys.forEach(key => {
        const hasKey = envContent.includes(key + '=')
        console.log(`   ${hasKey ? '✅' : '❌'} ${key}`)
      })
      
      console.log('\n⏰ Scheduling Options:')
      console.log('• Local Dev: Use /autonomous-cast-tester page')
      console.log('• Production: Set up external cron job')
      console.log('• Manual: POST to /api/autonomous-cast\n')
      
      console.log('🎯 How It Works:')
      console.log('• Analyzes trending Farcaster topics')
      console.log('• Examines patterns in your saved casts')
      console.log('• Generates thoughtful, original content')
      console.log('• Posts during optimal engagement times\n')
      break
      
    default:
      console.log('❓ Invalid choice. Exiting.\n')
  }
  
  rl.close()
}

main().catch(console.error)
