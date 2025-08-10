import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (userId) {
      // Get specific user profile
      const { data, error } = await supabase
        .from('user_ai_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching user AI profile:', error)
        return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 })
      }
      
      return NextResponse.json({ profile: data || null })
    } else {
      // Get all user profiles
      const { data, error } = await supabase
        .from('user_ai_profiles')
        .select('*')
        .order('engagement_level', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('Error fetching user AI profiles:', error)
        return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 })
      }
      
      return NextResponse.json({ profiles: data || [] })
    }
    
  } catch (error) {
    console.error('User AI profiles API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, interests, interactionPatterns, preferredTopics, responseStyle, engagementLevel } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    // Upsert user AI profile
    const { data, error } = await supabase
      .from('user_ai_profiles')
      .upsert({
        user_id: userId,
        interests: interests || [],
        interaction_patterns: interactionPatterns || {},
        preferred_topics: preferredTopics || [],
        response_style: responseStyle || 'conversational',
        engagement_level: engagementLevel || 0.0,
        last_updated: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error upserting user AI profile:', error)
      return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'User AI profile updated successfully',
      profile: data 
    })
    
  } catch (error) {
    console.error('User AI profiles POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    const { error } = await supabase
      .from('user_ai_profiles')
      .delete()
      .eq('user_id', userId)
    
    if (error) {
      console.error('Error deleting user AI profile:', error)
      return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'User AI profile deleted successfully' 
    })
    
  } catch (error) {
    console.error('User AI profiles DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}