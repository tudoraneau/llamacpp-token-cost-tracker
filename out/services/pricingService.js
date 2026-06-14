"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingService = void 0;
class PricingService {
    constructor(storageService) {
        this.storageService = storageService;
    }
    calculateCost(promptTokens, completionTokens) {
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
    async updateModelPricing(modelId, inputCostPerMillion, outputCostPerMillion) {
        // Update model profile with new pricing
        const profiles = await this.storageService.getModelProfiles();
        const profileIndex = profiles.findIndex((p) => p.id === modelId);
        if (profileIndex !== -1) {
            profiles[profileIndex].inputCostPerMillion = inputCostPerMillion;
            profiles[profileIndex].outputCostPerMillion = outputCostPerMillion;
            await this.storageService.updateGlobalState('modelProfiles', profiles);
        }
    }
    async setSinglePricing(modelId, pricePerMillion) {
        // Set single price for both input and output
        const profiles = await this.storageService.getModelProfiles();
        const profileIndex = profiles.findIndex((p) => p.id === modelId);
        if (profileIndex !== -1) {
            profiles[profileIndex].inputCostPerMillion = pricePerMillion;
            profiles[profileIndex].outputCostPerMillion = pricePerMillion;
            await this.storageService.updateGlobalState('modelProfiles', profiles);
        }
    }
}
exports.PricingService = PricingService;
//# sourceMappingURL=pricingService.js.map