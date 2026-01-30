import mongoose from 'mongoose';
import { Item } from './Item';

const VendorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    businessName: String,
    location: {
        state: String,
        district: String,
        mandiName: String
    },
    trustScore: {
        overall: { type: Number, default: 0 },
        priceHonesty: { type: Number, default: 0 },
        fulfillment: { type: Number, default: 0 },
        negotiation: { type: Number, default: 0 }
    },
    availableCommodities: [{
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: Item
        },
        name: String,
        currentStock: Number,
        pricePerQuintal: Number
    }],
    reputationSummary: String,
    totalDeals: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

VendorSchema.index({ 'location.mandiName': 1, isActive: 1 });

export const Vendor = mongoose.model('Vendor', VendorSchema);
