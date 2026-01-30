import mongoose from 'mongoose';

console.log('📦 Initializing Item Model...');

const ItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['grain', 'vegetable', 'fruit', 'spice', 'other'],
        default: 'grain'
    },
    unit: {
        type: String,
        default: 'quintal'
    },
    description: String,
    imageUrl: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export const Item = mongoose.model('Item', ItemSchema);
