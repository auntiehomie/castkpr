// MCP Tool Arguments Types
export interface AnalyzeCastArgs {
  cast_hash: string
  user_id: string
}

export interface CompareCastsArgs {
  cast_hash_1: string
  cast_hash_2: string
  user_id: string
}

export interface TrendingInsightsArgs {
  user_id: string
  days?: number
}

export interface CastOpinionArgs {
  cast_hash: string
  user_id: string
  perspective?: string
}

export interface SimilarCastsArgs {
  cast_hash: string
  user_id: string
  limit?: number
}

// Union type for all tool arguments
export type ToolArgs = 
  | AnalyzeCastArgs 
  | CompareCastsArgs 
  | TrendingInsightsArgs 
  | CastOpinionArgs 
  | SimilarCastsArgs
