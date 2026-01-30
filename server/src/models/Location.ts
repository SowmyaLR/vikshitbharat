import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema({
    state: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: true
    },
    mandiName: {
        type: String,
        required: true
    },
    address: String,
    pincode: String,
    coordinates: {
        latitude: Number,
        longitude: Number
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

LocationSchema.index({ state: 1, mandiName: 1 });

export const Location = mongoose.model('Location', LocationSchema);
