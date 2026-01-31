import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
    roomId: string;
    buyer: any;
    vendor: any;
    commodity: string;
    location: any;
    buyerLanguage: string;
    sellerLanguage: string;
    marketData: any;
    messages: any[];
    status: string;
    negotiationPhase: string;
    structuredOffer: any;
    aiGreeting?: string;
    aiInsight?: string;
    isOfferTooLow?: boolean;
    startedAt: Date;
    completedAt: Date;
    lastActivityAt: Date;
    closedAt?: Date; // New field
    closureReason?: string; // New field
    endedBy?: string; // New field (assuming User ID is string or ObjectId)
    finalDealId?: mongoose.Types.ObjectId; // New field
    autoCloseHours?: number; // New field
    addMessage(messageData: any): Promise<IConversation>;
}

const MessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['buyer', 'vendor', 'ai_mediator'], // kept 'vendor' based on existing enum
        required: true
    },
    senderName: String,
    messageType: {
        type: String,
        enum: ['text', 'audio'],
        default: 'text'
    },
    // Voice Data
    audioUrl: String,
    duration: Number,

    // Content
    originalText: {
        type: String,
        required: true
    },
    translatedText: String,

    // Language Support
    spokenLanguage: {
        type: String,
        enum: ['hi', 'ta', 'en'],
        default: 'en'
    },
    targetLanguage: String,

    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        sentiment: String,
        priceExtracted: Number,
        aiAnalysis: String,
        suggestedPrice: Number,
        dealStatus: String
    }
});

const ConversationSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    buyer: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: String,
        phone: String
    },
    vendor: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor'
        },
        name: String,
        phone: String
    },
    commodity: {
        type: String,
        required: true
    },
    location: {
        mandiName: String,
        state: String
    },
    buyerLanguage: {
        type: String,
        enum: ['hi', 'ta', 'en'],
        default: 'en'
    },
    sellerLanguage: {
        type: String,
        enum: ['hi', 'ta', 'en'],
        default: 'en'
    },
    marketData: {
        modalPrice: Number,
        minPrice: Number,
        maxPrice: Number,
        priceDate: Date
    },
    messages: [MessageSchema],
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'cancelled', 'deal_room', 'deal_success', 'deal_failed', 'abandoned'], // Updated enum
        default: 'pending'
    },
    negotiationPhase: {
        type: String,
        enum: ['greeting', 'offer', 'seller_review', 'buyer_counter_review', 'chat'],
        default: 'greeting'
    },
    aiGreeting: String,
    aiInsight: String,
    isOfferTooLow: { type: Boolean, default: false },
    structuredOffer: {
        quantity: Number,
        price: Number,
        purpose: String,
        timestamp: { type: Date, default: Date.now }
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    lastActivityAt: {
        type: Date,
        default: Date.now
    },
    closedAt: { // New field
        type: Date
    },
    closureReason: { // New field
        type: String,
        enum: ['deal_created', 'seller_accepted_offer', 'seller_rejected', 'mutually_ended', 'timeout_stale']
    },
    endedBy: { // New field
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Assuming 'User' is the model for users
    },
    finalDealId: { // New field
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deal' // Assuming 'Deal' is the model for deals
    },
    autoCloseHours: { // New field
        type: Number,
        default: 24 // Default to 24 hours
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
// roomId is already unique: true, which creates an index
ConversationSchema.index({ 'buyer.id': 1, status: 1 });
ConversationSchema.index({ 'vendor.id': 1, status: 1 });
ConversationSchema.index({ startedAt: -1 });

// Methods
ConversationSchema.methods.addMessage = function (messageData: any) {
    this.messages.push(messageData);
    this.lastActivityAt = new Date();
    return this.save();
};

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
