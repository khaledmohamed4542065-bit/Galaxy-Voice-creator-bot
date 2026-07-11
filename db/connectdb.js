import mongoose from 'mongoose';
import config from '../config/config.js';
import PrivateVC from '../models/PrivateVC.js';

const connectDB = async () => {
    try {
        await mongoose.connect(config.mongoUrl);
        console.log('✅ MongoDB connected successfully for Galaxy Temp Voice Bot');
        try {
            await PrivateVC.collection.dropIndex('channelId_1').catch(() => {});
            await PrivateVC.syncIndexes().catch(() => {});
        } catch (e) {
            // Ignore index drop errors
        }
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

export default connectDB;
