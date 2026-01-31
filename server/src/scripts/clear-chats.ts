import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Conversation } from '../models/Conversation';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const clearChats = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://admin:dharmavyapaara2024@localhost:27017/dharmavyapaara?authSource=admin';
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const result = await Conversation.deleteMany({});
        console.log(`Deleted ${result.deletedCount} conversations.`);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error clearing chats:', error);
    }
};

clearChats();
