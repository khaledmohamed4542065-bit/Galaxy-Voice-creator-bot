import mongoose from 'mongoose';

const coinSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    balance: { type: Number, default: 0 },
    studyTime: { type: Number, default: 0 },
    dailyStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date },
    messageCount: { type: Number, default: 0 },
    voiceTime: { type: Number, default: 0 },
    completedCycles: { type: Number, default: 0 },
    weeklyActivity: { type: [Number], default: [0, 0, 0, 0, 0, 0, 0] }
}, { timestamps: true });

coinSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const Coin = mongoose.model('Coin', coinSchema);
export default Coin;
