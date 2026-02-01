import { Vendor } from '../models/Vendor';
import { Conversation } from '../models/Conversation';

export class TrustScoringService {
    /**
     * Updates Negotiation Stability Score (NSS) immediately after a counter-offer.
     * Logic: Penalizes "stubbornness" (small price movements) and rewards fair counters.
     */
    async updateNSSOnCounter(roomId: string, vendorId: string, counterPrice: number) {
        try {
            const conversation = await Conversation.findOne({ roomId });
            if (!conversation || !conversation.marketData) return;

            const modal = conversation.marketData.modalPrice;
            const buyerOffer = conversation.structuredOffer?.price || modal;

            // NEW ASYMMETRIC LOGIC: Don't penalize counters at or below modal.
            // A seller countering AT market price is a fair stable anchor.
            let stabilityPoints = 100;
            if (counterPrice > modal) {
                const deviation = (counterPrice - modal) / modal;
                stabilityPoints = Math.max(0, 100 - (deviation * 200)); // Penalize only upward deviation
            }

            console.log(`📊 [NSS Update] Room: ${roomId}, Vendor: ${vendorId}, Counter: ₹${counterPrice}, Modal: ₹${modal}, Points: ${stabilityPoints.toFixed(2)}`);
            await this.applyIncrementalUpdate(vendorId, 'negotiation', stabilityPoints);
        } catch (error) {
            console.error('Error updating NSS:', error);
        }
    }

    /**
     * Updates all scores after a successful deal.
     */
    async updateScoresOnDeal(roomId: string, vendorId: string) {
        try {
            const conversation = await Conversation.findOne({ roomId });
            if (!conversation || !conversation.marketData) return;

            const modal = conversation.marketData.modalPrice;
            const finalPrice = conversation.structuredOffer?.price || modal;

            // 1. Price Honesty (45%)
            // NEW ASYMMETRIC LOGIC: Don't penalize if price is at or below market (with 5% buffer).
            // Selling below market increases trust (transparency/fairness).
            let phs = 100;
            const fairThreshold = modal * 1.05; // 5% buffer
            if (finalPrice > fairThreshold) {
                const priceDeviation = (finalPrice - fairThreshold) / modal;
                phs = Math.max(0, 100 - (priceDeviation * 400)); // Sharp penalty for overcharging
            }

            // 2. Language Reliability (20%)
            // Check for dispute keywords in history
            const chatText = conversation.messages.map(m => m.originalText.toLowerCase()).join(' ');
            const disputeKeywords = ['dispute', 'wrong translation', 'misunderstood', 'fraud', 'cheat', 'tampering'];
            const disputeCount = disputeKeywords.filter(k => chatText.includes(k)).length;
            const lrs = Math.max(0, 100 - (disputeCount * 25));

            console.log(`✅ [Deal Update] Room: ${roomId}, Vendor: ${vendorId}, Final: ₹${finalPrice}, Modal: ₹${modal}`);
            console.log(`   └─ PHS Score: ${phs.toFixed(2)} | LRS Score: ${lrs.toFixed(2)} | Disputes: ${disputeCount}`);

            // Apply updates
            await this.applyIncrementalUpdate(vendorId, 'priceHonesty', phs);
            await this.applyIncrementalUpdate(vendorId, 'languageReliability', lrs);

            // Update confidence volume
            await Vendor.findByIdAndUpdate(vendorId, { $inc: { totalDeals: 1 } });

            // Recalculate Overall
            await this.recalculateOverall(vendorId);

        } catch (error) {
            console.error('Error updating scores on deal:', error);
        }
    }

    async triggerDisputeUpdate(vendorId: string) {
        console.log(`⚠️ [Dispute Trigger] Vendor: ${vendorId}. Penalizing Language Reliability Score.`);
        await this.applyIncrementalUpdate(vendorId, 'languageReliability', 0); // Penalize with 0 points for this interaction
        await this.recalculateOverall(vendorId);
    }

    /**
     * Helper to apply moving average to a score component
     */
    private async applyIncrementalUpdate(vendorId: string, field: string, newPoints: number) {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) return;

        const currentScore = (vendor as any).trustScore[field] || 70; // Default to 70 for new
        const weight = 0.2; // 20% weight to new interaction
        const updatedScore = Math.round((currentScore * (1 - weight)) + (newPoints * weight));

        console.log(`📈 [Trust Update] Vendor: ${vendor.businessName} | Field: ${field} | Old: ${currentScore} -> New: ${updatedScore}`);

        const update: any = {};
        update[`trustScore.${field}`] = updatedScore;
        update[`trustScore.lastScoreUpdate`] = new Date();

        await Vendor.findByIdAndUpdate(vendorId, update);
    }

    /**
     * Recalculates the overall aggregate score
     */
    private async recalculateOverall(vendorId: string) {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) return;

        const ts = (vendor as any).trustScore;
        const overall = Math.round(
            (ts.priceHonesty * 0.45) +
            (ts.negotiation * 0.35) +
            (ts.languageReliability * 0.20)
        );

        console.log(`🌟 [Overall Trust] Vendor: ${vendor.businessName} | New Aggregate: ${overall}/100`);

        await Vendor.findByIdAndUpdate(vendorId, { 'trustScore.overall': overall });
    }
}

export const trustScoringService = new TrustScoringService();
