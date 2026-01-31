import mongoose from 'mongoose';

const DealSchema = new mongoose.Schema({
    roomId: String,
    buyerId: String,
    sellerId: String,
    items: [{
        name: String,
        quantity: String,
        price: Number,
        total: Number
    }],
    totalAmount: Number,
    // Status Flow: draft -> agreed (both signed) -> closed (delivered) OR delivery_failed OR rejected
    status: {
        type: String,
        enum: ['draft', 'agreed', 'delivery_failed', 'closed', 'rejected'],
        default: 'draft'
    },
    buyerAddress: String,

    // Signatures
    sellerSignature: { type: Boolean, default: false },
    buyerSignature: { type: Boolean, default: false },

    agreedDate: Date,
    createdAt: { type: Date, default: Date.now }
});

export const Deal = mongoose.model('Deal', DealSchema);
