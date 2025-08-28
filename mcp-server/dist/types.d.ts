export interface AnalyzeCastArgs {
    cast_hash: string;
    user_id: string;
}
export interface CompareCastsArgs {
    cast_hash_1: string;
    cast_hash_2: string;
    user_id: string;
}
export interface TrendingInsightsArgs {
    user_id: string;
    days?: number;
}
export interface CastOpinionArgs {
    cast_hash: string;
    user_id: string;
    perspective?: string;
}
export interface SimilarCastsArgs {
    cast_hash: string;
    user_id: string;
    limit?: number;
}
export type ToolArgs = AnalyzeCastArgs | CompareCastsArgs | TrendingInsightsArgs | CastOpinionArgs | SimilarCastsArgs;
//# sourceMappingURL=types.d.ts.map