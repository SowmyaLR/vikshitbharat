import mongoose from 'mongoose';

const DealSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    commodity: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'quintal'
    },
    agreedPrice: {
        type: Number,
        required: true
    },
    totalAmount: Number,
    location: {
        mandiName: String,
        state: String
    },
    marketPriceAtDeal: {
        modalPrice: Number,
        minPrice: Number,
        maxPrice: Number
    },
    dealQuality: {
        type: String,
        enum: ['excellent', 'fair', 'poor'],
        default: 'fair'
    },
    buyerSavings: Number, // Positive if below market, negative if above
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    },
    buyerConfirmed: {
        type: Boolean,
        default: false
    },
    vendorConfirmed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date
}, {
    timestamps: true
});

// Indexes
DealSchema.index({ buyerId: 1, status: 1 });
DealSchema.index({ vendorId: 1, status: 1 });
DealSchema.index({ conversationId: 1 });
DealSchema.index({ createdAt: -1 });

// Calculate total amount before saving
DealSchema.pre('save', function (next) {
    if (this.quantity && this.agreedPrice) {
        this.totalAmount = this.quantity * this.agreedPrice;
    }
    next();
});

export const Deal = mongoose.model('Deal', DealSchema);
