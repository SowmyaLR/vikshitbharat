import mongoose from 'mongoose';

// Message Schema - Individual messages in a negotiation
const MessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['buyer', 'vendor', 'ai_mediator'],
        required: true
    },
    senderName: String,
    originalText: {
        type: String,
        required: true
    },
    translatedText: String,
    language: String,
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        sentiment: String,
        priceExtracted: Number,
        aiAnalysis: String
    }
});

// Negotiation Session Schema - Complete negotiation record
const NegotiationSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Participants
    buyer: {
        id: String,
        name: String,
        phone: String
    },
    vendor: {
        id: String,
        name: String,
        phone: String
    },

    // Negotiation Details
    commodity: {
        type: String,
        required: true
    },
    location: {
        mandiName: String,
        state: String
    },

    // Market Context
    marketData: {
        modalPrice: Number,
        minPrice: Number,
        maxPrice: Number,
        priceDate: Date
    },

    // Messages
    messages: [MessageSchema],

    // Deal Status
    status: {
        type: String,
        enum: ['pending', 'active', 'deal_reached', 'rejected', 'expired'],
        default: 'pending'
    },

    // Final Deal
    finalDeal: {
        agreedPrice: Number,
        quantity: Number,
        unit: String,
        agreedAt: Date,
        buyerAccepted: Boolean,
        vendorAccepted: Boolean
    },

    // AI Insights Summary
    aiInsights: {
        totalMessages: Number,
        buyerOffers: [Number],
        vendorCounters: [Number],
        fairPriceRange: {
            min: Number,
            max: Number
        },
        negotiationQuality: String, // 'fair', 'buyer_favored', 'vendor_favored'
        recommendations: [String]
    },

    // Timestamps
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    lastActivityAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
NegotiationSchema.index({ 'buyer.id': 1, status: 1 });
NegotiationSchema.index({ 'vendor.id': 1, status: 1 });
NegotiationSchema.index({ commodity: 1, 'location.mandiName': 1 });
NegotiationSchema.index({ startedAt: -1 });

// Methods
NegotiationSchema.methods.addMessage = function (messageData: any) {
    this.messages.push(messageData);
    this.lastActivityAt = new Date();
    return this.save();
};

NegotiationSchema.methods.updateDealStatus = function (status: string, dealData?: any) {
    this.status = status;
    if (dealData) {
        this.finalDeal = { ...this.finalDeal, ...dealData };
    }
    if (status === 'deal_reached') {
        this.completedAt = new Date();
    }
    return this.save();
};

export const Negotiation = mongoose.model('Negotiation', NegotiationSchema);
