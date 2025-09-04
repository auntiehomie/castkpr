// Test script to trigger cast enhancement
const fetch = require('node-fetch')

async function testEnhancement() {
  try {
    console.log('🧪 Testing cast enhancement...')
    
    const response = await fetch('http://localhost:3000/api/enhance-casts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'demo-user',
        limit: 10,
        offset: 0
      })
    })

    const result = await response.json()
    console.log('✅ Enhancement result:', JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error('❌ Error testing enhancement:', error)
  }
}

testEnhancement()
