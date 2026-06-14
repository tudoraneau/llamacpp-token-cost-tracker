export interface Statistics {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
}