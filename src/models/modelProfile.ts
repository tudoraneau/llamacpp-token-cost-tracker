export interface ModelProfile {
    id: string;
    name: string;
    contextLength: number;
    inputCostPerMillion: number;
    outputCostPerMillion: number;
    notes: string;
    isActive?: boolean;
}