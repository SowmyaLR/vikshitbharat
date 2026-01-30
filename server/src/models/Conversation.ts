import mongoose from 'mongoose';

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
    marketData: {
        modalPrice: Number,
        minPrice: Number,
        maxPrice: Number,
        priceDate: Date
    },
    messages: [MessageSchema],
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'cancelled'],
        default: 'pending'
    },
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
ConversationSchema.index({ roomId: 1 });
ConversationSchema.index({ 'buyer.id': 1, status: 1 });
ConversationSchema.index({ 'vendor.id': 1, status: 1 });
ConversationSchema.index({ startedAt: -1 });

// Methods
ConversationSchema.methods.addMessage = function (messageData: any) {
    this.messages.push(messageData);
    this.lastActivityAt = new Date();
    return this.save();
};

export const Conversation = mongoose.model('Conversation', ConversationSchema);
