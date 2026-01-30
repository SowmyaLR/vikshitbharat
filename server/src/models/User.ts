import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    email: String,
    role: {
        type: String,
        enum: ['buyer', 'seller', 'both'],
        required: true
    },
    location: {
        state: String,
        district: String,
        mandiName: String
    },
    preferredLanguage: {
        type: String,
        default: 'hi'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export const User = mongoose.model('User', UserSchema);
