import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { ModelProfile } from '../models/modelProfile';

export class PricingService {
    private storageService: StorageService;
    
    constructor(storageService: StorageService) {
        this.storageService = storageService;
    }
    
    calculateCost(promptTokens: number, completionTokens: number): number {
        const modelProfile = this.storageService.getCurrentModelProfile();
        
        if (!modelProfile) {
            return 0;
        }
        
        // If single price is set, use it
        if (modelProfile.inputCostPerMillion === 0 && modelProfile.outputCostPerMillion === 0) {
            // Default to zero cost if no pricing set
            return 0;
        }
        
        // Calculate cost based on model profile
        const inputPricePerToken = modelProfile.inputCostPerMillion / 1000000;
        const outputPricePerToken = modelProfile.outputCostPerMillion / 1000000;
        
        const inputCost = promptTokens * inputPricePerToken;
        const outputCost = completionTokens * outputPricePerToken;
        
        return inputCost + outputCost;
    }
    
    async updateModelPricing(modelId: string, inputCostPerMillion: number, outputCostPerMillion: number): Promise<void> {
        // Update model profile with new pricing
        const profiles = await this.storageService.getModelProfiles();
        const profileIndex = profiles.findIndex((p: ModelProfile) => p.id === modelId);
        
        if (profileIndex !== -1) {
            profiles[profileIndex].inputCostPerMillion = inputCostPerMillion;
            profiles[profileIndex].outputCostPerMillion = outputCostPerMillion;
            
            await this.storageService.updateGlobalState('modelProfiles', profiles);
        }
    }
    
    async setSinglePricing(modelId: string, pricePerMillion: number): Promise<void> {
        // Set single price for both input and output
        const profiles = await this.storageService.getModelProfiles();
        const profileIndex = profiles.findIndex((p: ModelProfile) => p.id === modelId);
        
        if (profileIndex !== -1) {
            profiles[profileIndex].inputCostPerMillion = pricePerMillion;
            profiles[profileIndex].outputCostPerMillion = pricePerMillion;
            
            await this.storageService.updateGlobalState('modelProfiles', profiles);
        }
    }
}