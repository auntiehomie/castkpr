// Add this to the top of your src/lib/supabase.ts file, after the existing interfaces

export interface AnalyzedCast {
  hash: string
  text: string
  timestamp: string
  author: {
    fid: number
    username: string
    display_name?: string
    pfp_url?: string
  }
  reactions: {
    likes_count: number
    recasts_count: number
  }
  replies: {
    count: number
  }
  parsed_data: ParsedData
  cast_url: string
  channel?: {
    id: string
    name: string
  }
  embeds?: string[]
  mentions?: Array<{
    fid: number
    username: string
    display_name?: string
  }>
}